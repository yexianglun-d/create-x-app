import assert from 'node:assert/strict'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigFromOptions } from '../../src/steps/prompts.js'
import { getConfigValidationErrors } from '../../src/validator/index.js'

test('buildConfigFromOptions creates a non-interactive config', () => {
  const cwd = join(tmpdir(), 'cxa-options')
  const config = buildConfigFromOptions('demo-app', {
    template: 'react-vite-ts',
    pm: 'pnpm',
    features: 'eslint,prettier',
    extras: 'tailwind',
    cwd,
  })

  assert.equal(config.projectName, 'demo-app')
  assert.equal(config.template, 'react-vite-ts')
  assert.equal(config.packageManager, 'pnpm')
  assert.deepEqual(config.features, ['eslint', 'prettier'])
  assert.deepEqual(config.extras, ['tailwind'])
  assert.deepEqual(config.fileBasedExtras, ['tailwind'])
  assert.equal(config.targetDir, join(cwd, 'demo-app'))
})

test('required package manager overrides non-interactive pm option', () => {
  const config = buildConfigFromOptions('demo-mono', {
    template: 'monorepo',
    pm: 'npm',
  })

  assert.equal(config.packageManager, 'pnpm')
})

test('validator rejects unknown non-interactive features and extras', () => {
  const errors = getConfigValidationErrors({
    projectName: 'demo-app',
    template: 'node-ts',
    packageManager: 'npm',
    features: ['eslint', 'agents', 'unknown-feature'],
    extras: ['tailwind'],
  })

  assert.match(errors.join('\n'), /unknown-feature/)
  assert.match(errors.join('\n'), /tailwind/)
})
