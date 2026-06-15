import assert from 'node:assert/strict'
import test from 'node:test'
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
