import chalk from 'chalk'
import ora from 'ora'
import { logger } from '../utils/logger.js'
import { detectVersion, meetsMinimum } from '../utils/version.js'

const TOOL_DEFINITIONS = [
  {
    name: 'Node.js',
    minimum: '18.0.0',
    required: true,
    command: 'node',
    args: ['--version'],
    missingMessage: 'Node.js 未找到或版本不满足要求',
  },
  {
    name: 'Git',
    minimum: '2.0.0',
    required: false,
    command: 'git',
    args: ['--version'],
    missingMessage: 'Git 未找到，后续无法自动初始化仓库',
  },
  {
    name: 'pnpm',
    minimum: '8.0.0',
    required: false,
    command: 'pnpm',
    args: ['--version'],
    missingMessage: 'pnpm 未找到，仅在用户选择 pnpm 时需要',
  },
  {
    name: 'Java',
    minimum: '21.0.0',
    required: false,
    command: 'java',
    args: ['-version'],
    missingMessage: 'Java 未找到，仅 java-fullstack 模板需要',
  },
]

/**
 * 构建环境检测输出行。
 *
 * 说明：
 * 1. CLI 首屏需要快速让用户理解“工具是否可用、最低要求是多少、影响范围是什么”
 * 2. 这里统一收敛成字符串，避免在主流程里散落格式化逻辑
 *
 * @param {{name: string, minimum: string, detected: string | null, ok: boolean, required: boolean}} result
 * @returns {{status: string, tool: string, version: string, requirement: string, scope: string}}
 */
function buildSummaryRow(result) {
  const row = {
    status: chalk.yellow('⚠ 可选'),
    tool: result.name,
    version: result.detected ? `v${result.detected}` : '未找到',
    requirement: `>= ${result.minimum}`,
    scope: '按需使用',
  }

  if (result.ok) {
    row.status = chalk.green('✔ 通过')
    row.scope = result.required ? '必需' : '可选'
    return row
  }

  if (result.required) {
    row.status = chalk.red('✖ 阻断')
    row.scope = '必需'
    return row
  }

  if (result.name === 'Java') {
    row.scope = 'java-fullstack'
  } else if (result.name === 'pnpm') {
    row.scope = 'pnpm 用户'
  }

  return row
}

/**
 * 执行单个工具检测。
 *
 * @param {{name: string, minimum: string, required: boolean, command: string, args: string[], missingMessage: string}} tool
 * @returns {Promise<{name: string, minimum: string, detected: string | null, ok: boolean, required: boolean, missingMessage: string}>}
 */
async function checkTool(tool) {
  const detected = await detectVersion(tool.command, tool.args)

  return {
    name: tool.name,
    minimum: tool.minimum,
    detected,
    ok: meetsMinimum(detected, tool.minimum),
    required: tool.required,
    missingMessage: tool.missingMessage,
  }
}

export async function runEnvCheck() {
  const spinner = ora('正在检测开发环境...').start()

  try {
    const results = []

    for (const tool of TOOL_DEFINITIONS) {
      spinner.text = `正在检测 ${tool.name}...`
      results.push(await checkTool(tool))
    }

    spinner.succeed('环境检测完成')
    console.log()
    logger.table(
      [
        { key: 'status', title: '状态' },
        { key: 'tool', title: '工具' },
        { key: 'version', title: '检测版本' },
        { key: 'requirement', title: '最低要求' },
        { key: 'scope', title: '影响范围' },
      ],
      results.map((result) => buildSummaryRow(result)),
    )

    const blockingError = results.find((result) => result.required && !result.ok)

    if (blockingError) {
      logger.error(blockingError.missingMessage)
      process.exit(1)
    }

    for (const result of results) {
      if (!result.ok && !result.required) {
        logger.warn(result.missingMessage)
      } else if (result.ok) {
        logger.debug(`${result.name} 检测通过：${result.detected}`)
      }
    }
  } catch (error) {
    spinner.fail('环境检测失败')
    logger.reportError('环境检测过程中发生异常', error)
    process.exit(1)
  }
}
