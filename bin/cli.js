#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import { program } from 'commander'
import { createCommand } from '../src/commands/create.js'
import { installCommand } from '../src/commands/install.js'
import { listCommand } from '../src/commands/list.js'
import { pluginDoctorCommand, pluginInitCommand } from '../src/commands/plugin.js'
import { removeCommand } from '../src/commands/remove.js'
import { searchCommand } from '../src/commands/search.js'
import {
  templateLintCommand,
  templatePackCommand,
  templateTestCommand,
} from '../src/commands/template.js'
import {
  telemetryOffCommand,
  telemetryOnCommand,
  telemetryStatusCommand,
} from '../src/commands/telemetry.js'
import { upgradeCommand } from '../src/commands/upgrade.js'
import { buildHelpExamples, buildHelpHeader } from '../src/ui/create-ui.js'
import { logger, setLoggerOptions } from '../src/utils/logger.js'

if (process.env.NO_COLOR) {
  chalk.level = 0
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(__dirname, '../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

process.on('unhandledRejection', (error) => {
  logger.reportError('发生未处理的 Promise 异常', error)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logger.reportError('发生未捕获异常', error)
  process.exit(1)
})

async function handleCliAction(projectNameArg, options) {
  setLoggerOptions({
    verbose: options.verbose,
    debug: options.debug,
  })

  await createCommand(projectNameArg, {
    ...options,
    cliVersion: packageJson.version,
  })
}

async function handleUpgradeAction(commandOptions) {
  const globalOptions = program.opts()

  setLoggerOptions({
    verbose: globalOptions.verbose,
    debug: globalOptions.debug,
  })

  await upgradeCommand(commandOptions)
}

function applyGlobalLoggerOptions() {
  const options = program.opts()

  setLoggerOptions({
    verbose: options.verbose,
    debug: options.debug,
  })
}

function mergeTemplateCommandOptions(commandOptions) {
  return {
    ...commandOptions,
    template: commandOptions.template ?? program.opts().template,
  }
}

function applyBrandedHelp(command, kind) {
  return command
    .configureHelp({
      helpWidth: 96,
      sortSubcommands: true,
    })
    .addHelpText('before', buildHelpHeader(kind))
    .addHelpText('after', buildHelpExamples(kind))
}

applyBrandedHelp(program, 'main')
  .name('create-x-app')
  .description('几秒内生成生产级项目脚手架')
  .version(packageJson.version)
  .argument('[project-name]', '要创建的项目目录名称')
  .option('--template <key>', '非交互模式：直接指定模板 key')
  .option('--preset <name|path|github>', '使用团队 preset，可为内置名称、本地 JSON 或 github:owner/repo/path#ref')
  .option('--pm <package-manager>', '非交互模式：指定包管理器 npm / pnpm / yarn')
  .option('--features <list>', '非交互模式：指定通用功能，使用逗号分隔')
  .option('--extras <list>', '非交互模式：指定模板扩展，使用逗号分隔')
  .option('-y, --yes', '非交互模式：使用默认值并跳过确认')
  .option('--cwd <path>', '指定创建项目时使用的基准目录')
  .option('--target <path>', '指定生成项目的目标目录')
  .option('--force', '允许覆盖非空目标目录')
  .option('--dry-run', '只输出生成计划，不写入文件')
  .option('--print-config', '输出最终生成配置 JSON 后退出')
  .option('--skip-install', '跳过脚手架完成后的 npm install')
  .option('--skip-git', '跳过 git init')
  .option('--remote', '使用远端模板（默认使用本地模板）')
  .option('--ref <tag|sha|branch>', '配合 --remote 使用，指定远端模板 ref')
  .option('--strict-remote', '配合 --remote 使用，远端拉取失败时直接退出')
  .option('--no-cache', '配合 --remote 使用，忽略缓存强制重新拉取')
  .option('--deps <strategy>', '依赖版本策略：baseline / latest-patch / latest-minor / latest-major / latest')
  .option('--latest', '已弃用：等价于 --deps latest')
  .option('--no-telemetry', '跳过本次匿名使用统计')
  .option('--verbose', '显示详细执行日志')
  .option('--debug', '显示调试日志和错误堆栈')
  .action(handleCliAction)

applyBrandedHelp(program
  .command('upgrade')
  .description('升级当前项目的脚手架配置文件')
  .option('--check', '只检查可升级文件，不修改项目')
  .option('--diff', '打印可升级文件 diff，不修改项目')
  .option('--apply', '非交互应用可安全升级的文件，冲突文件自动跳过')
  .option('--backup', '升级前创建 .create-x-app/backups 备份')
  .option('--from <version>', '记录迁移起始版本')
  .option('--to <version>', '记录迁移目标版本')
  .action(handleUpgradeAction), 'upgrade')

program
  .command('search')
  .description('搜索社区插件模板')
  .argument('[keyword]', '搜索关键词')
  .option('--limit <number>', '最多显示的插件数量', '10')
  .action((keyword, options) => {
    applyGlobalLoggerOptions()
    return searchCommand(keyword, options)
  })

program
  .command('install')
  .description('安装社区插件模板')
  .argument('<package-name>', '插件包名，例如 cxa-plugin-nuxt')
  .action((packageName) => {
    applyGlobalLoggerOptions()
    return installCommand(packageName)
  })

program
  .command('list')
  .description('列出已安装的社区插件模板')
  .action(() => {
    applyGlobalLoggerOptions()
    return listCommand()
  })

program
  .command('remove')
  .description('移除社区插件模板')
  .argument('<package-name>', '插件包名，例如 cxa-plugin-nuxt')
  .action((packageName) => {
    applyGlobalLoggerOptions()
    return removeCommand(packageName)
  })

const pluginCommand = applyBrandedHelp(program
  .command('plugin')
  .description('管理和诊断社区插件模板'), 'plugin')

pluginCommand
  .command('init')
  .description('创建社区插件模板骨架')
  .argument('[target-dir]', '目标目录', 'cxa-plugin-example')
  .action((targetDir) => {
    applyGlobalLoggerOptions()
    return pluginInitCommand(targetDir)
  })

pluginCommand
  .command('doctor')
  .description('检查已安装社区插件的健康度')
  .option('--details', '显示每个插件的逐项检查结果')
  .action((options) => {
    applyGlobalLoggerOptions()
    return pluginDoctorCommand(options)
  })

const templateCommand = applyBrandedHelp(program
  .command('template')
  .description('模板作者工具链'), 'template')

templateCommand
  .command('lint')
  .description('校验模板 manifest')
  .option('--template <key>', '只检查指定模板')
  .action((options) => {
    applyGlobalLoggerOptions()
    return templateLintCommand(mergeTemplateCommandOptions(options))
  })

templateCommand
  .command('test')
  .description('渲染模板并验证生成器链路')
  .option('--template <key>', '只测试指定模板')
  .action((options) => {
    applyGlobalLoggerOptions()
    return templateTestCommand(mergeTemplateCommandOptions(options))
  })

templateCommand
  .command('pack')
  .description('检查模板发布文件清单')
  .option('--template <key>', '只检查指定模板')
  .action((options) => {
    applyGlobalLoggerOptions()
    return templatePackCommand(mergeTemplateCommandOptions(options))
  })

const telemetryCommand = program
  .command('telemetry')
  .description('管理匿名统计配置')

telemetryCommand
  .command('status')
  .description('查看匿名统计状态')
  .action(() => {
    applyGlobalLoggerOptions()
    return telemetryStatusCommand()
  })

telemetryCommand
  .command('on')
  .description('开启匿名统计')
  .action(() => {
    applyGlobalLoggerOptions()
    return telemetryOnCommand()
  })

telemetryCommand
  .command('off')
  .description('关闭匿名统计')
  .action(() => {
    applyGlobalLoggerOptions()
    return telemetryOffCommand()
  })

program.parse()
