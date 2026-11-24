import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunUpdate } from './preload.ts'
import { buildPrompt, parseReport, runOpenCode, sourceSnippet, triage, triageBatch, type BatchItem, type Row } from './triage.ts'

const appRoot = app.getAppPath()
let window: BrowserWindow
let report: string | undefined
let root: string | undefined
let models: string[] = []
let rows: Row[] = []
let run: AbortController | undefined

function clear() {
  if (run) return
  rows = []
  window.webContents.send('update', { rows })
}

ipcMain.handle('open-report', async () => {
  const { filePaths } = await dialog.showOpenDialog(window, {
    properties: ['openFile'], filters: [{ name: 'JSON report', extensions: ['json'] }],
  })
  if (filePaths.length) { report = filePaths[0]; clear() }
  return report
})

ipcMain.handle('open-root', async () => {
  const { filePaths } = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
  if (filePaths.length) { root = filePaths[0]; clear() }
  return root
})

ipcMain.handle('models', async () => {
  const output = await runOpenCode(appRoot, ['models'])
  const base = [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(line => /^[^/\s]+\/[^\s]+$/.test(line)))]
  // fast variants: 'none' skips reasoning, 'low' keeps a little
  const variants = new Map<string, string[]>()
  try {
    const metadata = await runOpenCode(appRoot, ['api', 'model.list'])
    const { data } = JSON.parse(metadata) as {
      data: { providerID: string; id: string; variants: { id: string }[] }[]
    }
    for (const { providerID, id, variants: modelVariants } of data) {
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
  const fail = (index: number, error: unknown) => {
    if (!signal.aborted) {
      updateRow(index, { status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  try {
    rows = []
    send({ rows })
    rows = parseReport(await readFile(report, 'utf8'))
      .filter(warning => warning.level <= maxLevel)
      .map(warning => ({ ...warning, status: 'pending' }))
    runRows = rows
    send({ rows })

    let next = 0
    const worker = async () => {
      while (!signal.aborted && next < runRows.length) {
        const end = Math.min(next + 5, runRows.length)
        const start = next
        next = end
        const batch: BatchItem[] = []
        for (let id = start; id < end; id++) updateRow(id, { status: 'running' })
        for (let id = start; id < end && !signal.aborted; id++) {
          const row = runRows[id]
          try {
            row.snippet = await sourceSnippet(projectRoot, row)
            batch.push({ id, prompt: buildPrompt(row, row.snippet) })
          } catch (error) {
            fail(id, error)
          }
        }
        if (signal.aborted || !batch.length) continue

        // one-row and oversized batches go straight to single calls; the prompt is one argv entry
        const batchable = batch.length > 1 && Buffer.byteLength(batch.map(({ prompt }) => prompt).join('')) < 100_000
        let answers
        try {
          answers = batchable ? await triageBatch(appRoot, model, batch, signal) : new Map()
        } catch (error) {
          for (const { id } of batch) fail(id, error)
          continue
        }
        if (signal.aborted) return
        for (const [id, answer] of answers) updateRow(id, { status: 'done', answer })
        for (const { id, prompt } of batch) {
          if (signal.aborted) return
          if (answers.has(id)) continue
          try {
            const answer = await triage(appRoot, model, prompt, signal)
            if (!signal.aborted) updateRow(id, { status: 'done', answer })
          } catch (error) {
            fail(id, error)
          }
        }
      }
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
    await writeFile(filePath, JSON.stringify(rows.map(({ snippet, ...row }) => row), null, 2) + '\n', 'utf8')
    return
  }

  const records = rows.map(row => [
    row.code, row.level, `${row.file}:${row.line}`, row.message,
    row.answer?.verdict, row.answer?.confidence, row.answer?.reason ?? row.error, row.status,
  ].map(csvCell).join(','))
  await writeFile(filePath, ['Code,Level,File:Line,Message,Verdict,Confidence,Reason,Status', ...records].join('\r\n') + '\r\n', 'utf8')
})

app.whenReady().then(async () => {
  window = new BrowserWindow({
    width: 1250,
    height: 790,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  await window.loadFile(join(appRoot, 'index.html'))
}).catch(error => {
  console.error(error)
  app.quit()
})

app.on('before-quit', () => run?.abort())
app.on('window-all-closed', () => app.quit())
