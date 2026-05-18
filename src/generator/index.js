import { cancel, confirm, isCancel } from '@clack/prompts'
import ejs from 'ejs'
import fs from 'fs-extra'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadManifest } from '../manifest/loader.js'
import { logger } from '../utils/logger.js'
import { getLatestVersions } from '../utils/pkg-version.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHARED_DIR = join(__dirname, '../../shared')
const EXTRA_TEMPLATES_DIR = join(__dirname, '../../templates/extras')
const FILE_BASED_EXTRAS = new Set(['tailwind'])
const FEATURE_ARTIFACTS = {
  eslint: ['.eslintrc.json'],
  prettier: ['.prettierrc'],
  husky: ['.husky', 'commitlint.config.js'],
  agents: ['AGENTS.md'],
  'coding-rules': ['coding-rules.md'],
}
const PACKAGE_MANAGER_VERSIONS = {
  npm: '10.9.2',
  pnpm: '9.12.3',
  yarn: '4.5.1',
}
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

function ensurePromptNotCancelled(value) {
  if (isCancel(value)) {
    cancel('操作已取消')
    process.exit(0)
  }

  return value
}

async function isDirectoryEmpty(targetDir) {
  const entries = await fs.readdir(targetDir)
  return entries.length === 0
}

/**
 * 确保目标目录处于可生成状态。
 *
 * 说明：
 * 1. 非空目录直接写入会产生混合产物，后续难以判断哪些文件来自脚手架
 * 2. 只有在用户明确确认覆盖后才允许清空目录，避免隐式破坏已有内容
 *
 * @param {string} targetDir 目标目录
 * @returns {Promise<void>}
 */
async function ensureTargetDirectoryReady(targetDir) {
  const targetExists = await fs.pathExists(targetDir)

  if (!targetExists) {
    return
  }

  if (await isDirectoryEmpty(targetDir)) {
    return
  }

  const shouldOverwrite = ensurePromptNotCancelled(await confirm({
    message: `目标目录 ${targetDir} 已存在且非空，是否覆盖？`,
    initialValue: false,
  }))

  if (!shouldOverwrite) {
    cancel('操作已取消')
    process.exit(0)
  }

  await fs.emptyDir(targetDir)
}

async function copyDirectory(sourceDir, targetDir, overwrite) {
  const sourceExists = await fs.pathExists(sourceDir)

  if (!sourceExists) {
    throw new Error(`模板目录不存在：${sourceDir}`)
  }

  await fs.copy(sourceDir, targetDir, {
    overwrite,
    errorOnExist: false,
  })
}

async function collectEjsFiles(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true })
  const ejsFiles = []

  for (const entry of entries) {
    const currentPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      ejsFiles.push(...await collectEjsFiles(currentPath))
      continue
    }

    if (entry.name.endsWith('.ejs')) {
      ejsFiles.push(currentPath)
    }
  }

  return ejsFiles
}

function buildTemplateVariables(config) {
  return {
    ...config,
    projectName: config.projectName,
    template: config.template,
    features: config.features,
    extras: config.extras,
    packageManager: config.packageManager,
    packageManagerSpecifier: `${config.packageManager}@${PACKAGE_MANAGER_VERSIONS[config.packageManager] ?? 'latest'}`,
    versions: {},
    hasEslint: config.features.includes('eslint'),
    hasPrettier: config.features.includes('prettier'),
    hasHusky: config.features.includes('husky'),
    year: new Date().getFullYear(),
    nodeVersion: process.version,
  }
}

/**
 * 渲染目标目录内所有 EJS 文件。
 *
 * 说明：
 * 1. 先完整复制文件树，再统一做模板渲染，能保证公共文件与模板文件使用同一套变量
 * 2. 采用“写入新文件 + 删除 .ejs 原文件”的方式，避免中途失败时破坏源模板结构
 *
 * @param {string} targetDir 目标目录
 * @param {Record<string, unknown>} templateVariables 模板变量
 * @returns {Promise<void>}
 */
async function renderEjsFiles(targetDir, templateVariables) {
  const ejsFiles = await collectEjsFiles(targetDir)

  for (const ejsFilePath of ejsFiles) {
    const renderedContent = await ejs.renderFile(ejsFilePath, templateVariables)
    const outputFilePath = ejsFilePath.slice(0, -4)

    await fs.writeFile(outputFilePath, renderedContent, 'utf8')
    await fs.remove(ejsFilePath)
  }
}

async function collectPackageJsonFiles(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true })
  const packageJsonFiles = []

  for (const entry of entries) {
    const currentPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        continue
      }

      packageJsonFiles.push(...await collectPackageJsonFiles(currentPath))
      continue
    }

    if (entry.name === 'package.json') {
      packageJsonFiles.push(currentPath)
    }
  }

  return packageJsonFiles
}

function collectDependencyNames(packageJson) {
  const dependencyNames = []

  for (const field of DEPENDENCY_FIELDS) {
    for (const [dependencyName, versionSpecifier] of Object.entries(packageJson[field] ?? {})) {
      if (!shouldRefreshVersion(versionSpecifier)) {
        continue
      }

      dependencyNames.push(dependencyName)
    }
  }

  return dependencyNames
}

function shouldRefreshVersion(versionSpecifier) {
  return typeof versionSpecifier === 'string' && /^[~^]?\d+\.\d+\.\d+/.test(versionSpecifier)
}

function applyLatestVersions(packageJson, latestVersions) {
  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field]

    if (!dependencies) {
      continue
    }

    for (const [dependencyName, currentVersion] of Object.entries(dependencies)) {
      if (!shouldRefreshVersion(currentVersion)) {
        continue
      }

      const latestVersion = latestVersions[dependencyName]

      if (!latestVersion) {
        continue
      }

      const rangePrefix = currentVersion.match(/^[~^]/)?.[0] ?? ''
      dependencies[dependencyName] = `${rangePrefix}${latestVersion}`
    }
  }
}

/**
 * 将已渲染 package.json 中的依赖刷新到 npm 最新版本。
 *
 * 说明：
 * 1. 先渲染再扫描，确保只处理用户真实选择后存在的依赖
 * 2. 单个包拉取失败只回退该包的基线版本，不影响项目生成主流程
 *
 * @param {string} targetDir 项目输出目录
 * @returns {Promise<void>}
 */
async function refreshPackageVersions(targetDir) {
  const packageJsonFiles = await collectPackageJsonFiles(targetDir)
  const packageJsonByPath = new Map()
  const dependencyNames = new Set()

  for (const packageJsonFile of packageJsonFiles) {
    const packageJson = await fs.readJson(packageJsonFile)
    packageJsonByPath.set(packageJsonFile, packageJson)

    for (const dependencyName of collectDependencyNames(packageJson)) {
      dependencyNames.add(dependencyName)
    }
  }

  if (dependencyNames.size === 0) {
    return
  }

  logger.step('正在检测最新依赖版本...')

  const latestVersions = await getLatestVersions([...dependencyNames])
  const failedPackages = Object.entries(latestVersions)
    .filter(([, latestVersion]) => !latestVersion)
    .map(([packageName]) => packageName)

  if (failedPackages.length > 0) {
    if (failedPackages.length === dependencyNames.size) {
      logger.warn('依赖版本拉取失败，使用基线版本')
    } else {
      logger.warn(`部分依赖版本拉取失败，使用基线版本：${failedPackages.join(', ')}`)
    }
  }

  for (const [packageJsonFile, packageJson] of packageJsonByPath.entries()) {
    applyLatestVersions(packageJson, latestVersions)
    await fs.writeFile(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  }
}

/**
 * 将 npm 发布时使用下划线占位的点文件恢复为真实点文件。
 *
 * @param {string} targetDir 需要处理的目录
 * @returns {Promise<void>}
 */
async function renameDotfiles(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true })

  for (const entry of entries) {
    const currentPath = join(targetDir, entry.name)
    let normalizedPath = currentPath

    if (entry.name.startsWith('_')) {
      const normalizedName = `.${entry.name.slice(1)}`
      normalizedPath = join(targetDir, normalizedName)
      await fs.move(currentPath, normalizedPath, { overwrite: true })
    }

    if (entry.isDirectory()) {
      await renameDotfiles(normalizedPath)
    }
  }
}

async function applyExtras(extras, targetDir) {
  for (const extra of extras) {
    if (!FILE_BASED_EXTRAS.has(extra)) {
      continue
    }

    const extraTemplateDir = join(EXTRA_TEMPLATES_DIR, extra)
    const extraExists = await fs.pathExists(extraTemplateDir)

    if (!extraExists) {
      throw new Error(`未找到扩展模板：${extra}`)
    }

    await fs.copy(extraTemplateDir, targetDir, {
      overwrite: true,
      errorOnExist: false,
    })
  }
}

/**
 * 删除仅供脚手架运行期使用的模板元数据文件。
 *
 * 说明：
 * 1. `manifest.json` 是模板注册元数据，不属于最终项目产物
 * 2. 必须在渲染 `.ejs` 文件之前移除，避免与未来模板中真实的 `manifest.json.ejs` 输出冲突
 *
 * @param {string} targetDir 项目输出目录
 * @returns {Promise<void>}
 */
async function removeTemplateMetadata(targetDir) {
  await fs.remove(join(targetDir, 'manifest.json'))
}

async function pruneFeatureArtifacts(config, targetDir) {
  const enabledFeatures = new Set(config.features)

  for (const [featureName, artifactPaths] of Object.entries(FEATURE_ARTIFACTS)) {
    if (enabledFeatures.has(featureName)) {
      continue
    }

    for (const artifactPath of artifactPaths) {
      await fs.remove(join(targetDir, artifactPath))
    }
  }
}

/**
 * 删除未启用模板扩展对应的文件产物。
 *
 * 说明：
 * 1. inline extra 可能通过条件渲染输出空文件，若不清理会污染最终项目结构
 * 2. 由 manifest 声明 artifact 清单，生成器统一裁剪，避免把额外规则散落到模板代码里
 *
 * @param {Record<string, unknown>} config 用户选择配置
 * @param {string} targetDir 项目输出目录
 * @returns {Promise<void>}
 */
async function pruneExtraArtifacts(config, targetDir, manifest) {
  const enabledExtras = new Set(config.extras)

  for (const extra of manifest.extras ?? []) {
    if (enabledExtras.has(extra.key)) {
      continue
    }

    for (const artifactPath of extra.artifacts ?? []) {
      await fs.remove(join(targetDir, artifactPath))
    }
  }
}

/**
 * 删除与当前子问答选择不匹配的模板文件。
 *
 * 说明：
 * 1. Electron 等模板会根据子问答生成不同实现分支，例如 Vue 与 React 渲染层
 * 2. 通过 manifest 声明各选项对应的文件归属，可以避免把“删哪些文件”的规则硬编码到生成器
 *
 * @param {Record<string, unknown>} config 用户选择配置
 * @param {string} targetDir 项目输出目录
 * @param {{subPromptArtifacts?: Array<{key: string, artifactsByValue?: Record<string, string[]>}>}} manifest 模板声明
 * @returns {Promise<void>}
 */
async function pruneSubPromptArtifacts(config, targetDir, manifest) {
  for (const rule of manifest.subPromptArtifacts ?? []) {
    const selectedValue = config[rule.key]

    for (const [optionValue, artifactPaths] of Object.entries(rule.artifactsByValue ?? {})) {
      if (optionValue === selectedValue) {
        continue
      }

      for (const artifactPath of artifactPaths) {
        await fs.remove(join(targetDir, artifactPath))
      }
    }
  }
}

export async function generateProject({ config, options = {}, templatePath }) {
  try {
    const manifest = loadManifest(config.template)

    await ensureTargetDirectoryReady(config.targetDir)
    await fs.ensureDir(config.targetDir)

    await copyDirectory(SHARED_DIR, config.targetDir, false)
    await copyDirectory(templatePath, config.targetDir, true)
    await applyExtras(config.fileBasedExtras ?? config.extras, config.targetDir)
    await removeTemplateMetadata(config.targetDir)
    await renderEjsFiles(config.targetDir, buildTemplateVariables(config))
    await renameDotfiles(config.targetDir)
    await pruneSubPromptArtifacts(config, config.targetDir, manifest)
    await pruneExtraArtifacts(config, config.targetDir, manifest)
    await pruneFeatureArtifacts(config, config.targetDir)

    if (options.latest) {
      await refreshPackageVersions(config.targetDir)
    }
  } catch (error) {
    throw new Error(`生成项目失败：${error.message}`)
  }
}
