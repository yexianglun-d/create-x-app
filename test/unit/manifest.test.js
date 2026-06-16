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
    schemaVersion: '1.0',
    defaultFeatures: ['eslint'],
    supportedFeatures: [],
    features: {},
    extras: [],
    subPrompts: [],
    requiredEnv: {},
    optionalEnv: {},
    forbiddenPm: [],
  })

  assert.match(errors.join('\n'), /name 必须是非空字符串/)
  assert.match(errors.join('\n'), /defaultFeatures 包含未声明的功能：eslint/)
})

test('manifest validator requires feature definitions to match defaults', () => {
  const errors = getManifestValidationErrors({
    schemaVersion: '1.0',
    key: 'demo',
    name: 'Demo',
    description: 'Demo template',
    version: '1.0.0',
    framework: 'node',
    requiredPm: null,
    forbiddenPm: [],
    requiredEnv: {},
    optionalEnv: {},
    supportedFeatures: ['eslint'],
    defaultFeatures: ['eslint'],
    features: {
      eslint: {
        label: 'ESLint',
        default: false,
      },
    },
    extras: [],
    subPrompts: [],
  })

  assert.match(errors.join('\n'), /features\.eslint\.default 必须与 defaultFeatures 保持一致/)
})

test('manifest validator validates plugin trust metadata fields', () => {
  const errors = getManifestValidationErrors({
    schemaVersion: '1.0',
    key: 'demo',
    name: 'Demo',
    description: 'Demo template',
    version: '1.0.0',
    framework: 'plugin',
    cxaPluginApi: 'not a range',
    repository: 123,
    requiresNetwork: 'yes',
    postActions: ['generate.after', ''],
    writesOutsideTarget: 'no',
    requiredPm: null,
    forbiddenPm: [],
    requiredEnv: {},
    optionalEnv: {},
    supportedFeatures: [],
    defaultFeatures: [],
    features: {},
    extras: [],
    subPrompts: [],
  })

  assert.match(errors.join('\n'), /cxaPluginApi 必须是有效的 semver range/)
  assert.match(errors.join('\n'), /repository 必须是字符串/)
  assert.match(errors.join('\n'), /requiresNetwork 必须是布尔值/)
  assert.match(errors.join('\n'), /postActions\[1\] 必须是非空字符串/)
  assert.match(errors.join('\n'), /writesOutsideTarget 必须是布尔值/)
})

test('manifest validator validates template requirements metadata', () => {
  const errors = getManifestValidationErrors({
    schemaVersion: '1.0',
    key: 'demo',
    name: 'Demo',
    description: 'Demo template',
    version: '1.0.0',
    framework: 'node',
    requirements: {
      node: 'not a range',
      go: '>=1.22.0',
      packageManagers: ['npm', 'bun'],
    },
    requiredPm: null,
    forbiddenPm: [],
    requiredEnv: {},
    optionalEnv: {},
    supportedFeatures: [],
    defaultFeatures: [],
    features: {},
    extras: [],
    subPrompts: [],
  })

  assert.match(errors.join('\n'), /requirements\.node 必须是有效的 semver range/)
  assert.match(errors.join('\n'), /requirements 包含不支持的工具：go/)
  assert.match(errors.join('\n'), /requirements\.packageManagers 包含不支持的包管理器：bun/)
})
