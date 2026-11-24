import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectExperiments } from './collect-experiments.js'

test('returns empty array when experiments dir does not exist', () => {
  assert.deepEqual(collectExperiments(join(tmpdir(), 'no-such-dir-' + Date.now())), [])
})

test('collects slug, name, description from each experiment package.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wp-'))
  mkdirSync(join(dir, 'my-exp'))
  writeFileSync(join(dir, 'my-exp', 'package.json'), JSON.stringify({ name: 'my-exp', description: 'A test' }))
  assert.deepEqual(collectExperiments(dir), [{ slug: 'my-exp', name: 'my-exp', description: 'A test' }])
})

test('skips dirs without package.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wp-'))
  mkdirSync(join(dir, 'bare-dir'))
  assert.deepEqual(collectExperiments(dir), [])
})

test('normalises missing description to empty string', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wp-'))
  mkdirSync(join(dir, 'no-desc'))
  writeFileSync(join(dir, 'no-desc', 'package.json'), JSON.stringify({ name: 'no-desc' }))
  assert.deepEqual(collectExperiments(dir), [{ slug: 'no-desc', name: 'no-desc', description: '' }])
})
