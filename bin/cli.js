#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { program } from 'commander'
import { createCommand } from '../src/commands/create.js'
import { installCommand } from '../src/commands/install.js'
import { listCommand } from '../src/commands/list.js'
import { removeCommand } from '../src/commands/remove.js'
import { searchCommand } from '../src/commands/search.js'
import { upgradeCommand } from '../src/commands/upgrade.js'
import { logger, setLoggerOptions } from '../src/utils/logger.js'

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

async function handleUpgradeAction() {
  const options = program.opts()

  setLoggerOptions({
    verbose: options.verbose,
    debug: options.debug,
  })

  await upgradeCommand()
}

function applyGlobalLoggerOptions() {
  const options = program.opts()

  setLoggerOptions({
    verbose: options.verbose,
    debug: options.debug,
  })
}

program
  .name('create-x-app')
  .description('几秒内生成生产级项目脚手架')
  .version(packageJson.version)
  .argument('[project-name]', '要创建的项目目录名称')
  .option('--skip-install', '跳过脚手架完成后的 npm install')
  .option('--skip-git', '跳过 git init')
  .option('--remote', '使用远端最新模板（默认使用本地模板）')
  .option('--no-cache', '配合 --remote 使用，忽略缓存强制重新拉取')
  .option('--latest', '生成时从 npm 拉取最新依赖版本')
  .option('--no-telemetry', '跳过本次匿名使用统计')
  .option('--verbose', '显示详细执行日志')
  .option('--debug', '显示调试日志和错误堆栈')
  .action(handleCliAction)

program
  .command('upgrade')
  .description('升级当前项目的脚手架配置文件')
  .action(handleUpgradeAction)

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

program.parse()
