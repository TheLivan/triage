import { execFile } from 'node:child_process'
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'

export const verdicts = ['bug', 'false_positive', 'unsure'] as const
const confidences = ['low', 'medium', 'high'] as const

export type Answer = {
  verdict: typeof verdicts[number]
  confidence: typeof confidences[number]
  reason: string
}

type Position = { file: string; line: number }
type Warning = Position & { code: string; level: number; message: string; positions: Position[] }
export type Row = Warning & {
  status: 'pending' | 'running' | 'done' | 'error' | 'stopped'
  snippet?: string
  answer?: Answer
  error?: string
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function parseReport(text: string): Warning[] {
  const { warnings } = object(JSON.parse(text.replace(/^\uFEFF/, '')))
  if (!Array.isArray(warnings)) throw new Error('Expected a warnings array in the report.')

  return parseWarnings(warnings)
}

function parseWarnings(warnings: unknown[]): Warning[] {
  const result: Warning[] = []
  for (const item of warnings) {
    const { code, level, message, positions } = object(item)
    if (typeof code !== 'string' || !code.trim() || typeof message !== 'string' ||
        typeof level !== 'number' || ![1, 2, 3].includes(level) || !Array.isArray(positions)) continue

    const valid: Position[] = []
    for (const position of positions) {
      const { file, line } = object(position)
      if (typeof file !== 'string' || !file.trim() || typeof line !== 'number' ||
          !Number.isSafeInteger(line) || line < 1) continue
      if (!valid.some(seen => seen.file === file && seen.line === line)) valid.push({ file, line })
    }
    if (valid.length) result.push({ code, level, message, ...valid[0], positions: valid })
  }
  return result
}

export const csvHeader = 'Code,Level,File:Line,Message,Verdict,Confidence,Reason,Status'

function csvRows(text: string): unknown[] {
  const newline = text.indexOf('\n')
  if ((newline < 0 ? text : text.slice(0, newline)).trimEnd() !== csvHeader) throw new Error('Expected a Triage Report CSV export.')
  const result: unknown[] = []
  const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r?\n|$)/gy
  field.lastIndex = newline < 0 ? text.length : newline + 1
  let cells: string[] = []
  while (field.lastIndex < text.length) {
    const match = field.exec(text)
    if (!match) throw new Error('Invalid CSV field.')
    cells.push((match[1]?.replaceAll('""', '"') ?? match[2]).replace(/^'(?=\s*[=+\-@]|[\t\r\n])/, ''))
    if (match[3] === ',') continue
    const [code, level, location, message, verdict, confidence, reason, status] = cells
    const position = /^(.*):(\d+)$/s.exec(location)
    if (cells.length !== 8 || !position) throw new Error('Invalid results CSV row.')
    result.push({ code, level: Number(level), message, positions: [{ file: position[1], line: Number(position[2]) }],
      status, answer: verdict ? { verdict, confidence, reason } : undefined, error: status === 'error' ? reason : undefined })
    cells = []
  }
  if (cells.length) throw new Error('Incomplete results CSV row.')
  return result
}

export function parseResults(text: string, csv: boolean): { rows: Row[]; usage: Usage } {
  text = text.replace(/^\uFEFF/, '')
  const data = csv ? { rows: csvRows(text), usage: noUsage } : object(JSON.parse(text))
  if (!Array.isArray(data.rows)) throw new Error('Expected an exported results file with a rows array.')
  const usage = { ...noUsage }
  for (const key of Object.keys(usage) as (keyof Usage)[]) {
    const value = object(data.usage)[key] ?? 0
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid token usage.')
    usage[key] = value
  }
  const rows = data.rows.map((item): Row => {
    const [warning] = parseWarnings([item])
    const { status, answer, error } = object(item)
    if (!warning || (status !== 'done' && status !== 'error' && status !== 'pending' && status !== 'running' && status !== 'stopped')
        || (error !== undefined && typeof error !== 'string')) throw new Error('Invalid warning in saved results.')
    return { ...warning, status: status === 'running' || status === 'pending' ? 'stopped' : status,
      answer: status === 'done' ? validateAnswer(answer) : undefined, error }
  })
  return { rows, usage }
}

function inside(root: string, target: string): boolean {
  const path = relative(root, target)
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path)
}

export async function sourcePath(root: string, file: string): Promise<string> {
  const requestedRoot = resolve(root)
  const actualRoot = await realpath(requestedRoot)
  const marked = file.startsWith('|?|')
  const source = marked ? file.slice(3).replace(/^[\\/]+/, '').replace(/[\\/]/g, sep) : file
  const requestedFile = resolve(requestedRoot, source)
  const outside = () => new Error('Source file is outside the project root.')
  if (!inside(requestedRoot, requestedFile) && !inside(actualRoot, requestedFile)) throw outside()

  const actualFile = await realpath(requestedFile).catch((error: NodeJS.ErrnoException) => {
    if (!marked || error.code !== 'ENOENT' || !inside(requestedRoot, requestedFile)) throw error
    const [first, ...rest] = relative(requestedRoot, requestedFile).split(sep)
    const name = basename(requestedRoot)
    const repeatsRoot = process.platform === 'win32' ? first.toLowerCase() === name.toLowerCase() : first === name
    if (!repeatsRoot || !rest.length) throw error
    return realpath(join(requestedRoot, ...rest))
  })
  if (!inside(actualRoot, actualFile)) throw outside()
  if (!(await stat(actualFile)).isFile()) throw new Error('Source path is not a file.')
  return actualFile
}

function linesAround(lines: readonly string[], line: number, radius: number): string {
  const start = Math.max(0, line - radius - 1)
  const end = Math.min(lines.length, line + radius)
  return lines.slice(start, end).map((text, index) => {
    const number = start + index + 1
    // minified lines would flood the prompt
    return `${number === line ? '>>' : '  '} ${number} | ${text.slice(0, 300)}`
  }).join('\n')
}

export async function sourceSnippet(root: string, warning: Warning): Promise<string> {
  const files = new Map<string, string[]>()
  const read = async (file: string) => {
    const cached = files.get(file)
    if (cached) return cached
    const lines = (await readFile(await sourcePath(root, file), 'utf8')).split(/\r\n|\n|\r/)
    files.set(file, lines)
    return lines
  }

  const primary = await read(warning.file)
  if (warning.line > primary.length) throw new Error('Warning line is outside the source file.')
  const parts = [linesAround(primary, warning.line, 30)]
  for (const { file, line } of warning.positions) {
    if (file === warning.file && line === warning.line) continue
    // a missing related file should not hide the primary snippet
    const lines = await read(file).catch(() => undefined)
    parts.push(`Related position: ${file}:${line}` + (lines && line <= lines.length
      ? '\n' + linesAround(lines, line, 3) : ' (source unavailable)'))
  }
  return parts.join('\n\n')
}

export function loadDiagnostics(appRoot: string): Map<string, string> {
  const guide = readFileSync(join(appRoot, 'DIAGNOSTICS.md'), 'utf8')
  const cards = new Map<string, string>()
  for (const section of guide.split(/^## /m).slice(1)) {
    const newline = section.indexOf('\n')
    const code = section.slice(0, newline).trim()
    const body = section.slice(newline + 1).trim()
    if (!/^V\d+$/.test(code) || newline < 0 || !body || cards.has(code)) {
      throw new Error(`Invalid diagnostic card in DIAGNOSTICS.md: ${code}`)
    }
    cards.set(code, body)
  }
  return cards
}

export function buildPrompt(warning: Warning, snippet: string, diagnostics: ReadonlyMap<string, string>): string {
  const diagnostic = diagnostics.get(warning.code.trim().toUpperCase())
  return [
    `Warning: ${warning.code} (level ${warning.level})`,
    `Message: ${warning.message.slice(0, 1000)}`,
    ...(diagnostic ? [diagnostic] : []),
    `File: ${warning.file}:${warning.line}`,
    '',
    snippet,
  ].join('\n')
}

export type BatchItem = { id: number; prompt: string }

export function buildBatchPrompt(batch: readonly BatchItem[]): string {
  return [
    'Triage each warning independently. Reply ONLY with a JSON array: [{"id": <n>, "verdict": ..., "confidence": ..., "reason": ...}, ...]. Use the id from each section.',
    ...batch.map(({ id, prompt }) => `### id=${id}\n${prompt}`),
  ].join('\n\n')
}

function parseAnswerJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i.exec(trimmed)
  try {
    return JSON.parse(fenced ? fenced[1] : trimmed)
  } catch {
    throw new Error('OpenCode answer is not valid JSON.')
  }
}

function validateAnswer(value: unknown): Answer {
  const { verdict, confidence, reason } = object(value)
  const validVerdict = verdicts.find(option => option === verdict)
  if (!validVerdict) throw new Error('OpenCode returned an invalid verdict.')
  const validConfidence = confidences.find(option => option === confidence)
  if (!validConfidence) throw new Error('OpenCode returned an invalid confidence.')
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('OpenCode returned an empty or invalid reason.')
  return { verdict: validVerdict, confidence: validConfidence, reason: reason.trim() }
}

export function parseAnswer(text: string): Answer {
  return validateAnswer(parseAnswerJson(text))
}

export function parseBatchAnswer(text: string, ids: readonly number[]): Map<number, Answer> {
  const answers = new Map<number, Answer>()
  let items: unknown
  try {
    items = parseAnswerJson(text)
  } catch {
    return answers
  }
  if (!Array.isArray(items)) return answers

  const seen = new Set<unknown>()
  for (const item of items) {
    const { id } = object(item)
    if (typeof id !== 'number' || !Number.isInteger(id) || !ids.includes(id) || seen.has(id)) continue
    seen.add(id)
    try {
      answers.set(id, validateAnswer(item))
    } catch {
      // Leave invalid rows for the single-warning path.
    }
  }
  return answers
}

const exec = promisify(execFile)

// output includes reasoning tokens: providers bill them at the output price
export type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type Price = Usage
export const noUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
// shortcut: OpenCode Go limits in USD copied from its docs in 2026-11; update if OpenCode changes them
export const goLimits = { '5h': 12, week: 30, month: 60 }

export function addUsage(a: Usage, b: Usage, scale = 1): Usage {
  return {
    input: a.input + b.input * scale, output: a.output + b.output * scale,
    cacheRead: a.cacheRead + b.cacheRead * scale, cacheWrite: a.cacheWrite + b.cacheWrite * scale,
  }
}

export function usageCost(usage: Usage, price: Price): number {
  return (usage.input * price.input + usage.output * price.output +
    usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite) / 1_000_000
}

export function usageOf(stdout: string): Usage {
  let usage = noUsage
  for (const event of events(stdout)) {
    if (event.type !== 'step_finish') continue
    const tokens = object(object(event.part).tokens)
    const cache = object(tokens.cache)
    const n = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
    usage = addUsage(usage, {
      input: n(tokens.input), output: n(tokens.output) + n(tokens.reasoning),
      cacheRead: n(cache.read), cacheWrite: n(cache.write),
    })
  }
  return usage
}

function events(stdout: string): Record<string, unknown>[] {
  return stdout.split('\n').flatMap(line => {
    try {
      return [object(JSON.parse(line))]
    } catch {
      return []
    }
  })
}

// opencode reports provider failures as JSONL error events on stdout, sometimes with exit code 0
export function eventError(stdout: string): string | undefined {
  for (const event of events(stdout)) {
    if (event.type !== 'error') continue
    const { message, data } = object(event.error)
    const text = typeof message === 'string' ? message : object(data).message
    return typeof text === 'string' && text.trim() ? text.trim().slice(0, 500) : 'OpenCode reported an error.'
  }
}

async function npmOpenCode(): Promise<string | undefined> {
  for (const entry of (process.env.PATH ?? '').split(';')) {
    const dir = entry.replace(/^"(.*)"$/, '$1')
    if (!isAbsolute(dir)) continue
    const binary = resolve(dir, 'node_modules', '@opencode', 'cli', 'bin', 'opencode.exe')
    if ((await stat(binary).catch(() => undefined))?.isFile()) return binary
  }
}

export async function runOpenCode(appRoot: string, args: string[], signal?: AbortSignal, timeout = 60_000, input = ''): Promise<string> {
  const env: NodeJS.ProcessEnv & { PWD: string } = { ...process.env, PWD: appRoot }
  if (basename(appRoot) === 'app.asar') {
    env.PWD = dirname(appRoot)
    env.OPENCODE_CONFIG_CONTENT = await readFile(join(appRoot, 'opencode.json'), 'utf8')
  }
  const run = (binary: string) => {
    // opencode resolves its project config from PWD, not the process cwd
    const running = exec(binary, args, {
      cwd: env.PWD, env, signal, timeout, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
    })
    // the prompt goes through stdin: Windows caps a command line at 32K characters
    running.child.stdin?.on('error', () => {}).end(input)
    return running
  }
  try {
    const { stdout } = await run('opencode').catch(async (error: NodeJS.ErrnoException) => {
      if (process.platform !== 'win32' || error.code !== 'ENOENT' || signal?.aborted) throw error
      const binary = await npmOpenCode()
      if (!binary) throw error
      return run(binary)
    })
    return stdout
  } catch (error) {
    const { code, killed, stdout, stderr } = error as NodeJS.ErrnoException & { killed?: boolean; stdout?: string; stderr?: string }
    if (signal?.aborted) throw error
    // failed calls keep their stdout: the tokens they streamed were billed
    const fail = (message: string, name = 'Error') => Object.assign(new Error(message), { name, stdout: stdout ?? '' })
    if (code === 'ENOENT') {
      throw fail(process.platform === 'win32'
        ? 'OpenCode was not found. Add opencode.exe to PATH or install @opencode/cli globally and add the npm global directory to PATH.'
        : 'OpenCode was not found on PATH.')
    }
    if (killed && !code) throw fail(`OpenCode timed out after ${timeout / 1000} seconds.`, 'TimeoutError')
    const reported = eventError(stdout ?? '')
    if (reported) throw fail(reported)
    throw fail(stderr?.trim().slice(0, 500) || `OpenCode failed (${code ?? 'process terminated'}).`)
  }
}

type OnUsage = (usage: Usage) => void

async function requestAnswer(cwd: string, model: string, prompt: string, signal: AbortSignal, onUsage: OnUsage, timeout?: number): Promise<string> {
  signal.throwIfAborted()
  const args = ['run', '--archived', '--format', 'json', '--agent', 'triage', '-m', model]
  let stdout: string
  try {
    stdout = await runOpenCode(cwd, args, signal, timeout, prompt)
  } catch (error) {
    onUsage(usageOf((error as { stdout?: string }).stdout ?? ''))
    throw error
  }
  onUsage(usageOf(stdout))
  const error = eventError(stdout)
  if (error) throw new Error(error)
  return events(stdout).map(event => event.type === 'text' ? object(event.part).text : undefined)
    .filter(part => typeof part === 'string').join('')
}

export async function triageBatch(cwd: string, model: string, batch: readonly BatchItem[], signal: AbortSignal, onUsage: OnUsage): Promise<Map<number, Answer>> {
  // local ids 1..n: a model that renumbers its answers cannot hit another row
  const local = batch.map(({ prompt }, index) => ({ id: index + 1, prompt }))
  let answer: string
  try {
    answer = await requestAnswer(cwd, model, buildBatchPrompt(local), signal, onUsage, 60_000 + 20_000 * (batch.length - 1))
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') return new Map()
    throw error
  }
  const answers = parseBatchAnswer(answer, local.map(({ id }) => id))
  return new Map([...answers].map(([id, value]) => [batch[id - 1].id, value]))
}

export async function triage(cwd: string, model: string, prompt: string, signal: AbortSignal, onUsage: OnUsage): Promise<Answer> {
  // retry a stalled provider stream or a malformed answer once; other failures are deterministic
  for (let attempt = 1; ; attempt++) {
    let answer: string
    try {
      answer = await requestAnswer(cwd, model, prompt, signal, onUsage)
    } catch (error) {
      if (attempt < 2 && error instanceof Error && error.name === 'TimeoutError') continue
      throw error
    }
    try {
      return parseAnswer(answer)
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}
