import assert from 'node:assert/strict'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildPrompt, eventError, parseAnswer, parseReport, sourcePath, sourceSnippet } from '../src/triage.ts'

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
