import {
  getTelemetryStatus,
  setTelemetryConsent,
} from '../analytics/consent.js'
import { logger } from '../utils/logger.js'

function formatTelemetryStatus(status) {
  if (!status.configured) {
    return 'unset'
  }

  return status.enabled ? 'on' : 'off'
}

export async function telemetryStatusCommand() {
  try {
    const status = await getTelemetryStatus()

    logger.table(
      [
        { key: 'key', title: '项目' },
        { key: 'value', title: '值' },
      ],
      [
        { key: '状态', value: formatTelemetryStatus(status) },
        { key: '配置文件', value: status.configPath },
      ],
    )
  } catch (error) {
    logger.reportError('读取匿名统计状态失败', error)
    process.exit(1)
  }
}

export async function telemetryOnCommand() {
  try {
    const status = await setTelemetryConsent(true)
    logger.success(`匿名统计已开启：${status.configPath}`)
  } catch (error) {
    logger.reportError('开启匿名统计失败', error)
    process.exit(1)
  }
}

export async function telemetryOffCommand() {
  try {
    const status = await setTelemetryConsent(false)
    logger.success(`匿名统计已关闭：${status.configPath}`)
  } catch (error) {
    logger.reportError('关闭匿名统计失败', error)
    process.exit(1)
  }
}
