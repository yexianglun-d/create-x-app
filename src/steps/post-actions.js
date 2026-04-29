import chalk from 'chalk'
import { execa } from 'execa'
import ora from 'ora'
import { join } from 'node:path'
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

function printNextSteps(config, workspaceLayout) {
  const relativeRuntimePath = workspaceLayout.applicationWorkspace.replace(`${process.cwd()}/`, '')

  console.log()
  logger.note(chalk.cyan('后续步骤：'), '')
  console.log(`  cd ${relativeRuntimePath}`)
  console.log(`  ${config.packageManager} run dev`)
  console.log()
  logger.note(chalk.cyan('项目文档：'), '')
  console.log('  AGENTS.md       ← AI 协作规则说明')
  console.log('  coding-rules.md ← 团队代码规范')
}

export async function runPostActions({ config, options }) {
  const pm = createPmAdapter(config.packageManager)
  const workspaceLayout = resolveWorkspaceLayout(config)
  const shouldInstallDependencies = config.features.includes('husky') || !options.skipInstall

  try {
    logger.debug(`应用工作目录：${workspaceLayout.applicationWorkspace}`)
    logger.debug(`Git 工作目录：${workspaceLayout.gitWorkspace}`)

    if (shouldInstallDependencies) {
      for (const installTarget of workspaceLayout.installTargets) {
        const installCommand = pm.getInstallCommand()

        await runCommandWithSpinner({
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

    if (config.features.includes('husky')) {
      const huskyInstallCommand = pm.getDlxCommand('husky', ['install'])

      await runCommandWithSpinner({
        title: '正在初始化 Husky...',
        command: huskyInstallCommand.command,
        args: huskyInstallCommand.args,
        cwd: workspaceLayout.huskyWorkspace,
        continueOnError: true,
      })

      await runCommandWithSpinner({
        title: '正在设置 commit-msg 钩子权限...',
        command: 'chmod',
        args: ['+x', '.husky/commit-msg'],
        cwd: workspaceLayout.huskyWorkspace,
        continueOnError: true,
      })
    } else {
      logger.detail('未启用 Husky，跳过 Git Hooks 初始化')
    }

    if (!options.skipGit) {
      await runCommandWithSpinner({
        title: '正在初始化 Git 仓库...',
        command: 'git',
        args: ['init'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })

      await runCommandWithSpinner({
        title: '正在暂存项目文件...',
        command: 'git',
        args: ['add', '.'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })

      await runCommandWithSpinner({
        title: '正在创建初始提交...',
        command: 'git',
        args: ['commit', '-m', 'chore: 通过 create-x-app 初始化项目'],
        cwd: workspaceLayout.gitWorkspace,
        continueOnError: true,
      })
    } else {
      logger.detail('已跳过 Git 初始化步骤')
    }

    printNextSteps(config, workspaceLayout)
  } catch (error) {
    throw new Error(`后置步骤执行失败：${error.message}`, {
      cause: error,
    })
  }
}
