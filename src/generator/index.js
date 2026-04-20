import { cancel, confirm, isCancel } from '@clack/prompts'
import ejs from 'ejs'
import fs from 'fs-extra'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    projectName: config.projectName,
    template: config.template,
    features: config.features,
    extras: config.extras,
    packageManager: config.packageManager,
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

export async function generateProject({ config, templatePath }) {
  try {
    await ensureTargetDirectoryReady(config.targetDir)
    await fs.ensureDir(config.targetDir)

    await copyDirectory(SHARED_DIR, config.targetDir, false)
    await copyDirectory(templatePath, config.targetDir, true)
    await applyExtras(config.extras, config.targetDir)
    await renderEjsFiles(config.targetDir, buildTemplateVariables(config))
    await renameDotfiles(config.targetDir)
    await pruneFeatureArtifacts(config, config.targetDir)
  } catch (error) {
    throw new Error(`生成项目失败：${error.message}`)
  }
}
