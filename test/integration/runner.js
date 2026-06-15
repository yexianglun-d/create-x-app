import assert from 'node:assert/strict'
import fs from 'fs-extra'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateProject } from '../../src/generator/index.js'
import { loadAllManifests } from '../../src/manifest/loader.js'
import { resolveTemplate } from '../../src/steps/resolver.js'
import { createPmAdapter } from '../../src/utils/pm-adapter.js'
import { buildTestConfig, createTempDir, removeTempDir } from '../helpers/project.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = join(__dirname, 'snapshots')
const UPDATE_SNAPSHOTS = process.argv.includes('--update-snapshots')
const SKIP_INSTALL = process.env.CXA_SKIP_TEMPLATE_INSTALL === '1'

async function collectFiles(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const currentPath = join(currentDir, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'dist-electron'].includes(entry.name)) {
        continue
      }

      files.push(...await collectFiles(rootDir, currentPath))
      continue
    }

    files.push(relative(rootDir, currentPath).replaceAll('\\', '/'))
  }

  return files.sort()
}

function getPathValue(target, path) {
  return path.split('.').reduce((current, segment) => current?.[segment], target)
}

async function buildSnapshot(targetDir) {
  const packageJson = await fs.readJson(join(targetDir, 'package.json'))

  return {
    files: await collectFiles(targetDir),
    packageJsonFields: {
      'scripts.build': getPathValue(packageJson, 'scripts.build') ?? null,
      'scripts.lint': getPathValue(packageJson, 'scripts.lint') ?? null,
      'cxa-template': packageJson['cxa-template'] ?? null,
      'cxa-version': packageJson['cxa-version'] ?? null,
    },
  }
}

async function assertSnapshot(templateKey, snapshot) {
  const snapshotPath = join(SNAPSHOT_DIR, `${templateKey}.json`)

  if (UPDATE_SNAPSHOTS) {
    await fs.ensureDir(SNAPSHOT_DIR)
    await fs.writeJson(snapshotPath, snapshot, { spaces: 2 })
    await fs.appendFile(snapshotPath, '\n')
    return
  }

  assert.equal(await fs.pathExists(snapshotPath), true, `缺少快照：${snapshotPath}`)
  const expectedSnapshot = await fs.readJson(snapshotPath)

  assert.deepEqual(snapshot, expectedSnapshot)
}

async function runInstallAndBuild(manifest, config) {
  if (SKIP_INSTALL || manifest.integrationTest?.skipBuild) {
    return
  }

  const pm = createPmAdapter(config.packageManager)
  const installWorkspaces = manifest.integrationTest?.installWorkspaces ?? ['.']
  const buildWorkspace = manifest.integrationTest?.buildWorkspace ?? '.'

  for (const workspace of installWorkspaces) {
    await pm.install(join(config.targetDir, workspace), {
      stdio: 'pipe',
    })
  }

  if (manifest.buildScript) {
    await pm.run(manifest.buildScript, join(config.targetDir, buildWorkspace), {
      stdio: 'pipe',
    })
  }

  const packageJson = await fs.readJson(join(config.targetDir, buildWorkspace, 'package.json'))

  if (packageJson.scripts?.lint) {
    await pm.run('lint', join(config.targetDir, buildWorkspace), {
      stdio: 'pipe',
    })
  }
}

async function runTemplateIntegration(manifest) {
  const targetDir = await createTempDir(`cxa-${manifest.key}-`)
  const config = buildTestConfig(manifest, targetDir)

  try {
    const templatePath = await resolveTemplate(manifest.key)

    await generateProject({ config, templatePath })
    await assertSnapshot(manifest.key, await buildSnapshot(targetDir))
    await runInstallAndBuild(manifest, config)

    console.log(`✔ ${manifest.key}`)
  } finally {
    await removeTempDir(targetDir)
  }
}

const builtinManifests = loadAllManifests()
  .filter((manifest) => manifest.source === 'builtin')

for (const manifest of builtinManifests) {
  await runTemplateIntegration(manifest)
}
