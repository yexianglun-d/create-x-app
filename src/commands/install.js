import { normalizePluginPackageName } from '../marketplace/client.js'
import { runGlobalNpmCommand } from '../marketplace/npm.js'
import { logger } from '../utils/logger.js'

export async function installCommand(packageName) {
  try {
    const normalizedPackageName = normalizePluginPackageName(packageName)

    await runGlobalNpmCommand(`正在安装社区插件 ${normalizedPackageName}...`, [
      'install',
      '-g',
      normalizedPackageName,
    ])

    logger.success(`社区插件已安装：${normalizedPackageName}`)
    logger.info('下次运行 create-x-app 时，该插件模板会出现在模板列表末尾')
  } catch (error) {
    logger.reportError('安装社区插件失败', error)
    process.exit(1)
  }
}
