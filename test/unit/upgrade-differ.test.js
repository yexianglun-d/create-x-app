import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { createTempDir, removeTempDir } from '../helpers/project.js'
import { createTextDiff, diffConfigFiles } from '../../src/upgrade/differ.js'

test('createTextDiff creates add and remove operations', () => {
  const diff = createTextDiff('a\nb', 'a\nc')

  assert.deepEqual(diff, [
    { type: 'equal', line: 'a' },
    { type: 'remove', line: 'b' },
    { type: 'add', line: 'c' },
  ])
})

test('diffConfigFiles includes eslint flat config files', async () => {
  const currentDir = await createTempDir('cxa-current-')
  const expectedDir = await createTempDir('cxa-expected-')

  try {
    await fs.outputFile(join(currentDir, 'eslint.config.js'), 'export default []\n')
    await fs.outputFile(join(expectedDir, 'eslint.config.js'), 'export default [{ rules: {} }]\n')

    const diffs = await diffConfigFiles(currentDir, expectedDir)

    assert.equal(diffs.length, 1)
    assert.equal(diffs[0].relativePath, 'eslint.config.js')
  } finally {
    await removeTempDir(currentDir)
    await removeTempDir(expectedDir)
  }
})
