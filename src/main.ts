import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItem } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { RunUpdate } from './preload.ts'
import {
  addUsage, buildPrompt, loadDiagnostics, csvHeader, parseResults, goLimits, noUsage, parseReport, runOpenCode, sourceSnippet, triage, triageBatch, usageCost,
  type BatchItem, type Price, type Row, type Usage,
} from './triage.ts'

const appRoot = app.getAppPath()
const diagnostics = loadDiagnostics(appRoot)
let window: BrowserWindow
let report: string | undefined
let root: string | undefined
let models: string[] = []
let rows: Row[] = []
let usage = noUsage
const prices = new Map<string, Price>()
let run: AbortController | undefined

let warnings: ReturnType<typeof parseReport> = []

function previewReport() {
  rows = warnings.map(warning => ({ ...warning, status: 'pending' }))
  usage = noUsage
  window.webContents.send('update', { rows })
  window.webContents.send('update', { usage: '' })
}

const tokens = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
const percent = (cost: number, limit: number) => `${(cost / limit * 100).toFixed(1)}%`

function usageText(total: Usage, model: string): string {
  const text = `Tokens: ${tokens(total.input + total.cacheRead + total.cacheWrite)} in / ${tokens(total.output)} out`
  const price = prices.get(model.split('#')[0])
  if (!price) return text
  const cost = usageCost(total, price)
  const go = model.startsWith('opencode-go/') ? ` (${percent(cost, goLimits['5h'])} of Go 5h limit)` : ''
  return `${text} ≈ $${cost.toFixed(2)}${go}`
}

async function confirmEstimate(model: string, billed: number, total: number): Promise<boolean> {
  const estimate = addUsage(noUsage, usage, total / billed)
  const sum = estimate.input + estimate.output + estimate.cacheRead + estimate.cacheWrite
  const price = prices.get(model.split('#')[0])
  let cost = 'Cost unknown: this model is billed by a plan whose limit OpenCode does not report.'
  if (!sum) cost = 'Usage unknown: OpenCode reported no tokens for the probe.'
  else if (price) {
    const usd = usageCost(estimate, price)
    cost = `≈ $${usd.toFixed(2)}`
    if (model.startsWith('opencode-go/')) {
      cost += `\n≈ ${percent(usd, goLimits['5h'])} of the Go 5-hour limit, ${percent(usd, goLimits.week)} weekly, ${percent(usd, goLimits.month)} monthly`
    }
  }
  const { response } = await dialog.showMessageBox(window, {
    type: 'question', buttons: ['Continue', 'Cancel'], defaultId: 0, cancelId: 1,
    message: `Triage all ${total} warnings?`,
    detail: `Estimated from ${billed} warnings sent to the model: ≈ ${tokens(sum)} tokens.\n${cost}`,
  })
  return response === 0
}

ipcMain.handle('open-report', async (_event, saved: boolean) => {
  if (run) throw new Error('Stop triage before opening a file.')
  const { filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openFile'], filters: [saved ? { name: 'Saved results', extensions: ['json', 'csv'] }
      : { name: 'PVS-Studio report', extensions: ['json'] }],
  })
  const path = filePaths[0]
  if (!path) return
  const text = await readFile(path, 'utf8')
  if (saved) {
    const imported = parseResults(text, extname(path).toLowerCase() === '.csv')
    rows = imported.rows
    usage = imported.usage
    warnings = []
    report = undefined
    window.webContents.send('update', { rows })
    window.webContents.send('update', { usage: Object.values(usage).some(Boolean) ? usageText(usage, '') : '' })
  } else {
    warnings = parseReport(text)
    report = path
    previewReport()
  }
  root = undefined
  return path
})

ipcMain.handle('open-root', async () => {
  if (run || !report) throw new Error('Open a report before choosing its source folder.')
  const { filePaths } = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
  if (filePaths[0] && filePaths[0] !== root) { root = filePaths[0]; previewReport() }
  return root
})

ipcMain.handle('context', async (_event, index: number) => {
  if (!root || !Number.isSafeInteger(index) || !rows[index]) return
  return sourceSnippet(root, rows[index])
})

ipcMain.handle('models', async () => {
  const output = await runOpenCode(appRoot, ['models'])
  const base = [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(line => /^[^/\s]+\/[^\s]+$/.test(line)))]
  const variants = new Map<string, string[]>()
  try {
    const metadata = await runOpenCode(appRoot, ['api', 'model.list'])
    const { data } = JSON.parse(metadata) as {
      data: {
        providerID: string; id: string; variants: { id: string }[]
        cost: { input: number; output: number; cache?: { read?: number; write?: number } }[]
      }[]
    }
    for (const { providerID, id, variants: modelVariants, cost } of data) {
      const [price] = cost ?? []
      // plan-billed models may list an all-zero price; treat that as unknown, not free
      if (price && (price.input || price.output)) {
        prices.set(`${providerID}/${id}`, {
          input: price.input, output: price.output, cacheRead: price.cache?.read ?? 0, cacheWrite: price.cache?.write ?? 0,
        })
      }
      const fast = ['none', 'low'].filter(name => modelVariants?.some(variant => variant.id === name))
      if (fast.length) variants.set(`${providerID}/${id}`, fast)
    }
  } catch {
    // Older OpenCode versions may only support the plain model list.
  }
  models = base.flatMap(id => [id, ...(variants.get(id) ?? []).map(name => `${id}#${name}`)])
  return models
})

ipcMain.handle('start', async (_event, model: string, concurrency: number, maxLevel: number) => {
  if (run) throw new Error('Triage is already running.')
  if (!report || !root) throw new Error('Choose a report and project root.')
  if (!models.includes(model)) throw new Error('Choose an available model.')
  // measured: OpenAI fast models scale to 16; slow providers stall earlier, so the user tunes it
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Concurrency must be from 1 to 16.')
  if (![1, 2, 3].includes(maxLevel)) throw new Error('Choose a maximum warning level from 1 to 3.')

  const projectRoot = root
  const controller = new AbortController()
  const { signal } = controller
  run = controller

  const send = (update: RunUpdate) => {
    try {
      if (!window.isDestroyed()) window.webContents.send('update', update)
    } catch {
      // the window can be destroyed between the check and the send on quit
    }
  }
  let runRows: Row[] = []
  const updateRow = (index: number, update: Partial<Row>) => {
    const row = Object.assign(runRows[index], update)
    send({ index, row })
  }
  const onUsage = (call: Usage) => {
    usage = addUsage(usage, call)
    send({ usage: usageText(usage, model) })
  }
  const fail = (index: number, error: unknown) => {
    if (!signal.aborted) {
      updateRow(index, { status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  try {
    rows = []
    usage = noUsage
    send({ rows })
    send({ usage: '' })
    rows = warnings
      .filter(warning => warning.level <= maxLevel)
      .map(warning => ({ ...warning, status: 'pending' }))
    runRows = rows
    send({ rows })

    let next = 0
    const runBatch = async () => {
      const end = Math.min(next + 5, runRows.length)
      const start = next
      next = end
      const batch: BatchItem[] = []
      for (let id = start; id < end; id++) updateRow(id, { status: 'running' })
      for (let id = start; id < end && !signal.aborted; id++) {
        const row = runRows[id]
        try {
          row.snippet = await sourceSnippet(projectRoot, row)
          batch.push({ id, prompt: buildPrompt(row, row.snippet, diagnostics) })
        } catch (error) {
          fail(id, error)
        }
      }
      if (signal.aborted || !batch.length) return

      // one-row and oversized batches go straight to single calls
      const batchable = batch.length > 1 && Buffer.byteLength(batch.map(({ prompt }) => prompt).join('')) < 100_000
      let answers
      try {
        answers = batchable ? await triageBatch(appRoot, model, batch, signal, onUsage) : new Map()
      } catch (error) {
        for (const { id } of batch) fail(id, error)
        return
      }
      if (signal.aborted) return
      for (const [id, answer] of answers) updateRow(id, { status: 'done', answer })
      for (const { id, prompt } of batch) {
        if (signal.aborted) return
        if (answers.has(id)) continue
        try {
          const answer = await triage(appRoot, model, prompt, signal, onUsage)
          if (!signal.aborted) updateRow(id, { status: 'done', answer })
        } catch (error) {
          fail(id, error)
        }
      }
    }
    const worker = async () => {
      while (!signal.aborted && next < runRows.length) await runBatch()
    }

    // probe batches until one reaches the model; their usage drives the estimate the user confirms
    let sent: Row[] = []
    while (!signal.aborted && next < runRows.length && !sent.length) {
      await runBatch()
      sent = runRows.slice(0, next).filter(row => row.snippet !== undefined)
    }
    if (!signal.aborted && next < runRows.length) {
      if (sent.every(row => row.status === 'error')) controller.abort()
      else if (!(await confirmEstimate(model, sent.length, runRows.length).catch(() => false))) controller.abort()
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, runRows.length) }, worker))
  } finally {
    if (signal.aborted) {
      runRows.forEach((row, index) => {
        if (row.status === 'pending' || row.status === 'running') updateRow(index, { status: 'stopped' })
      })
    }
    run = undefined
  }
})

ipcMain.on('stop', () => run?.abort())

function csvCell(value: string | number | undefined): string {
  let text = String(value ?? '')
  if (typeof value === 'string' && /^(?:\s*[=+\-@]|[\t\r\n])/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

ipcMain.handle('save', async (_event, format: string) => {
  if (format !== 'json' && format !== 'csv') throw new Error('Choose CSV or JSON.')
  const { filePath } = await dialog.showSaveDialog(window, {
    defaultPath: `triage-results.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }],
  })
  if (!filePath) return

  if (format === 'json') {
    const exported = { usage, rows: rows.map(({ snippet, ...row }) => row) }
    await writeFile(filePath, JSON.stringify(exported, null, 2) + '\n', 'utf8')
    return
  }

  const records = rows.map(row => [
    row.code, row.level, `${row.file}:${row.line}`, row.message,
    row.answer?.verdict, row.answer?.confidence, row.answer?.reason ?? row.error, row.status,
  ].map(csvCell).join(','))
  await writeFile(filePath, [csvHeader, ...records].join('\r\n') + '\r\n', 'utf8')
})

app.whenReady().then(async () => {
  const icon = join(appRoot, 'icon.png')
  app.dock?.setIcon(icon)
  window = new BrowserWindow({
    width: 1250,
    height: 790,
    icon,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  const view = Menu.getApplicationMenu()?.items.find(item => item.role?.toLowerCase() === 'viewmenu' || item.label === 'View')?.submenu
  view?.append(new MenuItem({ type: 'separator' }))
  view?.append(new MenuItem({ label: 'Toggle light/dark theme', click: () => window.webContents.send('toggle-theme') }))
  await window.loadFile(join(appRoot, 'index.html'))
}).catch(error => {
  console.error(error)
  app.quit()
})

app.on('before-quit', () => run?.abort())
app.on('window-all-closed', () => app.quit())
