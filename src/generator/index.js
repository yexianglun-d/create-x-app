import ejs from 'ejs'
import fs from 'fs-extra'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import semver from 'semver'
import { loadManifest } from '../manifest/loader.js'
import {
  buildDryRunSummaryLines as buildUiDryRunSummaryLines,
  printLines,
} from '../ui/create-ui.js'
import { logger } from '../utils/logger.js'
import { getPackageVersionMetadata } from '../utils/pkg-version.js'
import { writeProjectTrackingMetadata } from '../upgrade/metadata.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHARED_DIR = join(__dirname, '../../shared')
const EXTRA_TEMPLATES_DIR = join(__dirname, '../../templates/extras')
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
const DEPENDENCY_STRATEGY_BASELINE = 'baseline'
const DEPENDENCY_UPGRADE_STRATEGIES = new Set([
  'latest-patch',
  'latest-minor',
  'latest-major',
  'latest',
])

async function isDirectoryEmpty(targetDir) {
  const entries = await fs.readdir(targetDir)
  return entries.length === 0
}

function getExtraDefinition(manifest, extraKey) {
  return (manifest.extras ?? []).find((extra) => extra.key === extraKey)
}

function isFileBasedExtra(extraDefinition) {
  return extraDefinition?.source === 'file'
}

/**
 * 确保目标目录处于可生成状态。
 *
 * 说明：
 * 1. 非空目录直接写入会产生混合产物，后续难以判断哪些文件来自脚手架
 * 2. 默认拒绝覆盖非空目录，只有用户显式传入 --force 才允许清空
 *
 * @param {string} targetDir 目标目录
 * @param {{force?: boolean, dryRun?: boolean}} options 目录安全选项
 * @returns {Promise<void>}
 */
async function ensureTargetDirectoryReady(targetDir, options = {}) {
  const targetExists = await fs.pathExists(targetDir)

  if (!targetExists) {
    return
  }

  if (await isDirectoryEmpty(targetDir)) {
    return
  }

  if (options.dryRun) {
    return
  }

  if (!options.force) {
    throw new Error(`目标目录已存在且非空：${targetDir}。如需覆盖，请显式添加 --force`)
  }

  logger.warn(`将覆盖非空目录：${targetDir}`)
  await fs.emptyDir(targetDir)
}

async function collectRelativeFiles(sourceDir, rootDir = sourceDir) {
  const sourceExists = await fs.pathExists(sourceDir)

  if (!sourceExists) {
    return []
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const currentPath = join(sourceDir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectRelativeFiles(currentPath, rootDir))
      continue
    }

    files.push(relative(rootDir, currentPath).replaceAll('\\', '/'))
  }

  return files
}

function normalizePlannedFilePath(filePath) {
  const normalizedPath = filePath
    .replace(/(^|\/)_([^/]+)/g, '$1.$2')
    .replace(/\.ejs$/, '')

  return normalizedPath
}

function deletePlannedArtifact(plannedFiles, artifactPath) {
  plannedFiles.delete(normalizePlannedFilePath(artifactPath))
}

function buildFinalPlannedFiles(plannedFiles, config, manifest) {
  const finalFiles = new Set([...plannedFiles].map(normalizePlannedFilePath))
  const enabledFeatures = new Set(config.features)
  const enabledExtras = new Set(config.extras)

  finalFiles.delete('manifest.json')

  for (const [featureName, featureDefinition] of Object.entries(manifest.features ?? {})) {
    if (enabledFeatures.has(featureName)) {
      continue
    }

    for (const artifactPath of featureDefinition.artifacts ?? []) {
      deletePlannedArtifact(finalFiles, artifactPath)
    }
  }

  for (const extra of manifest.extras ?? []) {
    if (enabledExtras.has(extra.key)) {
      continue
    }

    for (const artifactPath of extra.artifacts ?? []) {
      deletePlannedArtifact(finalFiles, artifactPath)
    }
  }

  for (const rule of manifest.subPromptArtifacts ?? []) {
    const selectedValue = config[rule.key]

    for (const [optionValue, artifactPaths] of Object.entries(rule.artifactsByValue ?? {})) {
      if (optionValue === selectedValue) {
        continue
      }

      for (const artifactPath of artifactPaths) {
        deletePlannedArtifact(finalFiles, artifactPath)
      }
    }
  }

  finalFiles.add('.create-x-app/template-lock.json')

  return finalFiles
}

export function buildDryRunSummaryLines({
  config,
  manifest,
  plannedFiles,
  dependencyStrategy,
  templateSource,
  options = {},
}) {
  const normalizedFiles = new Set([...plannedFiles].map(normalizePlannedFilePath))

  return buildUiDryRunSummaryLines({
    config,
    manifest,
    plannedFiles: normalizedFiles,
    dependencyStrategy: dependencyStrategy ?? DEPENDENCY_STRATEGY_BASELINE,
    templateSource,
    options,
  })
}

async function printDryRunSummary({
  config,
  templatePath,
  manifest,
  dependencyStrategy,
  templateSource,
  options = {},
}) {
  const plannedFiles = new Set([
    ...await collectRelativeFiles(SHARED_DIR),
    ...await collectRelativeFiles(templatePath),
  ])

  for (const extra of config.fileBasedExtras ?? config.extras) {
    const extraDefinition = getExtraDefinition(manifest, extra)

    if (!isFileBasedExtra(extraDefinition)) {
      continue
    }

    const extraTemplateDir = join(EXTRA_TEMPLATES_DIR, extraDefinition.templatePath ?? extra)

    for (const filePath of await collectRelativeFiles(extraTemplateDir)) {
      plannedFiles.add(filePath)
    }
  }
  const finalPlannedFiles = buildFinalPlannedFiles(plannedFiles, config, manifest)

  printLines(buildDryRunSummaryLines({
    config,
    manifest,
    plannedFiles: finalPlannedFiles,
    dependencyStrategy,
    templateSource,
    options,
  }))
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

async function writeProjectMetadata(targetDir, config, manifest) {
  const packageJsonPath = join(targetDir, 'package.json')
  const packageJsonExists = await fs.pathExists(packageJsonPath)

  if (!packageJsonExists) {
    return
  }

  const packageJson = await fs.readJson(packageJsonPath)
  packageJson['cxa-template'] = config.template
  packageJson['cxa-version'] = manifest.version

  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
}

function normalizeTemplateSource(templateSource, manifest) {
  if (templateSource) {
    return templateSource
  }

  if (manifest.source === 'plugin') {
    return {
      type: 'plugin',
      packageName: manifest.packageName,
      packageVersion: manifest.packageVersion,
    }
  }

  return {
    type: manifest.source ?? 'builtin',
  }
}

async function writeTemplateLock(targetDir, config, manifest, options = {}) {
  const templateSource = normalizeTemplateSource(options.templateSource, manifest)
  const safeTemplateSource = { ...templateSource }
  delete safeTemplateSource.templatePath
  const lock = {
    schemaVersion: '1.0',
    template: {
      key: manifest.key,
      name: manifest.name,
      version: manifest.version,
    },
    source: safeTemplateSource,
    cli: {
      name: 'create-x-app-cli',
      version: options.cliVersion ?? null,
    },
    selection: {
      packageManager: config.packageManager,
      features: config.features,
      extras: config.extras,
      dependencyStrategy: options.dependencyStrategy ?? DEPENDENCY_STRATEGY_BASELINE,
    },
    createdAt: new Date().toISOString(),
  }

  await fs.outputJson(join(targetDir, '.create-x-app', 'template-lock.json'), lock, {
    spaces: 2,
  })
  await fs.appendFile(join(targetDir, '.create-x-app', 'template-lock.json'), '\n')
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

function getRangePrefix(versionSpecifier) {
  return versionSpecifier.match(/^[~^]/)?.[0] ?? ''
}

function getBaseVersion(versionSpecifier) {
  try {
    return semver.minVersion(versionSpecifier)?.version ?? null
  } catch {
    return null
  }
}

function getStableVersions(versionMetadata) {
  return (versionMetadata?.versions ?? [])
    .filter((version) => semver.valid(version))
    .filter((version) => semver.parse(version).prerelease.length === 0)
}

function pickHighestVersion(versions) {
  return versions.sort((left, right) => semver.rcompare(left, right))[0] ?? null
}

function pickPatchVersion(currentVersion, versions) {
  const current = semver.parse(currentVersion)

  return pickHighestVersion(versions.filter((version) => {
    const parsedVersion = semver.parse(version)

    return parsedVersion.major === current.major
      && parsedVersion.minor === current.minor
      && semver.gt(version, currentVersion)
  }))
}

function pickMinorVersion(currentVersion, versions) {
  const current = semver.parse(currentVersion)

  return pickHighestVersion(versions.filter((version) => {
    const parsedVersion = semver.parse(version)

    return parsedVersion.major === current.major && semver.gt(version, currentVersion)
  }))
}

function pickLatestVersion(currentVersion, versionMetadata) {
  const latestVersion = versionMetadata?.latest

  if (!latestVersion || !semver.valid(latestVersion) || !semver.gt(latestVersion, currentVersion)) {
    return null
  }

  return latestVersion
}

export function resolveDependencyVersion(currentVersionSpecifier, versionMetadata, strategy) {
  const currentVersion = getBaseVersion(currentVersionSpecifier)

  if (!currentVersion || !versionMetadata) {
    return null
  }

  if (strategy === 'latest-major' || strategy === 'latest') {
    return pickLatestVersion(currentVersion, versionMetadata)
  }

  const stableVersions = getStableVersions(versionMetadata)

  if (strategy === 'latest-patch') {
    return pickPatchVersion(currentVersion, stableVersions)
  }

  if (strategy === 'latest-minor') {
    return pickMinorVersion(currentVersion, stableVersions)
  }

  return null
}

function applyDependencyStrategy(packageJson, versionMetadataByName, strategy) {
  let updatedCount = 0

  for (const field of DEPENDENCY_FIELDS) {
    const dependencies = packageJson[field]

    if (!dependencies) {
      continue
    }

    for (const [dependencyName, currentVersion] of Object.entries(dependencies)) {
      if (!shouldRefreshVersion(currentVersion)) {
        continue
      }

      const resolvedVersion = resolveDependencyVersion(
        currentVersion,
        versionMetadataByName[dependencyName],
        strategy,
      )

      if (!resolvedVersion) {
        continue
      }

      dependencies[dependencyName] = `${getRangePrefix(currentVersion)}${resolvedVersion}`
      updatedCount += 1
    }
  }

  return updatedCount
}

/**
 * 按用户选择的依赖策略刷新已渲染 package.json 中的依赖。
 *
 * 说明：
 * 1. 先渲染再扫描，确保只处理用户真实选择后存在的依赖
 * 2. 单个包拉取失败只回退该包的基线版本，不影响项目生成主流程
 *
 * @param {string} targetDir 项目输出目录
 * @param {string} strategy 依赖升级策略
 * @returns {Promise<void>}
 */
async function refreshPackageVersions(targetDir, strategy) {
  if (strategy === DEPENDENCY_STRATEGY_BASELINE) {
    return
  }

  if (!DEPENDENCY_UPGRADE_STRATEGIES.has(strategy)) {
    throw new Error(`不支持的依赖策略：${strategy}`)
  }

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

  logger.step(`正在按 ${strategy} 策略检测依赖版本...`)

  const versionMetadataByName = await getPackageVersionMetadata([...dependencyNames])
  const failedPackages = Object.entries(versionMetadataByName)
    .filter(([, versionMetadata]) => !versionMetadata)
    .map(([packageName]) => packageName)

  if (failedPackages.length > 0) {
    if (failedPackages.length === dependencyNames.size) {
      logger.warn('依赖版本拉取失败，使用基线版本')
    } else {
      logger.warn(`部分依赖版本拉取失败，使用基线版本：${failedPackages.join(', ')}`)
    }
  }

  let updatedCount = 0

  for (const [packageJsonFile, packageJson] of packageJsonByPath.entries()) {
    updatedCount += applyDependencyStrategy(packageJson, versionMetadataByName, strategy)
    await fs.writeFile(packageJsonFile, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
  }

  if (updatedCount === 0) {
    logger.info(`依赖策略 ${strategy} 未产生可用升级，继续使用模板基线版本`)
  } else {
    logger.success(`已按 ${strategy} 策略更新 ${updatedCount} 个依赖声明`)
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

async function applyExtras(extras, targetDir, manifest) {
  for (const extra of extras) {
    const extraDefinition = getExtraDefinition(manifest, extra)

    if (!isFileBasedExtra(extraDefinition)) {
      continue
    }

    const extraTemplateDir = join(EXTRA_TEMPLATES_DIR, extraDefinition.templatePath ?? extra)
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

  for (const [featureName, featureDefinition] of Object.entries(config.manifestFeatures ?? {})) {
    if (enabledFeatures.has(featureName)) {
      continue
    }

    for (const artifactPath of featureDefinition.artifacts ?? []) {
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

export async function generateProject({ config, options = {}, templatePath, templateSource }) {
  try {
    const manifest = loadManifest(config.template)

    await ensureTargetDirectoryReady(config.targetDir, {
      force: options.force,
      dryRun: options.dryRun,
    })

    if (options.dryRun) {
      await printDryRunSummary({
        config,
        templatePath,
        manifest,
        dependencyStrategy: options.dependencyStrategy,
        templateSource,
        options,
      })
      return { dryRun: true }
    }

    await fs.ensureDir(config.targetDir)

    await copyDirectory(SHARED_DIR, config.targetDir, false)
    await copyDirectory(templatePath, config.targetDir, true)
    await applyExtras(config.fileBasedExtras ?? config.extras, config.targetDir, manifest)
    await removeTemplateMetadata(config.targetDir)
    await renderEjsFiles(config.targetDir, buildTemplateVariables(config))
    await writeProjectMetadata(config.targetDir, config, manifest)
    await renameDotfiles(config.targetDir)
    await pruneSubPromptArtifacts(config, config.targetDir, manifest)
    await pruneExtraArtifacts(config, config.targetDir, manifest)
    await pruneFeatureArtifacts({
      ...config,
      manifestFeatures: manifest.features,
    }, config.targetDir)

    await refreshPackageVersions(
      config.targetDir,
      options.dependencyStrategy ?? DEPENDENCY_STRATEGY_BASELINE,
    )
    await writeTemplateLock(config.targetDir, config, manifest, {
      cliVersion: options.cliVersion,
      dependencyStrategy: options.dependencyStrategy,
      templateSource,
    })
    await writeProjectTrackingMetadata(config.targetDir, config, manifest, {
      cliVersion: options.cliVersion,
      dependencyStrategy: options.dependencyStrategy,
      preset: options.preset,
    })
  } catch (error) {
    throw new Error(`生成项目失败：${error.message}`)
  }
}
