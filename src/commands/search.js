import { searchMarketplacePlugins } from '../marketplace/client.js'
import { formatRepository } from '../plugins/health.js'
import { logger } from '../utils/logger.js'

function formatDownloads(downloads) {
  return downloads === null ? '-' : String(downloads)
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  return String(value).slice(0, 10)
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
        { key: 'updatedAt', title: '更新时间' },
        { key: 'license', title: 'License' },
        { key: 'repository', title: 'Repository' },
        { key: 'description', title: '描述' },
      ],
      plugins.map((plugin) => ({
        ...plugin,
        weeklyDownloads: formatDownloads(plugin.weeklyDownloads),
        updatedAt: formatDate(plugin.updatedAt),
        license: plugin.license ?? '-',
        repository: formatRepository(plugin.repository),
      })),
    )
  } catch (error) {
    logger.reportError('搜索社区插件失败', error)
    process.exit(1)
  }
}
