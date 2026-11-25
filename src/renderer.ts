type TriageRow = import('./triage.ts').Row
interface Window { triage: import('./preload.ts').TriageApi }
const api = window.triage

const openReport = document.querySelector<HTMLButtonElement>('#open-report')!
const openRoot = document.querySelector<HTMLButtonElement>('#open-root')!
const reportPath = document.querySelector('#report-path')!
const rootPath = document.querySelector('#root-path')!
const model = document.querySelector<HTMLSelectElement>('#model')!
const concurrency = document.querySelector<HTMLInputElement>('#concurrency')!
const maxLevel = document.querySelector<HTMLSelectElement>('#max-level')!
const start = document.querySelector<HTMLButtonElement>('#start')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!
const progress = document.querySelector<HTMLProgressElement>('#progress')!
const count = document.querySelector('#count')!
const usageOutput = document.querySelector('#usage')!
const error = document.querySelector('#error')!
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('#filter button'))
const table = document.querySelector<HTMLTableSectionElement>('tbody')!
const headers = Array.from(document.querySelectorAll<HTMLTableCellElement>('thead th'))
const exportsButtons = document.querySelectorAll<HTMLButtonElement>('[data-export]')

let rows: TriageRow[] = []
let busy = false
let dialogOpen = false
let expanded = -1
let sortColumn = -1
let direction = 1
let frame = 0
let verdictFilter = ''

const locationText = (row: TriageRow) => `${row.file}:${row.line}`
const verdictText = (row: TriageRow) => row.answer?.verdict ?? row.status
const reasonText = (row: TriageRow) => row.answer?.reason ?? row.error ?? ''
const confidenceOrder = { low: 1, medium: 2, high: 3 }
const columns: Array<(row: TriageRow) => string | number> = [
  row => row.code, row => row.level, locationText, row => row.message, verdictText,
  row => row.answer ? confidenceOrder[row.answer.confidence] : 0, reasonText,
]
const collator = new Intl.Collator(undefined, { numeric: true })

function controls() {
  start.disabled = busy || dialogOpen || !reportPath.textContent || !rootPath.textContent || !model.value
  stopButton.disabled = !busy
  openReport.disabled = openRoot.disabled = busy || dialogOpen
  concurrency.disabled = maxLevel.disabled = busy
  model.disabled = busy || !model.value
  for (const button of exportsButtons) button.disabled = dialogOpen || !rows.length
}

function paint() {
  frame = 0
  const done = rows.filter(row => row.status === 'done' || row.status === 'error').length
  count.textContent = `${done} / ${rows.length}`
  progress.max = rows.length || 1
  progress.value = done
  controls()

  for (const chip of chips) {
    const verdict = chip.dataset.verdict!
    const total = verdict ? rows.filter(row => verdictText(row) === verdict).length : rows.length
    chip.textContent = `${verdict || 'all'} ${total}`
    chip.setAttribute('aria-pressed', String(verdict === verdictFilter))
  }

  const selected = rows.map((row, index) => ({ row, index }))
    .filter(({ row }) => !verdictFilter || verdictText(row) === verdictFilter)
  const sortValue = columns[sortColumn]
  if (sortValue) selected.sort((a, b) => {
    const left = sortValue(a.row)
    const right = sortValue(b.row)
    const order = typeof left === 'number' && typeof right === 'number'
      ? left - right : collator.compare(String(left), String(right))
    return direction * order
  })

  const focused = table.contains(document.activeElement)
    ? (document.activeElement as HTMLElement).closest('tr')?.dataset.index : undefined
  const body = document.createDocumentFragment()
  for (const { row, index } of selected) {
    const tr = body.appendChild(document.createElement('tr'))
    tr.dataset.index = String(index)
    tr.insertCell().textContent = row.code
    tr.insertCell().textContent = String(row.level)

    const button = tr.insertCell().appendChild(document.createElement('button'))
    button.className = 'file'
    button.textContent = `${row.file.split(/[\\/]/).pop()}:${row.line}`
    button.title = locationText(row)
    button.setAttribute('aria-expanded', String(expanded === index))
    tr.insertCell().textContent = row.message

    const badge = tr.insertCell().appendChild(document.createElement('span'))
    badge.className = 'badge ' + verdictText(row)
    badge.textContent = verdictText(row)
    tr.insertCell().textContent = row.answer?.confidence ?? ''
    tr.insertCell().textContent = reasonText(row)

    if (expanded === index) {
      const detail = body.appendChild(document.createElement('tr')).insertCell()
      detail.className = 'detail'
      detail.colSpan = columns.length
      const pre = detail.appendChild(document.createElement('pre'))
      for (const line of (row.snippet ?? 'Source snippet unavailable.').split('\n')) {
        const span = pre.appendChild(document.createElement('span'))
        span.textContent = line
        if (line.startsWith('>>')) span.className = 'target'
      }
    }
  }

  if (!selected.length) {
    const cell = body.appendChild(document.createElement('tr')).insertCell()
    cell.colSpan = columns.length
    cell.className = 'empty'
    cell.textContent = verdictFilter ? 'No rows match this verdict.' : reportPath.textContent ? 'No warnings to display.' : 'Open a report to start.'
  }

  table.replaceChildren(body)
  if (focused !== undefined) table.querySelector<HTMLButtonElement>(`[data-index="${focused}"] button`)?.focus({ preventScroll: true })
}

function schedulePaint() {
  if (!frame) frame = requestAnimationFrame(paint)
}

async function action(run: () => Promise<void>) {
  error.textContent = ''
  try {
    await run()
  } catch (failure) {
    error.textContent = failure instanceof Error ? failure.message : String(failure)
  }
}

function showPath(element: Element, path = '') {
  element.textContent = path.split(/[\\/]/).filter(Boolean).pop() ?? ''
  element.setAttribute('title', path)
}

async function choose(run: () => Promise<void>) {
  dialogOpen = true
  controls()
  try {
    await action(run)
  } finally {
    dialogOpen = false
    controls()
  }
}

openReport.onclick = () => choose(async () => {
  const chosen = await api.openReport()
  showPath(reportPath, chosen.report)
  showPath(rootPath, chosen.root)
})
openRoot.onclick = () => choose(async () => showPath(rootPath, await api.openRoot()))
for (const button of exportsButtons) {
  button.onclick = () => choose(() => api.save(button.dataset.export === 'csv' ? 'csv' : 'json'))
}

model.onchange = () => { localStorage.setItem('model', model.value) }
for (const chip of chips) {
  chip.onclick = () => {
    verdictFilter = chip.dataset.verdict!
    schedulePaint()
  }
}
headers.forEach((header, index) => {
  header.querySelector('button')!.onclick = () => {
    direction = sortColumn === index ? -direction : 1
    headers[sortColumn]?.removeAttribute('aria-sort')
    sortColumn = index
    header.setAttribute('aria-sort', direction === 1 ? 'ascending' : 'descending')
    schedulePaint()
  }
})

table.onclick = event => {
  const index = (event.target as Element).closest('tr')?.dataset.index
  if (index === undefined) return
  expanded = expanded === Number(index) ? -1 : Number(index)
  schedulePaint()
}

api.onUpdate(update => {
  if ('usage' in update) {
    usageOutput.textContent = update.usage
    return
  }
  if ('rows' in update) {
    rows = update.rows
    expanded = -1
  } else {
    rows[update.index] = update.row
  }
  schedulePaint()
})

start.onclick = async () => {
  if (!concurrency.reportValidity()) return
  busy = true
  controls()
  try {
    await action(() => api.start(model.value, concurrency.valueAsNumber, Number(maxLevel.value)))
  } finally {
    busy = false
    controls()
  }
}
stopButton.onclick = () => api.stop()

const theme = document.querySelector<HTMLButtonElement>('#theme')!
const applyTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  theme.textContent = dark ? 'Light theme' : 'Dark theme'
  theme.setAttribute('aria-pressed', String(dark))
}
applyTheme((localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark')
theme.onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark'
  localStorage.setItem('theme', dark ? 'dark' : 'light')
  applyTheme(dark)
}

void action(async () => {
  const models = await api.models()
  model.replaceChildren(...models.map(name => new Option(name, name)))
  if (!models.length) throw new Error('OpenCode returned no models.')
  const saved = localStorage.getItem('model')
  if (saved && models.includes(saved)) model.value = saved
  controls()
})
