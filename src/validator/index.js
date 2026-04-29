import { loadManifest } from '../manifest/loader.js'

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn']

function buildAllowedPackageManagers(forbiddenPm = []) {
  return PACKAGE_MANAGERS.filter((packageManager) => !forbiddenPm.includes(packageManager))
}

/**
 * 计算配置校验错误列表。
 *
 * 说明：
 * 1. 校验层只负责识别非法组合，不直接处理进程退出，便于在测试和主流程中复用
 * 2. Monorepo 的 pnpm 约束优先于通用 manifest 规则，避免向用户输出重复错误
 *
 * @param {{template: string, packageManager: string, extras?: string[]}} config 交互得到的项目配置
 * @returns {string[]} 阻断性错误列表
 */
export function getConfigValidationErrors(config) {
  const manifest = loadManifest(config.template)
  const errors = []

  if (config.template === 'monorepo' && config.packageManager !== 'pnpm') {
    errors.push('Monorepo 模板必须使用 pnpm（依赖 pnpm workspace）')
  } else if (manifest.requiredPm && config.packageManager !== manifest.requiredPm) {
    errors.push(`${manifest.name} 必须使用 ${manifest.requiredPm}`)
  } else if (manifest.forbiddenPm?.includes(config.packageManager)) {
    const allowedPackageManagers = buildAllowedPackageManagers(manifest.forbiddenPm)

    errors.push(`${manifest.name} 不支持 ${config.packageManager}，请选择 ${allowedPackageManagers.join(' 或 ')}`)
  }

  if (config.extras?.includes('react-router') && manifest.framework !== 'react') {
    errors.push('React Router 仅适用于 React 类模板')
  }

  return errors
}

export function validateConfig(config) {
  const validationErrors = getConfigValidationErrors(config)

  if (validationErrors.length === 0) {
    return
  }

  throw new Error(validationErrors.join('\n'))
}
