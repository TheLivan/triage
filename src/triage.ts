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
    `Message: ${warning.message}`,
    `File: ${warning.file}:${warning.line}`,
    '',
    snippet,
  ].join('\n')
}

export function parseAnswer(text: string): Answer {
  const trimmed = text.trim()
  const fenced = /^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i.exec(trimmed)
  let value: unknown
  try {
    value = JSON.parse(fenced ? fenced[1] : trimmed)
  } catch {
    throw new Error('OpenCode answer is not valid JSON.')
  }

  const { verdict, confidence, reason } = object(value)
  const validVerdict = verdicts.find(option => option === verdict)
  if (!validVerdict) throw new Error('OpenCode returned an invalid verdict.')
  const validConfidence = confidences.find(option => option === confidence)
  if (!validConfidence) throw new Error('OpenCode returned an invalid confidence.')
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('OpenCode returned an empty or invalid reason.')
  return { verdict: validVerdict, confidence: validConfidence, reason: reason.trim() }
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

export async function runOpenCode(cwd: string, args: string[], signal?: AbortSignal): Promise<string> {
  try {
    // opencode resolves its project config from PWD, not the process cwd
    const { stdout } = await exec('opencode', args, {
      cwd, env: { ...process.env, PWD: cwd }, signal, timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024,
    })
    return stdout
  } catch (error) {
    const { code, killed, stdout, stderr } = error as NodeJS.ErrnoException & { killed?: boolean; stdout?: string; stderr?: string }
    if (signal?.aborted) throw error
    if (code === 'ENOENT') throw new Error('OpenCode was not found on PATH.')
    if (killed && !code) throw Object.assign(new Error('OpenCode timed out after 1 minute.'), { name: 'TimeoutError' })
    throw new Error(eventError(stdout ?? '') || stderr?.trim().slice(0, 500) || `OpenCode failed (${code ?? 'process terminated'}).`)
  }
}

export async function triage(cwd: string, model: string, prompt: string, signal: AbortSignal): Promise<Answer> {
  const args = ['run', '--archived', '--format', 'json', '--agent', 'triage', '-m', model, prompt]
  const text = async () => {
    signal.throwIfAborted()
    const stdout = await runOpenCode(cwd, args, signal)
    const error = eventError(stdout)
    if (error) throw new Error(error)
    return events(stdout).map(event => event.type === 'text' ? object(event.part).text : undefined)
      .filter(part => typeof part === 'string').join('')
  }

  // retry a stalled provider stream or a malformed answer once; other failures are deterministic
  for (let attempt = 1; ; attempt++) {
    let answer: string
    try {
      answer = await text()
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
