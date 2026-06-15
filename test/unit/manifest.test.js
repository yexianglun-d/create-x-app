import assert from 'node:assert/strict'
import test from 'node:test'
import { loadAllManifests, loadManifest } from '../../src/manifest/loader.js'
import { getManifestValidationErrors } from '../../src/manifest/validate.js'

test('loadManifest returns a built-in template definition', () => {
  const manifest = loadManifest('react-vite-ts')

  assert.equal(manifest.key, 'react-vite-ts')
  assert.equal(manifest.source, 'builtin')
  assert.ok(manifest.templatePath.endsWith('templates/react-vite-ts'))
})

test('loadAllManifests includes all built-in templates', () => {
  const builtinKeys = loadAllManifests()
    .filter((manifest) => manifest.source === 'builtin')
    .map((manifest) => manifest.key)

  assert.deepEqual(builtinKeys.sort(), [
    'chrome-ext',
    'electron-app',
    'java-fullstack',
    'mobile-h5',
    'monorepo',
    'node-ts',
    'react-admin',
    'react-vite-ts',
  ])
})

test('manifest validator reports missing required fields', () => {
  const errors = getManifestValidationErrors({
    key: '',
    defaultFeatures: ['eslint'],
    supportedFeatures: [],
    extras: [],
    subPrompts: [],
    requiredEnv: {},
    optionalEnv: {},
    forbiddenPm: [],
  })

  assert.match(errors.join('\n'), /name 必须是非空字符串/)
  assert.match(errors.join('\n'), /defaultFeatures 包含未声明的功能：eslint/)
})
