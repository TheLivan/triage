import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { addUsage, buildBatchPrompt, buildPrompt, loadDiagnostics, eventError, noUsage, usageCost, usageOf, parseAnswer, parseBatchAnswer, parseReport, parseResults, csvHeader, sourcePath, sourceSnippet, triage } from '../src/triage.ts'

const diagnostics = loadDiagnostics(join(import.meta.dirname, '..'))

test('parses every valid position and skips warnings without one', () => {
  const warning = { code: 'V501', level: 1, message: 'Duplicate operands' }
  assert.deepEqual(parseReport(JSON.stringify({
    warnings: [
      {
        ...warning,
        positions: [
          { file: 'bad.cpp', line: 0 }, { file: 'main.cpp', line: 42 },
          { file: 'main.cpp', line: 42 }, { file: 'other.cpp', line: 7 },
        ],
      },
      warning,
      { ...warning, positions: [] },
      { ...warning, positions: [{ file: 'bad.cpp', line: '42' }] },
      null,
    ],
  })), [{
    ...warning, file: 'main.cpp', line: 42,
    positions: [{ file: 'main.cpp', line: 42 }, { file: 'other.cpp', line: 7 }],
  }])
  assert.throws(() => parseReport('{}'), /warnings array/)
})

test('validates plain and fenced answers', () => {
  const answer = { verdict: 'bug', confidence: 'high', reason: 'The operands are identical.' }
  const json = JSON.stringify(answer)
  assert.deepEqual(parseAnswer(json), answer)
  assert.deepEqual(parseAnswer('\x60\x60\x60json\n' + json + '\n\x60\x60\x60'), answer)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, verdict: 'probably' })), /invalid verdict/)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, verdict: 'wont_fix' })), /invalid verdict/)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, confidence: 'certain' })), /invalid confidence/)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, reason: ' ' })), /reason/)
  assert.throws(() => parseAnswer('garbage'), /not valid JSON/)
})

test('builds a batch prompt with the original prompt in each id section', () => {
  const warning = {
    code: 'V501', level: 1, message: 'Test', file: 'main.cpp', line: 33,
    positions: [{ file: 'main.cpp', line: 33 }],
  }
  const first = buildPrompt(warning, '>> 33 | first', diagnostics)
  const second = buildPrompt({ ...warning, code: ' v522 ', line: 42 }, '>> 42 | second', diagnostics)
  const [instruction, ...sections] = buildBatchPrompt([
    { id: 3, prompt: first }, { id: 7, prompt: second },
  ]).split('\n\n### ')

  assert.match(instruction, /independently.*ONLY with a JSON array/)
  assert.deepEqual(sections, [`id=3\n${first}`, `id=7\n${second}`])
  assert.match(sections[0], /PVS-Studio diagnostic: Identical expressions/)
  assert.match(sections[1], /PVS-Studio diagnostic: A reachable path may dereference a null pointer/)
  assert.match(second, /^Possible false-positive patterns .*callee contract/m)
  assert.equal(buildPrompt({ ...warning, code: 'V99999' }, '>> 33 | first', diagnostics), [
    'Warning: V99999 (level 1)',
    'Message: Test',
    'PVS-Studio diagnostic: No curated card for this code; treat the message above as the analyzer text.',
    '',
    'Possible false-positive patterns (verify against the code): Compare the message with the PVS-Studio documentation for this code, then confirm the reported condition can actually occur on every relevant path.',
    'File: main.cpp:33',
    '',
    '>> 33 | first',
  ].join('\n'))
})

test('covers every PVS-Studio Java diagnostic code', () => {
  for (let code = 6001; code <= 6136; code++) assert.ok(diagnostics.has(`V${code}`), `missing card for V${code}`)
})

const batchAnswer = { verdict: 'bug', confidence: 'high', reason: 'The operands are identical.' }

test('includes rule-specific evidence for redundant assignments and expressions', () => {
  const warning = { code: 'V1048', level: 2, message: 'Test', file: 'main.cpp', line: 1, positions: [] }
  assert.match(buildPrompt(warning, '>> 1 | if (x == 0) x = 0;', diagnostics), /volatile write/)
  assert.match(buildPrompt({ ...warning, code: 'V1065' }, '>> 1 | return x - x + y;', diagnostics), /redundancy is real.*use unsure/)
})

test('includes Java reference identity evidence in a V6013 prompt', () => {
  const warning = { code: 'V6013', level: 2, message: 'Check comparison', file: 'Token.java', line: 8, positions: [] }
  const prompt = buildPrompt(warning, '>> 8 | return input == END;', diagnostics)
  assert.match(prompt, /^PVS-Studio diagnostic: .*reference identity/m)
  assert.match(prompt, /^Possible false-positive patterns .*both strings are interned/m)
})

test('parses plain and fenced batch arrays and rejects non-arrays', () => {
  const json = JSON.stringify([{ ...batchAnswer, id: 7 }, { ...batchAnswer, id: 3 }])
  const expected = new Map([[7, batchAnswer], [3, batchAnswer]])
  assert.deepEqual(parseBatchAnswer(json, [3, 7]), expected)
  assert.deepEqual(parseBatchAnswer('\x60\x60\x60json\n' + json + '\n\x60\x60\x60', [3, 7]), expected)
  assert.deepEqual(parseBatchAnswer(JSON.stringify({ ...batchAnswer, id: 3 }), [3, 7]), new Map())
  assert.deepEqual(parseBatchAnswer('garbage', [3, 7]), new Map())
})

test('keeps valid batch answers and ignores invalid elements and ids', () => {
  const json = JSON.stringify([
    batchAnswer,
    { ...batchAnswer, id: 3 },
    { ...batchAnswer, id: 3, reason: 'Duplicate answer.' },
    { ...batchAnswer, id: 99 },
    { ...batchAnswer, id: '5' },
    { ...batchAnswer, id: 4.5 },
    { ...batchAnswer, id: 5, confidence: 'certain' },
    { ...batchAnswer, id: 7, reason: '  The operands are identical.  ' },
  ])
  assert.deepEqual(parseBatchAnswer(json, [3, 5, 7]), new Map([[3, batchAnswer], [7, batchAnswer]]))
  const invalidFirst = JSON.stringify([{ ...batchAnswer, id: 7, verdict: 'maybe' }, { ...batchAnswer, id: 7 }])
  assert.deepEqual(parseBatchAnswer(invalidFirst, [7]), new Map())
})

test('guards source paths and builds a marked snippet', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'triage-test-'))
  t.after(() => rm(temp, { recursive: true, force: true }))
  const root = join(temp, 'project')
  const file = join(root, 'main.cpp')
  const outsideDir = join(temp, 'outside')
  const outside = join(outsideDir, 'private.cpp')
  await mkdir(root)
  await mkdir(outsideDir)
  await writeFile(file, Array.from({ length: 65 }, (_, i) => `line ${i + 1}`).join('\n'))
  await writeFile(outside, 'outside')
  await symlink(outsideDir, join(root, 'linked'), 'junction')

  assert.equal(await sourcePath(root, 'main.cpp'), await realpath(file))
  assert.equal(await sourcePath(root, file), await realpath(file))
  assert.equal(await sourcePath(root, '|?|main.cpp'), await realpath(file))
  assert.equal(await sourcePath(root, '|?|\\project\\main.cpp'), await realpath(file))
  assert.equal(await sourcePath(temp, '|?|/project/main.cpp'), await realpath(file))
  await assert.rejects(sourcePath(root, '|?|\\..\\outside\\private.cpp'), /outside the project root/)
  await assert.rejects(sourcePath(root, '|?|/project/linked/private.cpp'), /outside the project root/)
  await assert.rejects(sourcePath(root, '../outside/private.cpp'), /outside the project root/)
  await assert.rejects(sourcePath(root, outside), /outside the project root/)
  await assert.rejects(sourcePath(root, 'linked/private.cpp'), /outside the project root/)

  const warning = {
    code: 'V501', level: 1, message: 'Test', file: 'main.cpp', line: 33,
    positions: [{ file: 'main.cpp', line: 33 }],
  }
  const snippet = await sourceSnippet(root, warning)
  const lines = snippet.split('\n')
  assert.equal(lines.length, 61)
  assert.equal(lines[0], '   3 | line 3')
  assert.equal(lines[30], '>> 33 | line 33')
  assert.equal(lines[60], '   63 | line 63')
  assert.match(buildPrompt(warning, snippet, diagnostics), /^Warning: V501 \(level 1\)$/m)
})

test('adds short snippets for related positions and skips unreadable ones', async t => {
  const temp = await mkdtemp(join(tmpdir(), 'triage-test-'))
  t.after(() => rm(temp, { recursive: true, force: true }))
  const root = join(temp, 'project')
  await mkdir(root)
  await writeFile(join(root, 'main.cpp'), Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n'))
  await writeFile(join(root, 'other.cpp'), Array.from({ length: 20 }, (_, i) => `other ${i + 1}`).join('\n'))

  const warning = {
    code: 'V522', level: 1, message: 'Test', file: 'main.cpp', line: 40,
    positions: [
      { file: 'main.cpp', line: 40 },
      { file: 'main.cpp', line: 44 },
      { file: 'other.cpp', line: 10 },
      { file: 'missing.cpp', line: 2 },
    ],
  }
  const snippet = await sourceSnippet(root, warning)
  assert.match(snippet, /Related position: main\.cpp:44\n   41 \| line 41\n   42 \| line 42\n   43 \| line 43\n>> 44 \| line 44\n   45 \| line 45\n   46 \| line 46\n   47 \| line 47/)
  assert.match(snippet, /Related position: other\.cpp:10\n   7 \| other 7\n   8 \| other 8\n   9 \| other 9\n>> 10 \| other 10\n   11 \| other 11\n   12 \| other 12\n   13 \| other 13/)
  assert.match(snippet, /Related position: missing\.cpp:2 \(source unavailable\)/)
  assert.equal(snippet.match(/^>>/gm)?.length, 3)
})

test('extracts opencode error events from JSONL', () => {
  assert.equal(eventError('{"type":"text","part":{"text":"x"}}\n'), undefined)
  assert.equal(eventError('noise\n{"type":"error","error":{"message":"Model unavailable: a/b"}}\n'), 'Model unavailable: a/b')
  assert.equal(eventError('{"type":"error","error":{"data":{"message":"402 quota"}}}'), '402 quota')
})

test('sums usage across step_finish events and prices it', () => {
  const step = (input: number, output: number, reasoning: number, read: number) =>
    JSON.stringify({ type: 'step_finish', part: { tokens: { input, output, reasoning, cache: { read, write: 0 } } } })
  const usage = usageOf([step(1000, 100, 50, 200), '{"type":"text","part":{"text":"x"}}', step(500, 10, 0, 0), 'noise'].join('\n'))
  assert.deepEqual(usage, { input: 1500, output: 160, cacheRead: 200, cacheWrite: 0 })
  assert.deepEqual(usageOf(''), noUsage)
  const price = { input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: 0 }
  assert.equal(usageCost({ input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0 }, price), 0.753)
  assert.deepEqual(addUsage(noUsage, usage, 812 / 5), { input: 1500 * 162.4, output: 160 * 162.4, cacheRead: 200 * 162.4, cacheWrite: 0 })
})

test('counts usage of a failed opencode call', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'triage-bin-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const step = JSON.stringify({ type: 'step_finish', part: { tokens: { input: 700, output: 30, reasoning: 20, cache: { read: 0, write: 0 } } } })
  const { PATH, NODE_OPTIONS } = process.env
  t.after(() => {
    if (PATH === undefined) delete process.env.PATH
    else process.env.PATH = PATH
    if (NODE_OPTIONS === undefined) delete process.env.NODE_OPTIONS
    else process.env.NODE_OPTIONS = NODE_OPTIONS
  })
  process.env.PATH = dir
  if (process.platform === 'win32') {
    const bin = join(dir, 'node_modules', '@opencode', 'cli', 'bin')
    await mkdir(bin, { recursive: true })
    await copyFile(process.execPath, join(bin, 'opencode.exe'))
    const preload = join(dir, 'mock.cjs')
    await writeFile(preload, `process.stdout.write(${JSON.stringify(step)}, () => process.exit(3))`)
    process.env.NODE_OPTIONS = `--require="${preload.replaceAll('\\', '/')}"`
  } else {
    await writeFile(join(dir, 'opencode'), `#!/bin/sh\necho '${step}'\nexit 3\n`, { mode: 0o755 })
  }
  let usage = noUsage
  await assert.rejects(triage(dir, 'x/y', 'prompt', new AbortController().signal, call => { usage = addUsage(usage, call) }))
  assert.deepEqual(usage, { input: 700, output: 50, cacheRead: 0, cacheWrite: 0 })
})

test('opens saved JSON results and freezes unfinished rows', () => {
  const warning = { code: 'V1', level: 1, message: 'Check', file: 'a.cpp', line: 2, positions: [{ file: 'a.cpp', line: 2 }] }
  const answer = { verdict: 'bug', confidence: 'high', reason: 'Duplicate.' }
  const usage = { ...noUsage, output: 10 }
  const data = { rows: [{ ...warning, status: 'done', answer }, { ...warning, status: 'running' }], usage }
  const imported = parseResults(JSON.stringify(data), false)
  assert.deepEqual(imported.rows[0].answer, answer)
  assert.equal(imported.rows[1].status, 'stopped')
  assert.deepEqual(imported.usage, usage)
  assert.throws(() => parseResults(JSON.stringify({ rows: [{ ...warning, status: 'done' }] }), false))
  assert.throws(() => parseResults('{"warnings":[]}', false))
})

test('opens legacy CSV with quoted multiline reasons and drive-letter paths', () => {
  const record = '"V2","2","C:/src/a.cpp:42","Check, again","unsure","low","Missing ""x"".\r\nMore.","done"'
  const { rows } = parseResults(csvHeader + '\r\n' + record + '\r\n', true)
  assert.equal(rows[0].file, 'C:/src/a.cpp')
  assert.equal(rows[0].line, 42)
  assert.equal(rows[0].answer?.reason, 'Missing "x".\r\nMore.')
  assert.equal(parseResults(csvHeader + '\n', true).rows.length, 0)
  assert.throws(() => parseResults(csvHeader + '\n"unfinished', true))
})
