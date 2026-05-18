import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

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

function isPluginPackage(packageDir) {
  const packageJsonPath = join(packageDir, 'package.json')

  if (!existsSync(packageJsonPath)) {
    return false
  }

  let packageJson

  try {
    packageJson = readJsonFile(packageJsonPath)
  } catch {
    return false
  }

  const packageName = packageJson.name ?? ''
  const unscopedPackageName = packageName.split('/').at(-1)

  return packageJson['cxa-plugin'] === true && unscopedPackageName.startsWith(PLUGIN_PACKAGE_PREFIX)
}

function normalizePluginManifest(packageDir) {
  const manifestPath = join(packageDir, 'manifest.json')
  const templatePath = join(packageDir, 'template')

  if (!existsSync(manifestPath) || !existsSync(templatePath)) {
    return null
  }

  let manifest

  try {
    manifest = readJsonFile(manifestPath)
  } catch {
    return null
  }

  if (!manifest.key || !manifest.name) {
    return null
  }

  return {
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
    packagePath: packageDir,
    templatePath,
  }
}

export function loadPluginTemplates() {
  const plugins = []

  for (const nodeModulesDir of getCandidateNodeModulesDirs()) {
    for (const packageDir of listPackageDirs(nodeModulesDir)) {
      if (!isPluginPackage(packageDir)) {
        continue
      }

      const plugin = normalizePluginManifest(packageDir)

      if (plugin) {
        plugins.push(plugin)
      }
    }
  }

  return plugins
}
