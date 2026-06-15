import chalk from 'chalk'
import { execa } from 'execa'
import fs from 'fs-extra'
import ora from 'ora'
import { join, relative } from 'node:path'
import { loadManifest } from '../manifest/loader.js'
import { logger } from '../utils/logger.js'
import { createPmAdapter } from '../utils/pm-adapter.js'

function resolveWorkspaceLayout(config) {
  if (config.template === 'java-fullstack') {
    return {
      applicationWorkspace: join(config.targetDir, 'frontend'),
      gitWorkspace: config.targetDir,
      huskyWorkspace: config.targetDir,
      installTargets: config.features.includes('husky')
        ? [config.targetDir, join(config.targetDir, 'frontend')]
        : [join(config.targetDir, 'frontend')],
    }
  }

  return {
    applicationWorkspace: config.targetDir,
    gitWorkspace: config.targetDir,
    huskyWorkspace: config.targetDir,
    installTargets: [config.targetDir],
  }
}

function formatCommand(command, args = []) {
  return [command, ...args].join(' ')
}

function resolveDisplayPath(targetPath) {
  const relativePath = relative(process.cwd(), targetPath)

  if (!relativePath || relativePath.startsWith('..')) {
    return targetPath
  }

  return relativePath
}

function loadTemplateManifest(templateKey) {
  try {
    return loadManifest(templateKey)
  } catch (error) {
    logger.detail(`读取模板 manifest 失败，使用默认后续步骤：${error.message}`)
    return {}
  }
}

/**
 * 执行命令并通过 spinner 展示结果。
 *
 * 说明：
 * 1. 安装依赖属于关键路径，失败后必须终止，避免生成“看似完成但不可运行”的项目
 * 2. Git 初始化、初始提交属于增强步骤，失败时只警告，不阻断项目生成结果
 *
 * @param {{title: string, command: string, args: string[], cwd: string, continueOnError: boolean}} options 命令执行参数
 * @returns {Promise<boolean>} 是否执行成功
 */
async function runCommandWithSpinner(options) {
  const spinner = ora(options.title).start()

  try {
    logger.command(options.command, options.args, options.cwd)

    const result = await execa(options.command, options.args, {
      cwd: options.cwd,
      reject: false,
    })

    if (result.exitCode === 0) {
      spinner.succeed(options.title)
      return true
    }

    const output = (result.stderr || result.stdout || '命令执行失败').trim()
    spinner.fail(options.title)

    if (options.continueOnError) {
      logger.warn(output)
      return false
    }

    throw new Error(output)
  } catch (error) {
    if (spinner.isSpinning) {
      spinner.fail(options.title)
    }

    if (options.continueOnError) {
      logger.warn(error.message || '命令执行失败')
      return false
    }

    throw error
  }
}

async function setHuskyHookPermission({ chmodFile, platform, huskyWorkspace }) {
  if (platform === 'win32') {
    logger.detail('Windows 环境跳过 commit-msg chmod')
    return false
  }

  try {
    await chmodFile(join(huskyWorkspace, '.husky', 'commit-msg'), 0o755)
    return true
  } catch (error) {
    logger.warn(`设置 commit-msg 钩子权限失败：${error.message}`)
    return false
  }
}

function printSkippedHuskyInstructions(pm, workspaceLayout) {
  const installCommand = pm.getInstallCommand()
  const huskyInstallCommand = pm.getDlxCommand('husky', ['install'])

  logger.warn('已跳过依赖安装，Husky 初始化也已跳过。安装依赖后可手动执行：')

  for (const installTarget of workspaceLayout.installTargets) {
    console.log(`  cd ${resolveDisplayPath(installTarget)}`)
    console.log(`  ${formatCommand(installCommand.command, installCommand.args)}`)
  }

  console.log(`  cd ${resolveDisplayPath(workspaceLayout.huskyWorkspace)}`)
  console.log(`  ${formatCommand(huskyInstallCommand.command, huskyInstallCommand.args)}`)
}

async function collectProjectDocuments(targetDir, pathExists) {
  const documents = [
    {
      fileName: 'AGENTS.md',
      description: 'AI 协作规则说明',
    },
    {
      fileName: 'coding-rules.md',
      description: '团队代码规范',
    },
  ]
  const existingDocuments = []

  for (const document of documents) {
    if (await pathExists(join(targetDir, document.fileName))) {
      existingDocuments.push(document)
    }
  }

  return existingDocuments
}

async function printNextSteps(config, workspaceLayout, manifest, pathExists) {
  const relativeRuntimePath = resolveDisplayPath(workspaceLayout.applicationWorkspace)
  const devScript = manifest.devScript ?? 'dev'
  const existingDocuments = await collectProjectDocuments(config.targetDir, pathExists)

  console.log()
  logger.note(chalk.cyan('后续步骤：'), '')
  console.log(`  cd ${relativeRuntimePath}`)
  console.log(`  ${config.packageManager} run ${devScript}`)

  if (existingDocuments.length > 0) {
    console.log()
    logger.note(chalk.cyan('项目文档：'), '')

    for (const document of existingDocuments) {
      console.log(`  ${document.fileName.padEnd(16)}← ${document.description}`)
    }
  }
}

export async function runPostActions({
  config,
  options,
  runner = runCommandWithSpinner,
  chmodFile = fs.chmod,
  pathExists = fs.pathExists,
  platform = process.platform,
}) {
  const pm = createPmAdapter(config.packageManager)
  const workspaceLayout = resolveWorkspaceLayout(config)
  const manifest = loadTemplateManifest(config.template)
  const hasHusky = config.features.includes('husky')

  try {
    logger.debug(`应用工作目录：${workspaceLayout.applicationWorkspace}`)
    logger.debug(`Git 工作目录：${workspaceLayout.gitWorkspace}`)

    if (!options.skipInstall) {
      for (const installTarget of workspaceLayout.installTargets) {
        const installCommand = pm.getInstallCommand()

        await runner({
          title: `正在安装依赖（${config.packageManager} install）...`,
          command: installCommand.command,
          args: installCommand.args,
          cwd: installTarget,
          continueOnError: false,
        })
      }
    } else {
      logger.detail('已跳过依赖安装步骤')
    }

    if (hasHusky && options.skipInstall) {
      printSkippedHuskyInstructions(pm, workspaceLayout)
    } else if (hasHusky) {
      const huskyInstallCommand = pm.getDlxCommand('husky', ['install'])

      await runner({
        title: '正在初始化 Husky...',
        command: huskyInstallCommand.command,
        args: huskyInstallCommand.args,
        cwd: workspaceLayout.huskyWorkspace,
        continueOnError: true,
      })

      await setHuskyHookPermission({
        chmodFile,
        platform,
        huskyWorkspace: workspaceLayout.huskyWorkspace,
      })
    } else {
      logger.detail('未启用 Husky，跳过 Git Hooks 初始化')
    }

    if (!options.skipGit) {
      await runner({
        title: '正在初始化 Git 仓库...',
        command: 'git',
        args: ['init'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })

      await runner({
        title: '正在暂存项目文件...',
        command: 'git',
        args: ['add', '.'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })

      await runner({
        title: '正在创建初始提交...',
        command: 'git',
        args: ['commit', '-m', 'chore: 通过 create-x-app 初始化项目'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })
    } else {
      logger.detail('已跳过 Git 初始化步骤')
    }

    await printNextSteps(config, workspaceLayout, manifest, pathExists)
  } catch (error) {
    throw new Error(`后置步骤执行失败：${error.message}`, {
      cause: error,
    })
  }
}
