import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { validateManifestDefinition } from '../manifest/validate.js'

const PLUGIN_PACKAGE_PREFIX = 'cxa-plugin-'

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function safeRealpath(path) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function getGlobalNodeModulesDir() {
  try {
    return execFileSync('npm', ['root', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function getCandidateNodeModulesDirs() {
  const dirs = [
    join(process.cwd(), 'node_modules'),
    getGlobalNodeModulesDir(),
  ].filter(Boolean)

  return [...new Set(dirs.map(safeRealpath))]
}

function listPackageDirs(nodeModulesDir) {
  if (!existsSync(nodeModulesDir)) {
    return []
  }

  const packageDirs = []

  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) {
      continue
    }

    const packagePath = join(nodeModulesDir, entry.name)

    if (entry.name.startsWith('@')) {
      if (!existsSync(packagePath)) {
        continue
      }

      let scopedEntries = []

      try {
        scopedEntries = readdirSync(packagePath, { withFileTypes: true })
      } catch {
        continue
      }

      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
          packageDirs.push(join(packagePath, scopedEntry.name))
        }
      }

      continue
    }

    packageDirs.push(packagePath)
  }

  return packageDirs
}

function readPackageJson(packageDir) {
  try {
    return readJsonFile(join(packageDir, 'package.json'))
  } catch {
    return null
  }
}

function isPluginPackage(packageJson) {
  const packageName = packageJson.name ?? ''
  const unscopedPackageName = packageName.split('/').at(-1)

  return packageJson['cxa-plugin'] === true && unscopedPackageName.startsWith(PLUGIN_PACKAGE_PREFIX)
}

function normalizePluginManifest(packageDir, packageJson) {
  const manifestPath = join(packageDir, 'manifest.json')
  const templatePath = join(packageDir, 'template')

  if (!existsSync(manifestPath) || !existsSync(templatePath)) {
    throw new Error(`插件 ${packageJson.name} 必须包含 manifest.json 和 template/`)
  }

  let manifest

  try {
    manifest = readJsonFile(manifestPath)
  } catch (error) {
    throw new Error(`插件 ${packageJson.name} 的 manifest.json 解析失败：${error.message}`)
  }

  const normalizedManifest = {
    version: '1.0.0',
    framework: 'plugin',
    requiredPm: null,
    forbiddenPm: [],
    requiredEnv: {},
    optionalEnv: {},
    supportedFeatures: [],
    defaultFeatures: [],
    extras: [],
    subPrompts: [],
    devScript: null,
    buildScript: null,
    devPort: null,
    ...manifest,
    name: `[插件] ${manifest.name}`,
    source: 'plugin',
    packageName: packageJson.name,
    packageVersion: packageJson.version ?? '-',
    packageDescription: packageJson.description ?? '',
    packagePath: packageDir,
    templatePath,
  }

  return validateManifestDefinition(normalizedManifest, {
    packageName: packageJson.name,
  })
}

function inspectPluginPackage(packageDir, packageJson) {
  try {
    const manifest = normalizePluginManifest(packageDir, packageJson)

    return {
      valid: true,
      packageName: packageJson.name,
      packageVersion: packageJson.version ?? '-',
      packageDescription: packageJson.description ?? '',
      packagePath: packageDir,
      packageJson,
      manifest,
      errors: [],
    }
  } catch (error) {
    return {
      valid: false,
      packageName: packageJson.name,
      packageVersion: packageJson.version ?? '-',
      packageDescription: packageJson.description ?? '',
      packagePath: packageDir,
      packageJson,
      manifest: null,
      errors: [error.message],
    }
  }
}

export function inspectPluginTemplates(options = {}) {
  const diagnostics = []
  const nodeModulesDirs = options.nodeModulesDirs ?? getCandidateNodeModulesDirs()

  for (const nodeModulesDir of nodeModulesDirs) {
    for (const packageDir of listPackageDirs(nodeModulesDir)) {
      const packageJson = readPackageJson(packageDir)

      if (!packageJson || !isPluginPackage(packageJson)) {
        continue
      }

      diagnostics.push(inspectPluginPackage(packageDir, packageJson))
    }
  }

  return diagnostics
}

export function loadPluginTemplates(options = {}) {
  return inspectPluginTemplates(options)
    .filter((diagnostic) => diagnostic.valid && diagnostic.manifest)
    .map((diagnostic) => diagnostic.manifest)
}
