import { normalizePluginPackageName } from '../marketplace/client.js'
import { runGlobalNpmCommand } from '../marketplace/npm.js'
import { logger } from '../utils/logger.js'

export async function removeCommand(packageName) {
  try {
    const normalizedPackageName = normalizePluginPackageName(packageName)

    await runGlobalNpmCommand(`正在移除社区插件 ${normalizedPackageName}...`, [
      'uninstall',
      '-g',
      normalizedPackageName,
    ])

    logger.success(`社区插件已移除：${normalizedPackageName}`)
  } catch (error) {
    logger.reportError('移除社区插件失败', error)
    process.exit(1)
  }
}
