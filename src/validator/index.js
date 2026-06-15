import { loadManifest } from '../manifest/loader.js'

const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn']

function buildAllowedPackageManagers(forbiddenPm = []) {
  return PACKAGE_MANAGERS.filter((packageManager) => !forbiddenPm.includes(packageManager))
}

export function getConfigValidationErrors(config) {
  const manifest = loadManifest(config.template)
  const errors = []
  const supportedFeatures = new Set(manifest.supportedFeatures ?? [])
  const supportedExtras = new Set((manifest.extras ?? []).map((extra) => extra.key))

  if (!PACKAGE_MANAGERS.includes(config.packageManager)) {
    errors.push(`不支持的包管理器：${config.packageManager}`)
  }

  for (const feature of config.features ?? []) {
    if (!supportedFeatures.has(feature)) {
      errors.push(`${manifest.name} 不支持功能项：${feature}`)
    }
  }

  for (const extra of config.extras ?? []) {
    if (!supportedExtras.has(extra)) {
      errors.push(`${manifest.name} 不支持模板扩展：${extra}`)
    }
  }

  if (manifest.requiredPm && config.packageManager !== manifest.requiredPm) {
    errors.push(`${manifest.name} 必须使用 ${manifest.requiredPm}`)
  } else if (manifest.forbiddenPm?.includes(config.packageManager)) {
    const allowedPackageManagers = buildAllowedPackageManagers(manifest.forbiddenPm)

    errors.push(`${manifest.name} 不支持 ${config.packageManager}，请选择 ${allowedPackageManagers.join(' 或 ')}`)
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
