import assert from 'node:assert/strict'
import fs from 'fs-extra'
import { execa } from 'execa'
import { join } from 'node:path'
import { buildTestConfig, createTempDir, removeTempDir } from '../helpers/project.js'
import { generateProject } from '../../src/generator/index.js'
import { loadManifest } from '../../src/manifest/loader.js'
import { resolveTemplate } from '../../src/steps/resolver.js'

async function runCli(args) {
  const result = await execa('node', ['bin/cli.js', ...args], {
    reject: false,
  })

  assert.equal(result.exitCode, 0, result.stderr || result.stdout)
  return result.stdout
}

await runCli(['--help'])
await runCli(['--version'])
await runCli(['upgrade', '--help'])
await runCli(['search', '--help'])
await runCli(['install', '--help'])
await runCli(['list', '--help'])
await runCli(['remove', '--help'])

const targetDir = await createTempDir('cxa-smoke-')

try {
  const manifest = loadManifest('node-ts')
  const config = {
    ...buildTestConfig(manifest, targetDir),
    projectName: 'smoke-project',
    features: ['agents', 'coding-rules'],
    extras: [],
    fileBasedExtras: [],
  }

  await generateProject({
    config,
    templatePath: await resolveTemplate('node-ts'),
  })

  assert.equal(await fs.pathExists(join(targetDir, 'package.json')), true)
  assert.equal(await fs.pathExists(join(targetDir, 'AGENTS.md')), true)
  console.log('✔ smoke')
} finally {
  await removeTempDir(targetDir)
}
