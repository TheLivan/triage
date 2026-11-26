type TriageRow = import('./triage.ts').Row
interface Window { triage: import('./preload.ts').TriageApi }
const api = window.triage

const openFiles = document.querySelectorAll<HTMLButtonElement>('[data-open]')
const byId = (id: string) => document.getElementById(id)!
let saved = false
const openRoot = document.querySelector<HTMLButtonElement>('#open-root')!
const reportPath = document.querySelector('#report-path')!
const rootPath = document.querySelector('#root-path')!
const model = document.querySelector<HTMLSelectElement>('#model')!
const modelSettings = document.querySelector<HTMLDialogElement>('#model-settings')!
const modelOptions = document.querySelector<HTMLDivElement>('#model-options')!
let availableModels: string[] = []
let hiddenModels = new Set((localStorage.getItem('hiddenModels') || '').split('\n').filter(Boolean))
const concurrency = document.querySelector<HTMLInputElement>('#concurrency')!
const maxLevel = document.querySelector<HTMLSelectElement>('#max-level')!
const start = document.querySelector<HTMLButtonElement>('#start')!
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!
const progress = document.querySelector<HTMLProgressElement>('#progress')!
const count = byId('count')
const usageOutput = document.querySelector('#usage')!
const error = document.querySelector('#error')!
const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('#filter button'))
const table = document.querySelector<HTMLTableSectionElement>('tbody')!
const headers = Array.from(document.querySelectorAll<HTMLTableCellElement>('thead th'))
const exportFormat = document.querySelector<HTMLSelectElement>('#export')!
const results = document.querySelector<HTMLElement>('.results')
const detail = document.querySelector<HTMLElement>('#detail')

let rows: TriageRow[] = []
let busy = false
let dialogOpen = false
let selected = -1
let visible: number[] = []
let sortColumn = -1
let direction = 1
let frame = 0
let verdictFilter = ''
let phase: 'idle' | 'running' | 'finished' = 'idle'
let detailIndex = -2
let detailKey = ''

const locationText = (row: TriageRow) => `${row.file}:${row.line}`
const verdictText = (row: TriageRow) => row.answer?.verdict ?? row.status
const collator = new Intl.Collator(undefined, { numeric: true })
const columns: Array<(row: TriageRow) => string | number> = [
  row => row.code,
  row => `${row.level} ${row.message}`,
  locationText,
  verdictText,
]

const statusLabels: Record<TriageRow['status'], string> = {
  pending: 'not assessed', running: 'running', done: 'done', error: 'failed', stopped: 'stopped',
}
const verdictExplanations: Record<string, string> = {
  bug: 'Likely a real defect: the model found an input or a state in which this code misbehaves.',
  false_positive: 'Likely a false positive: the model found a reason this warning does not apply to the code.',
  unsure: 'Not enough context to decide: the model could not confirm or rule out a real defect.',
}
const statusExplanations: Record<TriageRow['status'], string> = {
  pending: 'Waiting to be triaged.',
  running: 'The model is analyzing this warning now.',
  stopped: 'Triage stopped before this warning was assessed.',
  done: 'The model returned no assessment for this warning.',
  error: 'This warning could not be processed, so no model verdict is available. This is a processing failure, not an assessment of the code.',
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function assessment(row: TriageRow) {
  const verdict = row.answer?.verdict
  return verdict
    ? { className: verdict, text: verdict.replaceAll('_', ' ') }
    : { className: row.status, text: statusLabels[row.status] }
}

function controls() {
  const opened = !!reportPath.textContent
  byId('welcome').hidden = opened
  byId('toolbar').hidden = !opened
  document.querySelector<HTMLElement>('.workspace')!.hidden = !opened
  byId('result-tools').hidden = !rows.length
  byId('advanced').hidden = byId('model-label').hidden = openRoot.hidden = saved
  start.hidden = saved || busy || !rootPath.textContent
  stopButton.hidden = count.hidden = progress.hidden = !busy
  start.disabled = busy || dialogOpen || !model.value || (!rows.length && phase === 'idle')
  for (const button of openFiles) button.disabled = busy || dialogOpen
  openRoot.disabled = busy || dialogOpen
  concurrency.disabled = maxLevel.disabled = busy
  model.disabled = busy || !availableModels.length
  exportFormat.hidden = !saved && !rows.some(row => row.status !== 'pending')
  exportFormat.disabled = dialogOpen
}

function emptyText() {
  if (rows.length) return verdictFilter
    ? `No warnings match the ${verdictFilter.replaceAll('_', ' ')} filter.`
    : 'No warnings to display.'
  if (!reportPath.textContent) return 'Open a report to start.'
  if (saved) return 'This export contains no warnings.'
  if (phase === 'running') return 'Triaging the report…'
  if (phase === 'finished') return `No warnings at or below level ${maxLevel.value} in this report.`
  return 'This report contains no valid warnings.'
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
    chip.textContent = `${(verdict || 'all').replaceAll('_', ' ')} ${total}`
    chip.setAttribute('aria-pressed', String(verdict === verdictFilter))
  }

  visible = rows.map((row, index) => index)
    .filter(index => !verdictFilter || verdictText(rows[index]) === verdictFilter)
  const sortValue = columns[sortColumn]
  if (sortValue) visible.sort((a, b) => {
    const left = sortValue(rows[a])
    const right = sortValue(rows[b])
    const order = typeof left === 'number' && typeof right === 'number'
      ? left - right : collator.compare(String(left), String(right))
    return direction * order
  })

  if (!visible.includes(selected)) selected = visible[0] ?? -1

  const hadFocus = table.contains(document.activeElement)
  const scroll = results?.scrollTop ?? 0
  const body = document.createDocumentFragment()
  for (const index of visible) {
    const row = rows[index]
    const tr = body.appendChild(document.createElement('tr'))
    tr.dataset.index = String(index)
    tr.tabIndex = index === selected ? 0 : -1
    tr.setAttribute('aria-selected', String(index === selected))

    tr.insertCell().textContent = row.code
    const warning = tr.insertCell()
    warning.append(element('span', 'badge', `L${row.level}`), document.createTextNode(' ' + row.message))
    const location = tr.insertCell()
    const path = element('span', 'location')
    path.append(element('bdi', '', locationText(row)))
    location.append(path)
    location.title = locationText(row)
    const verdict = assessment(row)
    const modelCell = tr.insertCell()
    modelCell.append(element('span', `badge ${verdict.className}`, verdict.text))
  }

  if (!visible.length) {
    const cell = body.appendChild(document.createElement('tr')).insertCell()
    cell.colSpan = headers.length || 4
    cell.className = 'empty'
    cell.textContent = emptyText()
  }

  table.replaceChildren(body)
  if (results) results.scrollTop = scroll
  if (hadFocus) focusRow(selected, false)
  renderDetail()
}

function focusRow(index: number, scroll: boolean) {
  const row = index === -1 ? null : table.querySelector<HTMLElement>(`tr[data-index="${index}"]`)
  if (!row) return
  row.focus({ preventScroll: !scroll })
  if (scroll) row.scrollIntoView({ block: 'nearest' })
}

function select(index: number, scroll: boolean) {
  if (frame) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  selected = index
  paint()
  focusRow(index, scroll)
}

function renderDetail() {
  if (!detail) return
  const row = rows[selected]
  const key = row ? JSON.stringify([row, rootPath.getAttribute('title'), saved]) : 'empty'
  if (selected === detailIndex && key === detailKey) return
  const scroll = selected === detailIndex ? detail.scrollTop : 0
  detailIndex = selected
  detailKey = key

  detail.hidden = !row
  if (!row) {
    detail.replaceChildren()
    return
  }

  const verdict = assessment(row)
  const title = element('h2')
  title.append(
    element('span', `badge ${verdict.className}`, verdict.text),
    document.createTextNode(` ${row.code} · level ${row.level}`),
  )

  const meta = element('dl', 'meta')
  const define = (term: string, value: string) => meta.append(element('dt', '', term), element('dd', '', value))
  define('Location', locationText(row))
  if (row.answer) define('Model confidence', row.answer.confidence)

  const context = row.snippet ? element('pre') : element('p', '', row.status === 'pending' || row.status === 'running'
    ? 'The source context has not been loaded yet.' : 'The source context is unavailable.')
  if (row.snippet) {
    for (const line of row.snippet.split('\n')) {
      context.append(element('span', line.startsWith('>>') ? 'target' : '', line))
    }
  }

  if (saved && !row.snippet) context.textContent = 'Source code was not included in this export.'
  if (!saved && !busy && rootPath.textContent && row.status === 'pending') {
    const index = selected
    void api.context(index).then(snippet => {
      if (!snippet) return
      const pre = element('pre')
      for (const line of snippet.split('\n')) pre.append(element('span', line.startsWith('>>') ? 'target' : '', line))
      context.replaceWith(pre)
    }).catch(() => { context.textContent = 'Source context is unavailable in this folder.' })
  }
  const nodes: Node[] = [title, element('p', '', row.message), meta]
  nodes.push(element('h3', '', 'Code context'), context)
  nodes.push(element('h3', '', row.status === 'error' && !row.answer ? 'Processing failure' : 'Model assessment'))
  if (row.answer) {
    nodes.push(element('p', '', verdictExplanations[row.answer.verdict]))
    nodes.push(element('p', '', row.answer.verdict === 'unsure'
      ? `What is missing: ${row.answer.reason}` : `Why: ${row.answer.reason}`))
  } else if (row.status === 'error') {
    nodes.push(element('p', '', statusExplanations.error))
    nodes.push(element('p', 'error', row.error ?? 'No error details were reported.'))
  } else {
    nodes.push(element('p', '', statusExplanations[row.status]))
  }

  if (row.positions.length > 1) {
    nodes.push(element('h3', '', 'Analyzer positions'))
    const list = element('ul')
    for (const position of row.positions) {
      const primary = position.file === row.file && position.line === row.line
      list.append(element('li', '', `${position.file}:${position.line}${primary ? ' (primary)' : ''}`))
    }
    nodes.push(list)
  }

  detail.replaceChildren(...nodes)
  detail.scrollTop = scroll
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
  element.textContent = path.split(/[\\/]/).filter(Boolean).pop() ?? path
  element.setAttribute('title', path)
}

async function choose(run: () => Promise<void>) {
  dialogOpen = true
  const report = reportPath.getAttribute('title')
  const root = rootPath.getAttribute('title')
  controls()
  try {
    await action(run)
  } finally {
    dialogOpen = false
    if (report !== reportPath.getAttribute('title') || root !== rootPath.getAttribute('title')) {
      phase = 'idle'
      selected = -1
    }
    controls()
    schedulePaint()
  }
}

for (const button of openFiles) {
  button.onclick = () => choose(async () => {
    button.closest('details')?.removeAttribute('open')
    const openSaved = button.dataset.open === 'saved'
    const path = await api.openReport(openSaved)
    if (!path) return
    saved = openSaved
    verdictFilter = ''
    phase = 'idle'
    selected = -1
    showPath(reportPath, path)
    showPath(rootPath)
    if (!saved && !availableModels.length) void loadModels()
  })
}
openRoot.onclick = () => choose(async () => showPath(rootPath, await api.openRoot()))
exportFormat.onchange = () => {
  const format = exportFormat.value
  exportFormat.value = ''
  if (format === 'csv' || format === 'json') void choose(() => api.save(format))
}

model.onchange = () => {
  if (model.value === 'manage') {
    updateModelList()
    manageModels()
  } else localStorage.setItem('model', model.value)
}
for (const chip of chips) {
  chip.onclick = () => {
    verdictFilter = chip.dataset.verdict!
    schedulePaint()
  }
}
headers.forEach((header, index) => {
  const button = header.querySelector('button')
  if (!button || !columns[index]) return
  button.onclick = () => {
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
  select(Number(index), false)
}
table.addEventListener('focusin', event => {
  const index = (event.target as Element).closest('tr')?.dataset.index
  if (index === undefined || Number(index) === selected) return
  selected = Number(index)
  schedulePaint()
})
table.onkeydown = event => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !visible.length) return
  event.preventDefault()
  const at = visible.indexOf(selected)
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? visible.length - 1
    : event.key === 'ArrowDown' ? (at < 0 ? 0 : Math.min(at + 1, visible.length - 1))
    : (at < 0 ? visible.length - 1 : Math.max(at - 1, 0))
  select(visible[next], true)
}

api.onUpdate(update => {
  if ('usage' in update) {
    usageOutput.textContent = update.usage
    return
  }
  if ('rows' in update) {
    rows = update.rows
    selected = -1
  } else {
    rows[update.index] = update.row
  }
  schedulePaint()
})

start.onclick = async () => {
  if (!concurrency.validity.valid) {
    byId('advanced').setAttribute('open', '')
    concurrency.reportValidity()
    return
  }
  byId('advanced').removeAttribute('open')
  busy = true
  phase = 'running'
  selected = -1
  controls()
  try {
    await action(() => api.start(model.value, concurrency.valueAsNumber, Number(maxLevel.value)))
    phase = error.textContent ? 'idle' : 'finished'
  } finally {
    busy = false
    controls()
    schedulePaint()
  }
}
stopButton.onclick = () => api.stop()

const applyTheme = (dark: boolean) => {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}
applyTheme((localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark')
api.onTheme(() => {
  const dark = document.documentElement.dataset.theme !== 'dark'
  localStorage.setItem('theme', dark ? 'dark' : 'light')
  applyTheme(dark)
})

function updateModelList() {
  const visibleModels = availableModels.filter(name => !hiddenModels.has(name))
  const preferred = localStorage.getItem('model')
  model.replaceChildren(...visibleModels.map(name => new Option(name, name)))
  if (!visibleModels.length) model.add(new Option('No visible models', ''))
  if (preferred && visibleModels.includes(preferred)) model.value = preferred
  model.add(new Option('Manage models…', 'manage'))
  controls()
}

const modelSearch = document.querySelector<HTMLInputElement>('#model-search')!
const modelCount = document.querySelector('#model-count')!
const selectModels = document.querySelector<HTMLButtonElement>('#models-select')!
const clearModels = document.querySelector<HTMLButtonElement>('#models-clear')!
const saveModels = document.querySelector<HTMLButtonElement>('#model-save')!
let draftHidden = new Set<string>()

function updateModelCount() {
  const count = availableModels.filter(name => !draftHidden.has(name)).length
  modelCount.textContent = `${count} of ${availableModels.length} selected`
  saveModels.disabled = !count
}

function showModelOptions() {
  const query = modelSearch.value.trim().toLowerCase()
  const matches = availableModels.filter(name => name.toLowerCase().includes(query))
  selectModels.textContent = query ? 'Select matches' : 'Select all'
  clearModels.textContent = query ? 'Clear matches' : 'Clear all'
  selectModels.disabled = clearModels.disabled = !matches.length
  modelOptions.replaceChildren()
  if (!matches.length) modelOptions.append(element('p', 'hint', 'No matching models.'))
  for (const name of matches) {
    const label = element('label')
    const checkbox = element('input')
    checkbox.type = 'checkbox'
    checkbox.checked = !draftHidden.has(name)
    checkbox.onchange = () => {
      if (checkbox.checked) draftHidden.delete(name)
      else draftHidden.add(name)
      updateModelCount()
    }
    label.append(checkbox, name)
    modelOptions.append(label)
  }
  selectModels.onclick = () => {
    for (const name of matches) draftHidden.delete(name)
    showModelOptions()
  }
  clearModels.onclick = () => {
    for (const name of matches) draftHidden.add(name)
    showModelOptions()
  }
  updateModelCount()
}

function manageModels() {
  draftHidden = new Set(hiddenModels)
  modelSearch.value = ''
  showModelOptions()
  modelSettings.showModal()
  modelSearch.focus()
}
modelSearch.oninput = showModelOptions
document.querySelector<HTMLButtonElement>('#model-cancel')!.onclick = () => modelSettings.close()
saveModels.onclick = () => {
  hiddenModels = draftHidden
  localStorage.setItem('hiddenModels', [...hiddenModels].join('\n'))
  updateModelList()
  modelSettings.close()
}

let loadingModels = false
async function loadModels() {
  if (loadingModels) return
  loadingModels = true
  try {
    availableModels = await api.models()
    if (!availableModels.length) throw new Error('OpenCode returned no models.')
    updateModelList()
  } catch (failure) {
    model.replaceChildren(new Option('No models available', ''))
    if (!saved) error.textContent = failure instanceof Error ? failure.message : String(failure)
  } finally {
    loadingModels = false
    controls()
  }
}
