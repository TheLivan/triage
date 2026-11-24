import { execFile } from 'node:child_process'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

export const verdicts = ['bug', 'false_positive', 'wont_fix', 'unsure'] as const
const confidences = ['low', 'medium', 'high'] as const

export type Answer = {
  verdict: typeof verdicts[number]
  confidence: typeof confidences[number]
  reason: string
}

type Warning = { code: string; level: number; message: string; file: string; line: number }
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

  const result: Warning[] = []
  for (const item of warnings) {
    const { code, level, message, positions } = object(item)
    if (typeof code !== 'string' || !code.trim() || typeof message !== 'string' ||
        typeof level !== 'number' || ![1, 2, 3].includes(level) || !Array.isArray(positions)) continue

    for (const position of positions) {
      const { file, line } = object(position)
      if (typeof file !== 'string' || !file.trim() || typeof line !== 'number' ||
          !Number.isSafeInteger(line) || line < 1) continue
      result.push({ code, level, message, file, line })
      break
    }
  }
  return result
}

function inside(root: string, target: string): boolean {
  const path = relative(root, target)
  return path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path)
}

export async function sourcePath(root: string, file: string): Promise<string> {
  const requestedRoot = resolve(root)
  const actualRoot = await realpath(requestedRoot)
  const requestedFile = resolve(requestedRoot, file)
  const outside = () => new Error('Source file is outside the project root.')
  if (!inside(requestedRoot, requestedFile) && !inside(actualRoot, requestedFile)) throw outside()

  const actualFile = await realpath(requestedFile)
  if (!inside(actualRoot, actualFile)) throw outside()
  if (!(await stat(actualFile)).isFile()) throw new Error('Source path is not a file.')
  return actualFile
}

export async function sourceSnippet(root: string, warning: Warning): Promise<string> {
  const path = await sourcePath(root, warning.file)
  const lines = (await readFile(path, 'utf8')).split(/\r\n|\n|\r/)
  if (warning.line > lines.length) throw new Error('Warning line is outside the source file.')

  const start = Math.max(0, warning.line - 31)
  const end = Math.min(lines.length, warning.line + 30)
  return lines.slice(start, end).map((line, index) => {
    const number = start + index + 1
    // minified lines would blow the argv limit
    return `${number === warning.line ? '>>' : '  '} ${number} | ${line.slice(0, 300)}`
  }).join('\n')
}

export function buildPrompt(warning: Warning, snippet: string): string {
  return [
    `Warning: ${warning.code} (level ${warning.level})`,
    `Message: ${warning.message.slice(0, 1000)}`,
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

export async function runOpenCode(cwd: string, args: string[], signal?: AbortSignal, timeout = 60_000): Promise<string> {
  try {
    // opencode resolves its project config from PWD, not the process cwd
    const { stdout } = await exec('opencode', args, {
      cwd, env: { ...process.env, PWD: cwd }, signal, timeout, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const { code, killed, stdout, stderr } = error as NodeJS.ErrnoException & { killed?: boolean; stdout?: string; stderr?: string }
    if (signal?.aborted) throw error
    if (code === 'ENOENT') throw new Error('OpenCode was not found on PATH.')
    if (killed && !code) throw Object.assign(new Error(`OpenCode timed out after ${timeout / 1000} seconds.`), { name: 'TimeoutError' })
    const reported = eventError(stdout ?? '')
    if (reported) throw new Error(reported)
    throw new Error(stderr?.trim().slice(0, 500) || `OpenCode failed (${code ?? 'process terminated'}).`)
  }
}

async function requestAnswer(cwd: string, model: string, prompt: string, signal: AbortSignal, timeout?: number): Promise<string> {
  signal.throwIfAborted()
  const args = ['run', '--archived', '--format', 'json', '--agent', 'triage', '-m', model, prompt]
  const stdout = await runOpenCode(cwd, args, signal, timeout)
  const error = eventError(stdout)
  if (error) throw new Error(error)
  return events(stdout).map(event => event.type === 'text' ? object(event.part).text : undefined)
    .filter(part => typeof part === 'string').join('')
}

export async function triageBatch(cwd: string, model: string, batch: readonly BatchItem[], signal: AbortSignal): Promise<Map<number, Answer>> {
  // local ids 1..n: a model that renumbers its answers cannot hit another row
  const local = batch.map(({ prompt }, index) => ({ id: index + 1, prompt }))
  let answer: string
  try {
    answer = await requestAnswer(cwd, model, buildBatchPrompt(local), signal, 60_000 + 20_000 * (batch.length - 1))
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') return new Map()
    throw error
  }
  const answers = parseBatchAnswer(answer, local.map(({ id }) => id))
  return new Map([...answers].map(([id, value]) => [batch[id - 1].id, value]))
}

export async function triage(cwd: string, model: string, prompt: string, signal: AbortSignal): Promise<Answer> {
  // retry a stalled provider stream or a malformed answer once; other failures are deterministic
  for (let attempt = 1; ; attempt++) {
    let answer: string
    try {
      answer = await requestAnswer(cwd, model, prompt, signal)
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
