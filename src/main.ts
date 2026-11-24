import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunUpdate } from './preload.ts'
import { buildPrompt, parseReport, runOpenCode, sourceSnippet, triage, type Row } from './triage.ts'

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
  models = [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(line => /^[^/\s]+\/[^\s]+$/.test(line)))]
  return models
})

ipcMain.handle('start', async (_event, model: string, concurrency: number, maxLevel: number) => {
  if (run) throw new Error('Triage is already running.')
  if (!report || !root) throw new Error('Choose a report and project root.')
  if (!models.includes(model)) throw new Error('Choose an available model.')
  // measured: above 8 the shared opencode service gets slower, not faster
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Concurrency must be from 1 to 8.')
  if (![1, 2, 3].includes(maxLevel)) throw new Error('Choose a maximum warning level from 1 to 3.')

  const projectRoot = root
  const controller = new AbortController()
  const { signal } = controller
  run = controller

  const send = (update: RunUpdate) => {
    if (!window.isDestroyed()) window.webContents.send('update', update)
  }

  try {
    rows = []
    send({ rows })
    rows = parseReport(await readFile(report, 'utf8'))
      .filter(warning => warning.level <= maxLevel)
      .map(warning => ({ ...warning, status: 'pending' }))
    send({ rows })

    let next = 0
    const worker = async () => {
      while (!signal.aborted && next < rows.length) {
        const index = next++
        const row = rows[index]
        row.status = 'running'
        send({ index, row })
        try {
          row.snippet = await sourceSnippet(projectRoot, row)
          row.answer = await triage(appRoot, model, buildPrompt(row, row.snippet), signal)
          row.status = 'done'
        } catch (error) {
          if (signal.aborted) {
            row.status = 'stopped'
          } else {
            row.status = 'error'
            row.error = error instanceof Error ? error.message : String(error)
          }
        }
        send({ index, row })
      }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker))
  } finally {
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
