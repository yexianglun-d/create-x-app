import { execa } from 'execa'
import semver from 'semver'
import { logger } from './logger.js'

/**
 * 从命令输出中提取第一个可识别的语义化版本号。
 *
 * 说明：
 * 1. 部分工具将版本写到 stdout，例如 `node --version`
 * 2. 部分工具将版本写到 stderr，例如 `java -version`
 * 3. 使用 `semver.coerce` 统一兼容 `v20.11.0`、`20.11` 等格式
 *
 * @param {string} output 命令输出内容
 * @returns {string | null} 标准 semver 字符串，未识别时返回 null
 */
function extractVersion(output) {
  const match = output.match(/(\d+\.\d+(?:\.\d+)?)/)

  if (!match) {
    return null
  }

  return semver.coerce(match[1])?.version ?? null
}

/**
 * 执行命令并检测版本号。
 *
 * @param {string} command 命令名
 * @param {string[]} args 命令参数
 * @returns {Promise<string | null>} 成功返回版本号，失败返回 null
 */
export async function detectVersion(command, args = []) {
  try {
    logger.command(command, args)

    const { stdout, stderr } = await execa(command, args, {
      reject: false,
    })
    const output = stdout || stderr
    const detectedVersion = extractVersion(output)

    logger.debug(`版本探测结果：${command} => ${detectedVersion ?? '未识别'}`)

    return detectedVersion
  } catch {
    logger.debug(`版本探测失败：${command}`)
    return null
  }
}

/**
 * 判断检测到的版本是否满足最低要求。
 *
 * @param {string | null} detected 检测到的版本
 * @param {string} minimum 最低要求版本
 * @returns {boolean} 是否满足最低版本要求
 */
export function meetsMinimum(detected, minimum) {
  if (!detected) {
    return false
  }

  return semver.gte(detected, minimum)
}
