import { createHash } from 'node:crypto'
import fs from 'fs-extra'
import { dirname, join, relative } from 'node:path'

export const CXA_METADATA_DIR = '.create-x-app'
export const PROJECT_METADATA_FILE = join(CXA_METADATA_DIR, 'project.json')
export const FILES_METADATA_FILE = join(CXA_METADATA_DIR, 'files.json')
export const TEMPLATE_LOCK_FILE = join(CXA_METADATA_DIR, 'template-lock.json')

const IGNORED_DIRECTORIES = new Set([
  '.git',
  CXA_METADATA_DIR,
  'node_modules',
])

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/')
}

export function hashContent(content) {
  return `sha256-${createHash('sha256').update(content).digest('hex')}`
}

export async function hashFile(filePath) {
  return hashContent(await fs.readFile(filePath))
}

async function collectFiles(projectDir, currentDir = projectDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const currentPath = join(currentDir, entry.name)

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }

      files.push(...await collectFiles(projectDir, currentPath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    files.push(normalizePath(relative(projectDir, currentPath)))
  }

  return files.sort((left, right) => left.localeCompare(right))
}

export async function buildFilesMetadata(projectDir) {
  const files = {}

  for (const relativePath of await collectFiles(projectDir)) {
    files[relativePath] = {
      owned: true,
      hash: await hashFile(join(projectDir, relativePath)),
    }
  }

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    files,
  }
}

export function buildProjectMetadata(config, manifest, options = {}) {
  return {
    schemaVersion: '1.0',
    projectName: config.projectName,
    template: manifest.key,
    templateVersion: manifest.version,
    createdBy: `create-x-app-cli@${options.cliVersion ?? 'unknown'}`,
    packageManager: config.packageManager,
    features: config.features ?? [],
    extras: config.extras ?? [],
    dependencyStrategy: options.dependencyStrategy ?? 'baseline',
    preset: options.preset ?? null,
    createdAt: new Date().toISOString(),
  }
}

async function writeJsonWithNewline(filePath, data) {
  await fs.outputJson(filePath, data, { spaces: 2 })
  await fs.appendFile(filePath, '\n')
}

export async function writeProjectTrackingMetadata(projectDir, config, manifest, options = {}) {
  await writeJsonWithNewline(
    join(projectDir, PROJECT_METADATA_FILE),
    buildProjectMetadata(config, manifest, options),
  )
  await writeJsonWithNewline(
    join(projectDir, FILES_METADATA_FILE),
    await buildFilesMetadata(projectDir),
  )
}

async function readOptionalJson(filePath) {
  if (!await fs.pathExists(filePath)) {
    return null
  }

  return fs.readJson(filePath)
}

export async function readProjectMetadata(projectDir) {
  return readOptionalJson(join(projectDir, PROJECT_METADATA_FILE))
}

export async function readFilesMetadata(projectDir) {
  return readOptionalJson(join(projectDir, FILES_METADATA_FILE))
}

export async function readTemplateLock(projectDir) {
  return readOptionalJson(join(projectDir, TEMPLATE_LOCK_FILE))
}

export function getTrackedFile(filesMetadata, relativePath) {
  return filesMetadata?.files?.[normalizePath(relativePath)] ?? null
}

export async function updateTrackedFiles(projectDir, relativePaths) {
  const filesMetadata = await readFilesMetadata(projectDir) ?? {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    files: {},
  }

  for (const relativePath of relativePaths) {
    const absolutePath = join(projectDir, relativePath)

    if (!await fs.pathExists(absolutePath)) {
      delete filesMetadata.files[relativePath]
      continue
    }

    filesMetadata.files[normalizePath(relativePath)] = {
      owned: true,
      hash: await hashFile(absolutePath),
    }
  }

  filesMetadata.updatedAt = new Date().toISOString()
  await writeJsonWithNewline(join(projectDir, FILES_METADATA_FILE), filesMetadata)
}

export async function recordUpgrade(projectDir, result, options = {}) {
  const projectMetadata = await readProjectMetadata(projectDir)

  if (!projectMetadata) {
    return
  }

  projectMetadata.lastUpgrade = {
    from: options.from ?? null,
    to: options.to ?? null,
    appliedFiles: result.appliedFiles,
    skippedFiles: result.skippedFiles,
    updatedAt: new Date().toISOString(),
  }

  await writeJsonWithNewline(join(projectDir, PROJECT_METADATA_FILE), projectMetadata)
}

export async function createUpgradeBackup(projectDir, diffs) {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
  const backupDir = join(projectDir, CXA_METADATA_DIR, 'backups', timestamp)
  const manifest = {
    schemaVersion: '1.0',
    createdAt: new Date().toISOString(),
    files: [],
  }

  for (const diff of diffs) {
    if (!diff.currentExists) {
      continue
    }

    const backupPath = join(backupDir, 'files', diff.relativePath)

    await fs.ensureDir(dirname(backupPath))
    await fs.copyFile(diff.currentPath, backupPath)
    manifest.files.push({
      path: diff.relativePath,
      hash: diff.currentHash,
    })
  }

  await writeJsonWithNewline(join(backupDir, 'backup.json'), manifest)

  return backupDir
}
