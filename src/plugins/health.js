import semver from 'semver'
import { isPluginPackageName } from '../marketplace/client.js'

export const PLUGIN_API_VERSION = '1.0.0'

const RISKY_NPM_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepublish',
  'prepublishOnly',
]

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeRepository(repository) {
  if (isNonEmptyString(repository)) {
    return repository.trim()
  }

  if (repository && typeof repository === 'object' && isNonEmptyString(repository.url)) {
    return repository.url.trim()
  }

  return null
}

function normalizePostActions(postActions) {
  return Array.isArray(postActions)
    ? postActions.filter((action) => isNonEmptyString(action))
    : []
}

export function getRiskyNpmScripts(scripts = {}) {
  if (!scripts || typeof scripts !== 'object') {
    return []
  }

  return RISKY_NPM_SCRIPTS.filter((scriptName) => isNonEmptyString(scripts[scriptName]))
}

export function formatRepository(repository) {
  return normalizeRepository(repository) ?? '-'
}

export function getPluginCompatibility(cxaPluginApi) {
  if (!isNonEmptyString(cxaPluginApi)) {
    return {
      status: 'warn',
      value: '-',
      message: '未声明 CLI API 兼容范围',
      blocking: false,
    }
  }

  const validRange = semver.validRange(cxaPluginApi)

  if (!validRange) {
    return {
      status: 'fail',
      value: cxaPluginApi,
      message: 'CLI API 兼容范围不是有效 semver range',
      blocking: true,
    }
  }

  if (!semver.satisfies(PLUGIN_API_VERSION, validRange, { includePrerelease: true })) {
    return {
      status: 'fail',
      value: cxaPluginApi,
      message: `当前插件 API ${PLUGIN_API_VERSION} 不满足 ${cxaPluginApi}`,
      blocking: true,
    }
  }

  return {
    status: 'pass',
    value: cxaPluginApi,
    message: `兼容当前插件 API ${PLUGIN_API_VERSION}`,
    blocking: false,
  }
}

function createCheck(key, label, status, value, message, blocking = false) {
  return {
    key,
    label,
    status,
    value: value ?? '-',
    message,
    blocking,
  }
}

export function evaluatePluginHealth(plugin = {}) {
  const checks = []
  const packageName = plugin.packageName ?? plugin.name ?? ''
  const packageNameValid = isPluginPackageName(packageName)

  checks.push(createCheck(
    'name',
    '包名',
    packageNameValid ? 'pass' : 'fail',
    packageName || '-',
    packageNameValid ? '符合 cxa-plugin 命名' : '必须是 cxa-plugin-* 或 @scope/cxa-plugin-*',
    !packageNameValid,
  ))

  const cxaPluginDeclared = plugin.isCxaPlugin === true || plugin.cxaPlugin === true

  checks.push(createCheck(
    'declaration',
    '插件声明',
    cxaPluginDeclared ? 'pass' : 'fail',
    cxaPluginDeclared ? 'true' : 'false',
    cxaPluginDeclared ? 'package.json 已声明 cxa-plugin: true' : 'package.json 必须声明 cxa-plugin: true',
    !cxaPluginDeclared,
  ))

  const compatibility = getPluginCompatibility(plugin.cxaPluginApi)
  checks.push(createCheck(
    'compatibility',
    'CLI API',
    compatibility.status,
    compatibility.value,
    compatibility.message,
    compatibility.blocking,
  ))

  const license = plugin.license
  checks.push(createCheck(
    'license',
    'License',
    isNonEmptyString(license) ? 'pass' : 'warn',
    license || '-',
    isNonEmptyString(license) ? '已声明许可证' : '未声明许可证',
  ))

  const repository = normalizeRepository(plugin.repository)
  checks.push(createCheck(
    'repository',
    'Repository',
    repository ? 'pass' : 'warn',
    repository ?? '-',
    repository ? '已声明源码仓库' : '未声明源码仓库',
  ))

  const riskyScripts = getRiskyNpmScripts(plugin.scripts)
  checks.push(createCheck(
    'scripts',
    '安装脚本',
    riskyScripts.length === 0 ? 'pass' : 'warn',
    riskyScripts.length === 0 ? 'none' : riskyScripts.join(', '),
    riskyScripts.length === 0 ? '未声明安装期脚本' : '安装前请审查 npm lifecycle 脚本',
  ))

  const requiresNetwork = plugin.requiresNetwork === true
  checks.push(createCheck(
    'network',
    '网络访问',
    requiresNetwork ? 'warn' : 'pass',
    requiresNetwork ? 'true' : 'false',
    requiresNetwork ? '插件声明生成后步骤可能访问网络' : '未声明额外网络访问',
  ))

  const postActions = normalizePostActions(plugin.postActions)
  checks.push(createCheck(
    'postActions',
    '后置动作',
    postActions.length === 0 ? 'pass' : 'warn',
    postActions.length === 0 ? 'none' : postActions.join(', '),
    postActions.length === 0 ? '未声明插件级后置动作' : '插件声明了生成后动作',
  ))

  const writesOutsideTarget = plugin.writesOutsideTarget === true
  checks.push(createCheck(
    'writesOutsideTarget',
    '目标目录外写入',
    writesOutsideTarget ? 'warn' : 'pass',
    writesOutsideTarget ? 'true' : 'false',
    writesOutsideTarget ? '插件声明可能写入目标目录外' : '未声明目标目录外写入',
  ))

  if (plugin.manifestValid !== undefined) {
    checks.push(createCheck(
      'manifest',
      'Manifest',
      plugin.manifestValid ? 'pass' : 'fail',
      plugin.manifestValid ? 'valid' : 'invalid',
      plugin.manifestValid ? 'manifest 校验通过' : 'manifest 校验失败',
      !plugin.manifestValid,
    ))
  }

  const errors = checks.filter((check) => check.status === 'fail')
  const warnings = checks.filter((check) => check.status === 'warn')
  const score = Math.max(0, 100 - errors.length * 30 - warnings.length * 8)

  return {
    score,
    riskLevel: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    checks,
    errors,
    warnings,
  }
}

export function assertPluginInstallAllowed(health, packageName) {
  const blockingChecks = health.checks.filter((check) => check.blocking)

  if (blockingChecks.length === 0) {
    return
  }

  throw new Error(`${packageName} 未通过安装前检查：${blockingChecks.map((check) => check.message).join('；')}`)
}

export function formatHealthStatus(status) {
  if (status === 'pass') {
    return '通过'
  }

  if (status === 'warn') {
    return '警告'
  }

  return '失败'
}
