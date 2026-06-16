import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { createTempDir, removeTempDir } from '../helpers/project.js'
import { createTextDiff, diffConfigFiles } from '../../src/upgrade/differ.js'
import { hashContent } from '../../src/upgrade/metadata.js'

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

test('diffConfigFiles only compares managed files when provided', async () => {
  const currentDir = await createTempDir('cxa-current-')
  const expectedDir = await createTempDir('cxa-expected-')

  try {
    await fs.outputFile(join(currentDir, 'managed.json'), '{"a":1}\n')
    await fs.outputFile(join(expectedDir, 'managed.json'), '{"a":2}\n')
    await fs.outputFile(join(currentDir, 'ignored.json'), '{"a":1}\n')
    await fs.outputFile(join(expectedDir, 'ignored.json'), '{"a":2}\n')

    const diffs = await diffConfigFiles(currentDir, expectedDir, ['managed.json'])

    assert.equal(diffs.length, 1)
    assert.equal(diffs[0].relativePath, 'managed.json')
  } finally {
    await removeTempDir(currentDir)
    await removeTempDir(expectedDir)
  }
})

test('diffConfigFiles marks safe template changes when tracked file is untouched', async () => {
  const currentDir = await createTempDir('cxa-current-')
  const expectedDir = await createTempDir('cxa-expected-')

  try {
    await fs.outputFile(join(currentDir, 'tsconfig.json'), '{"strict":true}\n')
    await fs.outputFile(join(expectedDir, 'tsconfig.json'), '{"strict":true,"noEmit":true}\n')

    const diffs = await diffConfigFiles(currentDir, expectedDir, ['tsconfig.json'], {
      filesMetadata: {
        files: {
          'tsconfig.json': {
            hash: hashContent('{"strict":true}\n'),
          },
        },
      },
    })

    assert.equal(diffs[0].migrationStatus, 'template_changed')
    assert.equal(diffs[0].safeToApply, true)
  } finally {
    await removeTempDir(currentDir)
    await removeTempDir(expectedDir)
  }
})

test('diffConfigFiles marks conflicts when user and template both changed', async () => {
  const currentDir = await createTempDir('cxa-current-')
  const expectedDir = await createTempDir('cxa-expected-')

  try {
    await fs.outputFile(join(currentDir, 'tsconfig.json'), '{"strict":false}\n')
    await fs.outputFile(join(expectedDir, 'tsconfig.json'), '{"strict":true,"noEmit":true}\n')

    const diffs = await diffConfigFiles(currentDir, expectedDir, ['tsconfig.json'], {
      filesMetadata: {
        files: {
          'tsconfig.json': {
            hash: hashContent('{"strict":true}\n'),
          },
        },
      },
    })

    assert.equal(diffs[0].migrationStatus, 'conflict')
    assert.equal(diffs[0].safeToApply, false)
  } finally {
    await removeTempDir(currentDir)
    await removeTempDir(expectedDir)
  }
})
