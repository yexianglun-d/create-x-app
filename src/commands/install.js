import { getPluginPackageMetadata, normalizePluginPackageName } from '../marketplace/client.js'
import { runGlobalNpmCommand } from '../marketplace/npm.js'
import { logger } from '../utils/logger.js'

function formatDownloads(downloads) {
  return downloads === null ? '-' : String(downloads)
}

export async function installCommand(packageName) {
  try {
    const normalizedPackageName = normalizePluginPackageName(packageName)
    const metadata = await getPluginPackageMetadata(normalizedPackageName)

    logger.table(
      [
        { key: 'name', title: '包名' },
        { key: 'version', title: '版本' },
        { key: 'weeklyDownloads', title: '周下载量' },
        { key: 'updatedAt', title: '更新时间' },
      ],
      [{
        ...metadata,
        weeklyDownloads: formatDownloads(metadata.weeklyDownloads),
        updatedAt: metadata.updatedAt ? metadata.updatedAt.slice(0, 10) : '-',
      }],
    )

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
