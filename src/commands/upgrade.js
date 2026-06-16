import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateProject } from '../generator/index.js'
import { loadManifest } from '../manifest/loader.js'
import { resolveTemplate } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'
import {
  applyDiffs,
  printDiff,
  printUpgradeSummary,
} from '../upgrade/applier.js'
import { detectProject } from '../upgrade/detector.js'
import { diffConfigFiles } from '../upgrade/differ.js'
import {
  createUpgradeBackup,
  readFilesMetadata,
  readProjectMetadata,
  recordUpgrade,
  updateTrackedFiles,
} from '../upgrade/metadata.js'

function hasAnyFile(projectDir, filePaths = []) {
  return filePaths.some((filePath) => fs.existsSync(join(projectDir, filePath)))
}

function detectFeatures(projectDir, manifest) {
  return (manifest.supportedFeatures ?? [])
    .filter((feature) => hasAnyFile(projectDir, manifest.features?.[feature]?.artifacts ?? []))
}

function detectExtras(projectDir, manifest, packageJson) {
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }

  return (manifest.extras ?? [])
    .filter((extra) => (
      hasAnyFile(projectDir, extra.artifacts ?? [])
        || (extra.detectDependencies ?? []).some((dependencyName) => dependencies[dependencyName])
    ))
    .map((extra) => extra.key)
}

function detectSubPromptValues(projectDir, manifest) {
  const values = {}

  for (const rule of manifest.subPromptArtifacts ?? []) {
    for (const [optionValue, artifactPaths] of Object.entries(rule.artifactsByValue ?? {})) {
      if (hasAnyFile(projectDir, artifactPaths)) {
        values[rule.key] = optionValue
        break
      }
    }
  }

  return values
}

function detectPackageManager(projectDir, packageJson, manifest) {
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

  return 'npm'
}

function buildUpgradeConfig(projectDir, templateKey, packageJson, manifest, targetDir, projectMetadata) {
  if (projectMetadata) {
    return {
      projectName: projectMetadata.projectName ?? packageJson.name ?? 'upgrade-preview',
      template: projectMetadata.template ?? templateKey,
      features: projectMetadata.features ?? [],
      extras: projectMetadata.extras ?? [],
      fileBasedExtras: (projectMetadata.extras ?? []).filter((extra) => manifest.extras
        .find((candidate) => candidate.key === extra)?.source === 'file'),
      packageManager: manifest.requiredPm ?? projectMetadata.packageManager ?? 'npm',
      targetDir,
    }
  }

  const extras = detectExtras(projectDir, manifest, packageJson)

  return {
    projectName: packageJson.name ?? 'upgrade-preview',
    template: templateKey,
    features: detectFeatures(projectDir, manifest),
    extras,
    fileBasedExtras: extras.filter((extra) => manifest.extras
      .find((candidate) => candidate.key === extra)?.source === 'file'),
    packageManager: detectPackageManager(projectDir, packageJson, manifest),
    targetDir,
    ...detectSubPromptValues(projectDir, manifest),
  }
}

function shouldApply(options) {
  return options.apply === true
}

function shouldOnlyBackup(options) {
  return options.backup === true && !shouldApply(options)
}

function printDiffs(diffs) {
  for (const diff of diffs) {
    printDiff(diff)
  }
}

export async function upgradeCommand(options = {}) {
  const projectDir = process.cwd()
  let previewDir

  try {
    console.log()
    intro(chalk.bgCyan.black(' create-x-app upgrade '))

    const { packageJson, templateKey } = await detectProject(projectDir)
    const projectMetadata = await readProjectMetadata(projectDir)
    const filesMetadata = await readFilesMetadata(projectDir)

    if (!templateKey) {
      throw new Error('无法识别当前项目模板，请确认 package.json 中存在 cxa-template 字段')
    }

    const manifest = loadManifest(templateKey)
    const templatePath = await resolveTemplate(templateKey)

    logger.success(`检测到模板：${manifest.name}（${templateKey}）`)

    previewDir = await fs.mkdtemp(join(tmpdir(), `create-x-app-upgrade-${templateKey}-`))

    await generateProject({
      config: buildUpgradeConfig(projectDir, templateKey, packageJson, manifest, previewDir, projectMetadata),
      templatePath,
    })

    const diffs = await diffConfigFiles(projectDir, previewDir, manifest.upgrade?.managedFiles, {
      filesMetadata,
    })

    if (diffs.length === 0) {
      outro(chalk.green('配置文件已是最新，无需升级'))
      return
    }

    logger.info(`发现 ${diffs.length} 个配置文件存在差异`)
    printUpgradeSummary(diffs)

    if (options.diff) {
      printDiffs(diffs)
    }

    if (options.check || options.diff) {
      const hasUnsafeDiffs = diffs.some((diff) => !diff.safeToApply)

      if (hasUnsafeDiffs) {
        process.exitCode = 1
      }

      outro(chalk.yellow('升级检查完成，未修改项目文件'))
      return
    }

    if (shouldOnlyBackup(options)) {
      const backupDir = await createUpgradeBackup(projectDir, diffs)

      logger.success(`已创建升级备份：${backupDir}`)
      outro(chalk.green('升级备份完成，未修改项目文件'))
      return
    }

    if (options.backup) {
      const backupDir = await createUpgradeBackup(projectDir, diffs)

      logger.success(`已创建升级备份：${backupDir}`)
    }

    const result = await applyDiffs(diffs, {
      mode: shouldApply(options) ? 'safe' : 'interactive',
    })

    await updateTrackedFiles(projectDir, result.appliedFiles)
    await recordUpgrade(projectDir, result, {
      from: options.from,
      to: options.to,
    })

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
