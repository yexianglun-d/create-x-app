import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { createTempDir, removeTempDir } from '../helpers/project.js'
import { inspectPluginTemplates, loadPluginTemplates } from '../../src/plugins/loader.js'

async function writeJson(filePath, value) {
  await fs.outputJson(filePath, value, { spaces: 2 })
}

async function createPluginFixture(nodeModulesDir, packageName, manifest) {
  const packageDir = join(nodeModulesDir, packageName)

  await writeJson(join(packageDir, 'package.json'), {
    name: packageName,
    version: '0.1.0',
    description: `${packageName} fixture`,
    type: 'module',
    license: 'MIT',
    repository: 'https://github.com/example/create-x-app-plugin',
    cxaPluginApi: '>=1.0.0 <2.0.0',
    'cxa-plugin': true,
  })

  await writeJson(join(packageDir, 'manifest.json'), manifest)
  await fs.outputFile(join(packageDir, 'template', 'README.md.ejs'), '# <%= projectName %>\n')

  return packageDir
}

function createValidManifest(key) {
  return {
    key,
    name: 'Plugin Fixture',
    description: 'Plugin fixture template',
    version: '0.1.0',
    schemaVersion: '1.0',
    framework: 'plugin',
    cxaPluginApi: '>=1.0.0 <2.0.0',
    author: 'create-x-app',
    repository: 'https://github.com/example/create-x-app-plugin',
    license: 'MIT',
    requiresNetwork: false,
    postActions: [],
    writesOutsideTarget: false,
    requiredPm: null,
    forbiddenPm: [],
    requiredEnv: {},
    optionalEnv: {},
    supportedFeatures: ['agents'],
    defaultFeatures: ['agents'],
    features: {
      agents: {
        label: 'AGENTS.md',
        default: true,
        artifacts: ['AGENTS.md'],
      },
    },
    extras: [],
    subPrompts: [],
    devScript: null,
    buildScript: null,
    devPort: null,
    upgrade: {
      managedFiles: [],
    },
  }
}

test('loadPluginTemplates skips invalid plugin manifests while diagnostics keep errors', async () => {
  const rootDir = await createTempDir('cxa-plugin-loader-')
  const nodeModulesDir = join(rootDir, 'node_modules')

  try {
    await createPluginFixture(nodeModulesDir, 'cxa-plugin-valid', createValidManifest('fixture-valid'))
    await createPluginFixture(nodeModulesDir, 'cxa-plugin-invalid', {
      ...createValidManifest('fixture-invalid'),
      cxaPluginApi: 'not a range',
    })

    const plugins = loadPluginTemplates({ nodeModulesDirs: [nodeModulesDir] })
    const diagnostics = inspectPluginTemplates({ nodeModulesDirs: [nodeModulesDir] })

    assert.deepEqual(plugins.map((plugin) => plugin.key), ['fixture-valid'])
    assert.equal(diagnostics.length, 2)
    assert.equal(diagnostics.find((diagnostic) => diagnostic.packageName === 'cxa-plugin-valid')?.valid, true)

    const invalidDiagnostic = diagnostics.find((diagnostic) => diagnostic.packageName === 'cxa-plugin-invalid')
    assert.equal(invalidDiagnostic?.valid, false)
    assert.match(invalidDiagnostic?.errors.join('\n') ?? '', /cxaPluginApi 必须是有效的 semver range/)
  } finally {
    await removeTempDir(rootDir)
  }
})
