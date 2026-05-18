#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { program } from 'commander'
import { createCommand } from '../src/commands/create.js'
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

  await createCommand(projectNameArg, options)
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
  .option('--verbose', '显示详细执行日志')
  .option('--debug', '显示调试日志和错误堆栈')
  .action(handleCliAction)

program.parse()
