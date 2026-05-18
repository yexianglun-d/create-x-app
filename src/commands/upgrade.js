import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateProject } from '../generator/index.js'
import { loadManifest } from '../manifest/loader.js'
import { resolveTemplate } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'
import { applyDiffs } from '../upgrade/applier.js'
import { detectProject } from '../upgrade/detector.js'
import { diffConfigFiles } from '../upgrade/differ.js'

function detectFeatures(projectDir) {
  return [
    ['eslint', ['.eslintrc.json', 'frontend/.eslintrc.json']],
    ['prettier', ['.prettierrc', 'frontend/.prettierrc']],
    ['husky', ['commitlint.config.js']],
    ['agents', ['AGENTS.md']],
    ['coding-rules', ['coding-rules.md']],
  ]
    .filter(([, filePaths]) => filePaths.some((filePath) => fs.existsSync(join(projectDir, filePath))))
    .map(([feature]) => feature)
}

function detectExtras(projectDir, templateKey, packageJson) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }
  const extras = []

  if ((templateKey === 'react-vite-ts' || templateKey === 'react-admin') && fs.existsSync(join(projectDir, 'tailwind.config.cjs'))) {
    extras.push('tailwind')
  }

  if (templateKey === 'react-vite-ts' && dependencies['react-router-dom']) {
    extras.push('react-router')
  }

  if (templateKey === 'react-admin' && dependencies.i18next) {
    extras.push('i18n')
  }

  if (templateKey === 'node-ts' && dependencies.express) {
    extras.push('express')
  }

  if (templateKey === 'node-ts' && dependencies.dotenv) {
    extras.push('dotenv')
  }

  return extras
}

function detectSubPromptValues(projectDir, templateKey, packageJson) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  if (templateKey !== 'electron-app') {
    return {}
  }

  return {
    renderer: dependencies.vue || fs.existsSync(join(projectDir, 'src/App.vue')) ? 'vue' : 'react',
  }
}

function detectPackageManager(projectDir, templateKey, packageJson, manifest) {
  if (manifest.requiredPm) {
    return manifest.requiredPm
  }

  if (fs.existsSync(join(projectDir, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (fs.existsSync(join(projectDir, 'yarn.lock'))) {
    return 'yarn'
  }

  if (packageJson.packageManager?.startsWith('pnpm@')) {
    return 'pnpm'
  }

  if (packageJson.packageManager?.startsWith('yarn@')) {
    return 'yarn'
  }

  if (templateKey === 'monorepo') {
    return 'pnpm'
  }

  return 'npm'
}

function buildUpgradeConfig(projectDir, templateKey, packageJson, manifest, targetDir) {
  const extras = detectExtras(projectDir, templateKey, packageJson)

  return {
    projectName: packageJson.name ?? 'upgrade-preview',
    template: templateKey,
    features: detectFeatures(projectDir),
    extras,
    fileBasedExtras: extras.filter((extra) => manifest.extras
      .find((candidate) => candidate.key === extra)?.source === 'file'),
    packageManager: detectPackageManager(projectDir, templateKey, packageJson, manifest),
    targetDir,
    ...detectSubPromptValues(projectDir, templateKey, packageJson),
  }
}

export async function upgradeCommand() {
  const projectDir = process.cwd()
  let previewDir

  try {
    console.log()
    intro(chalk.bgCyan.black(' create-x-app upgrade '))

    const { packageJson, templateKey } = await detectProject(projectDir)

    if (!templateKey) {
      throw new Error('无法识别当前项目模板，请确认 package.json 中存在 cxa-template 字段')
    }

    const manifest = loadManifest(templateKey)
    const templatePath = await resolveTemplate(templateKey)

    logger.success(`检测到模板：${manifest.name}（${templateKey}）`)

    previewDir = await fs.mkdtemp(join(tmpdir(), `create-x-app-upgrade-${templateKey}-`))

    await generateProject({
      config: buildUpgradeConfig(projectDir, templateKey, packageJson, manifest, previewDir),
      templatePath,
    })

    const diffs = await diffConfigFiles(projectDir, previewDir)

    if (diffs.length === 0) {
      outro(chalk.green('配置文件已是最新，无需升级'))
      return
    }

    logger.info(`发现 ${diffs.length} 个配置文件存在差异`)

    const result = await applyDiffs(diffs)

    logger.success(`已应用 ${result.appliedFiles.length} 个配置文件`)

    if (result.skippedFiles.length > 0) {
      logger.warn(`已跳过 ${result.skippedFiles.length} 个配置文件：${result.skippedFiles.join(', ')}`)
    }

    outro(chalk.green('项目配置升级完成'))
  } catch (error) {
    logger.reportError('升级项目失败', error)
    process.exit(1)
  } finally {
    if (previewDir) {
      await fs.remove(previewDir)
    }
  }
}
