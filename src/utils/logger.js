import chalk from 'chalk'
import { relative } from 'node:path'

// 该正则专用于剥离终端 ANSI 控制序列，保留控制字符匹配是预期行为。
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g

const loggerState = {
  verbose: false,
  debug: false,
}

function stripAnsi(value) {
  return String(value).replaceAll(ANSI_PATTERN, '')
}

function getVisibleLength(value) {
  return stripAnsi(value).length
}

function padCell(value, width) {
  const text = String(value)
  const visibleLength = getVisibleLength(text)

  if (visibleLength >= width) {
    return text
  }

  return `${text}${' '.repeat(width - visibleLength)}`
}

function toError(value) {
  if (value instanceof Error) {
    return value
  }

  return new Error(typeof value === 'string' ? value : '未知异常')
}

function normalizeLoggerOptions(options = {}) {
  const debug = Boolean(options.debug)
  return {
    verbose: Boolean(options.verbose) || debug,
    debug,
  }
}

function resolveDisplayPath(targetPath) {
  const relativePath = relative(process.cwd(), targetPath)

  if (!relativePath || relativePath.startsWith('..')) {
    return targetPath
  }

  return relativePath
}

function printLine(writer, icon, message) {
  writer.call(console, icon, message)
}

/**
 * 设置 CLI 日志输出模式。
 *
 * 说明：
 * 1. `debug` 默认包含 `verbose`，避免调试模式下还缺失上下文
 * 2. 日志状态采用模块级单例，保证所有步骤读取的是同一份运行期配置
 *
 * @param {{verbose?: boolean, debug?: boolean}} options CLI 日志配置
 * @returns {{verbose: boolean, debug: boolean}} 归一化后的日志配置
 */
export function setLoggerOptions(options = {}) {
  const normalizedOptions = normalizeLoggerOptions(options)
  loggerState.verbose = normalizedOptions.verbose
  loggerState.debug = normalizedOptions.debug
  return getLoggerOptions()
}

export function getLoggerOptions() {
  return { ...loggerState }
}

export function formatTable(columns, rows) {
  const widths = columns.map((column) => {
    const titleLength = getVisibleLength(column.title)
    const rowLength = Math.max(
      ...rows.map((row) => getVisibleLength(row[column.key] ?? '')),
      0,
    )

    return Math.max(titleLength, rowLength)
  })

  const header = columns
    .map((column, index) => chalk.gray(padCell(column.title, widths[index])))
    .join('  ')

  const separator = columns
    .map((_, index) => chalk.gray('─'.repeat(widths[index])))
    .join('  ')

  const lines = rows.map((row) => columns
    .map((column, index) => padCell(row[column.key] ?? '', widths[index]))
    .join('  '))

  return [header, separator, ...lines]
}

export const logger = {
  info(message) {
    printLine(console.log, chalk.cyan('ℹ'), message)
  },
  success(message) {
    printLine(console.log, chalk.green('✔'), message)
  },
  warn(message) {
    printLine(console.log, chalk.yellow('⚠'), message)
  },
  error(message) {
    printLine(console.error, chalk.red('✖'), message)
  },
  step(message) {
    printLine(console.log, chalk.gray('→'), message)
  },
  note(label, message) {
    console.log(`${chalk.cyan(label)} ${message}`)
  },
  detail(message) {
    if (!loggerState.verbose) {
      return
    }

    printLine(console.log, chalk.gray('·'), chalk.gray(message))
  },
  debug(message) {
    if (!loggerState.debug) {
      return
    }

    printLine(console.log, chalk.magenta('◆'), chalk.magenta(message))
  },
  command(command, args = [], cwd) {
    if (!loggerState.verbose) {
      return
    }

    const renderedCommand = [command, ...args].join(' ')
    const location = cwd ? ` (${resolveDisplayPath(cwd)})` : ''

    this.detail(`执行命令：${renderedCommand}${location}`)
  },
  table(columns, rows) {
    for (const line of formatTable(columns, rows)) {
      console.log(line)
    }
  },
  reportError(context, error) {
    const normalizedError = toError(error)

    this.error(`${context}：${normalizedError.message}`)

    if (loggerState.debug && normalizedError.stack) {
      console.error(chalk.gray(normalizedError.stack))
    } else if (loggerState.verbose && normalizedError.cause instanceof Error) {
      console.error(chalk.gray(`原因：${normalizedError.cause.message}`))
    }
  },
}
