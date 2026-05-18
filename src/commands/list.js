import { loadPluginTemplates } from '../plugins/loader.js'
import { logger } from '../utils/logger.js'

export async function listCommand() {
  try {
    const plugins = loadPluginTemplates()

    if (plugins.length === 0) {
      logger.warn('当前未安装社区插件模板')
      return
    }

    logger.table(
      [
        { key: 'packageName', title: '包名' },
        { key: 'packageVersion', title: '版本' },
        { key: 'key', title: '模板 key' },
        { key: 'name', title: '模板名称' },
      ],
      plugins.map((plugin) => ({
        packageName: plugin.packageName,
        packageVersion: plugin.packageVersion,
        key: plugin.key,
        name: plugin.name,
      })),
    )
  } catch (error) {
    logger.reportError('读取社区插件失败', error)
    process.exit(1)
  }
}
