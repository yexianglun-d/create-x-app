import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { buildTestConfig, createTempDir, removeTempDir } from '../helpers/project.js'
import { generateProject } from '../../src/generator/index.js'
import { loadManifest } from '../../src/manifest/loader.js'
import { resolveTemplate } from '../../src/steps/resolver.js'

async function captureConsoleOutput(callback) {
  const originalLog = console.log

  console.log = () => {}

  try {
    await callback()
  } finally {
    console.log = originalLog
  }
}

async function buildNodeTemplateConfig(targetDir) {
  const manifest = loadManifest('node-ts')

  return {
    config: buildTestConfig(manifest, targetDir),
    templatePath: await resolveTemplate('node-ts'),
  }
}

test('dry-run does not write target files', async () => {
  const rootDir = await createTempDir('cxa-dry-run-')
  const targetDir = join(rootDir, 'demo')

  try {
    const { config, templatePath } = await buildNodeTemplateConfig(targetDir)

    await captureConsoleOutput(async () => {
      await generateProject({
        config,
        options: { dryRun: true },
        templatePath,
      })
    })

    assert.equal(await fs.pathExists(targetDir), false)
  } finally {
    await removeTempDir(rootDir)
  }
})

test('non-empty target directory requires force', async () => {
  const targetDir = await createTempDir('cxa-safe-target-')

  try {
    await fs.writeFile(join(targetDir, 'existing.txt'), 'keep me\n')
    const { config, templatePath } = await buildNodeTemplateConfig(targetDir)

    await assert.rejects(
      () => generateProject({ config, templatePath }),
      /--force/,
    )
  } finally {
    await removeTempDir(targetDir)
  }
})

test('force allows replacing a non-empty target directory', async () => {
  const targetDir = await createTempDir('cxa-force-target-')

  try {
    await fs.writeFile(join(targetDir, 'existing.txt'), 'replace me\n')
    const { config, templatePath } = await buildNodeTemplateConfig(targetDir)

    await captureConsoleOutput(async () => {
      await generateProject({
        config,
        options: { force: true },
        templatePath,
      })
    })

    assert.equal(await fs.pathExists(join(targetDir, 'existing.txt')), false)
    assert.equal(await fs.pathExists(join(targetDir, 'package.json')), true)
  } finally {
    await removeTempDir(targetDir)
  }
})

test('generateProject writes template source lock without local paths', async () => {
  const targetDir = await createTempDir('cxa-template-lock-')

  try {
    const { config, templatePath } = await buildNodeTemplateConfig(targetDir)
    mock.method(globalThis, 'fetch', async () => ({ ok: false }))

    await generateProject({
      config,
      options: {
        cliVersion: '1.2.3',
        dependencyStrategy: 'latest-minor',
      },
      templatePath,
      templateSource: {
        type: 'github',
        owner: 'yexianglun-d',
        repo: 'create-x-app',
        ref: 'v1.2.3',
        commit: 'abcdef123456',
        cacheHit: false,
        templatePath: '/tmp/private-cache-path',
      },
    })

    const lock = await fs.readJson(join(targetDir, '.create-x-app', 'template-lock.json'))

    assert.equal(lock.template.key, 'node-ts')
    assert.equal(lock.source.type, 'github')
    assert.equal(lock.source.ref, 'v1.2.3')
    assert.equal(lock.source.commit, 'abcdef123456')
    assert.equal(lock.source.templatePath, undefined)
    assert.equal(lock.cli.version, '1.2.3')
    assert.equal(lock.selection.dependencyStrategy, 'latest-minor')
  } finally {
    await removeTempDir(targetDir)
  }
})
