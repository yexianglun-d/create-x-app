import { inspectPluginTemplates } from '../plugins/loader.js'
import {
  evaluatePluginHealth,
  formatHealthStatus,
  formatRepository,
} from '../plugins/health.js'
import { logger } from '../utils/logger.js'

function getManifestHealthInput(diagnostic) {
  const manifest = diagnostic.manifest ?? {}
  const packageJson = diagnostic.packageJson ?? {}

  return {
    packageName: diagnostic.packageName,
    name: diagnostic.packageName,
    version: diagnostic.packageVersion,
    description: diagnostic.packageDescription,
    cxaPlugin: packageJson['cxa-plugin'],
    cxaPluginApi: manifest.cxaPluginApi ?? packageJson.cxaPluginApi ?? packageJson['cxa-plugin-api'],
    license: manifest.license ?? packageJson.license,
    repository: manifest.repository ?? packageJson.repository,
    scripts: packageJson.scripts,
    requiresNetwork: manifest.requiresNetwork,
    postActions: manifest.postActions,
    writesOutsideTarget: manifest.writesOutsideTarget,
    manifestValid: diagnostic.valid,
  }
}

function formatIssues(health, diagnostic) {
  const issueMessages = [
    ...diagnostic.errors,
    ...health.errors.map((check) => check.message),
    ...health.warnings.map((check) => check.message),
  ]

  if (issueMessages.length === 0) {
    return '-'
  }

  return [...new Set(issueMessages)].join('；')
}

function printPluginDetails(diagnostic, health) {
  logger.info(`${diagnostic.packageName} 详情`)
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
}

export async function pluginDoctorCommand(options = {}) {
  try {
    const diagnostics = inspectPluginTemplates()

    if (diagnostics.length === 0) {
      logger.warn('当前未发现已安装的社区插件模板')
      return
    }

    const rows = diagnostics.map((diagnostic) => {
      const health = evaluatePluginHealth(getManifestHealthInput(diagnostic))

      return {
        diagnostic,
        health,
        packageName: diagnostic.packageName,
        version: diagnostic.packageVersion,
        templateKey: diagnostic.manifest?.key ?? '-',
        status: formatHealthStatus(health.riskLevel),
        score: health.score,
        repository: formatRepository(diagnostic.manifest?.repository ?? diagnostic.packageJson?.repository),
        issues: formatIssues(health, diagnostic),
      }
    })

    logger.table(
      [
        { key: 'packageName', title: '包名' },
        { key: 'version', title: '版本' },
        { key: 'templateKey', title: '模板 key' },
        { key: 'status', title: '状态' },
        { key: 'score', title: '分数' },
        { key: 'repository', title: 'Repository' },
        { key: 'issues', title: '问题' },
      ],
      rows,
    )

    if (options.details) {
      for (const row of rows) {
        printPluginDetails(row.diagnostic, row.health)
      }
    }

    const hasFailure = rows.some((row) => row.health.riskLevel === 'fail')

    if (hasFailure) {
      process.exitCode = 1
    }
  } catch (error) {
    logger.reportError('检查社区插件失败', error)
    process.exit(1)
  }
}
