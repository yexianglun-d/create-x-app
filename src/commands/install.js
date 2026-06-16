import { getPluginPackageMetadata, normalizePluginPackageName } from '../marketplace/client.js'
import { runGlobalNpmCommand } from '../marketplace/npm.js'
import {
  assertPluginInstallAllowed,
  evaluatePluginHealth,
  formatHealthStatus,
  formatRepository,
} from '../plugins/health.js'
import { logger } from '../utils/logger.js'

function formatDownloads(downloads) {
  return downloads === null ? '-' : String(downloads)
}

function formatDate(value) {
  return value ? value.slice(0, 10) : '-'
}

function printPluginRiskSummary(metadata) {
  const health = evaluatePluginHealth({
    ...metadata,
    packageName: metadata.name,
    cxaPlugin: metadata.isCxaPlugin,
  })

  logger.info('安装前风险摘要')
  logger.table(
    [
      { key: 'label', title: '检查项' },
      { key: 'status', title: '状态' },
      { key: 'value', title: '值' },
      { key: 'message', title: '说明' },
    ],
    health.checks.map((check) => ({
      label: check.label,
      status: formatHealthStatus(check.status),
      value: check.value,
      message: check.message,
    })),
  )

  assertPluginInstallAllowed(health, metadata.name)
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
        { key: 'license', title: 'License' },
        { key: 'repository', title: 'Repository' },
        { key: 'cxaPluginApi', title: 'CLI API' },
      ],
      [{
        ...metadata,
        weeklyDownloads: formatDownloads(metadata.weeklyDownloads),
        updatedAt: formatDate(metadata.updatedAt),
        license: metadata.license ?? '-',
        repository: formatRepository(metadata.repository),
        cxaPluginApi: metadata.cxaPluginApi ?? '-',
      }],
    )

    printPluginRiskSummary(metadata)

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
