import { confirm } from '@clack/prompts'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { logger } from '../utils/logger.js'
import { ensurePromptNotCancelled } from '../utils/prompt-helpers.js'

const CONFIG_PATH = join(homedir(), '.create-x-app/config.json')

async function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return {}
  }

  try {
    return JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
  } catch {
    logger.warn(`匿名统计配置读取失败，将重新询问：${CONFIG_PATH}`)
    return {}
  }
}

async function writeConfig(config) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true })
  await writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

function getStoredTelemetryConsent(config) {
  if (typeof config.telemetry?.enabled !== 'boolean') {
    return null
  }

  return config.telemetry.enabled
}

export async function ensureTelemetryConsent({ noTelemetry = false } = {}) {
  if (noTelemetry) {
    return false
  }

  const config = await readConfig()
  const storedConsent = getStoredTelemetryConsent(config)

  if (storedConsent !== null) {
    return storedConsent
  }

  const enabled = ensurePromptNotCancelled(await confirm({
    message: [
      '是否允许发送匿名使用统计？',
      '仅包含模板 key、CLI 版本、Node 版本和 OS 类型；不包含项目名、路径或个人信息。',
    ].join('\n'),
    initialValue: false,
  }))

  await writeConfig({
    ...config,
    telemetry: {
      enabled,
    },
  })

  return enabled
}

export async function getTelemetryConsent({ noTelemetry = false } = {}) {
  if (noTelemetry) {
    return false
  }

  const config = await readConfig()
  return getStoredTelemetryConsent(config)
}

export async function setTelemetryConsent(enabled) {
  const config = await readConfig()

  await writeConfig({
    ...config,
    telemetry: {
      ...config.telemetry,
      enabled,
    },
  })

  return {
    enabled,
    configPath: CONFIG_PATH,
  }
}

export async function getTelemetryStatus() {
  const config = await readConfig()
  const enabled = getStoredTelemetryConsent(config)

  return {
    enabled,
    configured: enabled !== null,
    configPath: CONFIG_PATH,
  }
}
