import { searchMarketplacePlugins } from '../marketplace/client.js'
import { logger } from '../utils/logger.js'

function formatDownloads(downloads) {
  return downloads === null ? '-' : String(downloads)
}

export async function searchCommand(keyword, options = {}) {
  try {
    const plugins = await searchMarketplacePlugins(keyword, {
      limit: options.limit,
    })

    if (plugins.length === 0) {
      logger.warn('未找到社区插件模板')
      return
    }

    logger.table(
      [
        { key: 'name', title: '包名' },
        { key: 'version', title: '版本' },
        { key: 'weeklyDownloads', title: '周下载量' },
        { key: 'description', title: '描述' },
      ],
      plugins.map((plugin) => ({
        ...plugin,
        weeklyDownloads: formatDownloads(plugin.weeklyDownloads),
      })),
    )
  } catch (error) {
    logger.reportError('搜索社区插件失败', error)
    process.exit(1)
  }
}
