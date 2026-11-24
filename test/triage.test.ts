import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildBatchPrompt, buildPrompt, eventError, parseAnswer, parseBatchAnswer, parseReport, sourcePath, sourceSnippet } from '../src/triage.ts'

test('parses the first valid position and skips warnings without one', () => {
  const warning = { code: 'V501', level: 1, message: 'Duplicate operands' }
  assert.deepEqual(parseReport(JSON.stringify({
    warnings: [
      { ...warning, positions: [{ file: 'bad.cpp', line: 0 }, { file: 'main.cpp', line: 42 }] },
      warning,
      { ...warning, positions: [] },
      { ...warning, positions: [{ file: 'bad.cpp', line: '42' }] },
      null,
    ],
  })), [{ ...warning, file: 'main.cpp', line: 42 }])
  assert.throws(() => parseReport('{}'), /warnings array/)
})

test('validates plain and fenced answers', () => {
  const answer = { verdict: 'bug', confidence: 'high', reason: 'The operands are identical.' }
  const json = JSON.stringify(answer)
  assert.deepEqual(parseAnswer(json), answer)
  assert.deepEqual(parseAnswer('\x60\x60\x60json\n' + json + '\n\x60\x60\x60'), answer)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, verdict: 'probably' })), /invalid verdict/)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, confidence: 'certain' })), /invalid confidence/)
  assert.throws(() => parseAnswer(JSON.stringify({ ...answer, reason: ' ' })), /reason/)
  assert.throws(() => parseAnswer('garbage'), /not valid JSON/)
})

test('builds a batch prompt with the original prompt in each id section', () => {
  const warning = { code: 'V501', level: 1, message: 'Test', file: 'main.cpp', line: 33 }
  const first = buildPrompt(warning, '>> 33 | first')
  const second = buildPrompt({ ...warning, line: 42 }, '>> 42 | second')
  const [instruction, ...sections] = buildBatchPrompt([
    { id: 3, prompt: first }, { id: 7, prompt: second },
  ]).split('\n\n### ')

  assert.match(instruction, /independently.*ONLY with a JSON array/)
  assert.deepEqual(sections, [`id=3\n${first}`, `id=7\n${second}`])
})

const batchAnswer = { verdict: 'bug', confidence: 'high', reason: 'The operands are identical.' }

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
  const outside = join(temp, 'private.cpp')
  await mkdir(root)
  await writeFile(file, Array.from({ length: 65 }, (_, i) => `line ${i + 1}`).join('\n'))
  await writeFile(outside, 'outside')
  await symlink(outside, join(root, 'link.cpp'))

  assert.equal(await sourcePath(root, 'main.cpp'), await realpath(file))
  assert.equal(await sourcePath(root, file), await realpath(file))
  await assert.rejects(sourcePath(root, '../private.cpp'), /outside the project root/)
  await assert.rejects(sourcePath(root, outside), /outside the project root/)
  await assert.rejects(sourcePath(root, 'link.cpp'), /outside the project root/)

  const warning = { code: 'V501', level: 1, message: 'Test', file: 'main.cpp', line: 33 }
  const snippet = await sourceSnippet(root, warning)
  const lines = snippet.split('\n')
  assert.equal(lines.length, 61)
  assert.equal(lines[0], '   3 | line 3')
  assert.equal(lines[30], '>> 33 | line 33')
  assert.equal(lines[60], '   63 | line 63')
  assert.match(buildPrompt(warning, snippet), /^Warning: V501 \(level 1\)$/m)
})

test('extracts opencode error events from JSONL', () => {
  assert.equal(eventError('{"type":"text","part":{"text":"x"}}\n'), undefined)
  assert.equal(eventError('noise\n{"type":"error","error":{"message":"Model unavailable: a/b"}}\n'), 'Model unavailable: a/b')
  assert.equal(eventError('{"type":"error","error":{"data":{"message":"402 quota"}}}'), '402 quota')
})
