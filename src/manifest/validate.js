import { existsSync } from 'node:fs'

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])
const REQUIRED_STRING_FIELDS = ['key', 'name', 'description', 'version', 'framework']
const REQUIRED_ARRAY_FIELDS = ['supportedFeatures', 'defaultFeatures', 'extras', 'subPrompts']
const REQUIRED_OBJECT_FIELDS = ['requiredEnv', 'optionalEnv']

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function formatSource(options = {}) {
  if (options.packageName) {
    return `插件 ${options.packageName}`
  }

  return options.sourceName ?? '模板'
}

function validatePackageManagerField(errors, manifest, fieldName) {
  const value = manifest[fieldName]

  if (value === null || value === undefined) {
    return
  }

  if (!PACKAGE_MANAGERS.has(value)) {
    errors.push(`${fieldName} 必须是 npm、pnpm、yarn 或 null`)
  }
}

function validateForbiddenPackageManagers(errors, manifest) {
  if (!Array.isArray(manifest.forbiddenPm)) {
    errors.push('forbiddenPm 必须是数组')
    return
  }

  for (const packageManager of manifest.forbiddenPm) {
    if (!PACKAGE_MANAGERS.has(packageManager)) {
      errors.push(`forbiddenPm 包含不支持的包管理器：${packageManager}`)
    }
  }
}

function validateFeatures(errors, manifest) {
  const supportedFeatures = new Set(manifest.supportedFeatures ?? [])

  for (const feature of manifest.defaultFeatures ?? []) {
    if (!supportedFeatures.has(feature)) {
      errors.push(`defaultFeatures 包含未声明的功能：${feature}`)
    }
  }
}

function validateExtras(errors, manifest) {
  for (const [index, extra] of (manifest.extras ?? []).entries()) {
    if (!isPlainObject(extra)) {
      errors.push(`extras[${index}] 必须是对象`)
      continue
    }

    if (typeof extra.key !== 'string' || extra.key.length === 0) {
      errors.push(`extras[${index}].key 必须是非空字符串`)
    }

    if (typeof extra.label !== 'string' || extra.label.length === 0) {
      errors.push(`extras[${index}].label 必须是非空字符串`)
    }

    if (typeof extra.default !== 'boolean') {
      errors.push(`extras[${index}].default 必须是布尔值`)
    }
  }
}

function validateSubPrompts(errors, manifest) {
  for (const [index, subPrompt] of (manifest.subPrompts ?? []).entries()) {
    if (!isPlainObject(subPrompt)) {
      errors.push(`subPrompts[${index}] 必须是对象`)
      continue
    }

    if (typeof subPrompt.key !== 'string' || subPrompt.key.length === 0) {
      errors.push(`subPrompts[${index}].key 必须是非空字符串`)
    }

    if (subPrompt.type !== 'select') {
      errors.push(`subPrompts[${index}].type 当前仅支持 select`)
    }

    if (!Array.isArray(subPrompt.options) || subPrompt.options.length === 0) {
      errors.push(`subPrompts[${index}].options 必须是非空数组`)
    }
  }
}

export function getManifestValidationErrors(manifest, options = {}) {
  const errors = []

  if (!isPlainObject(manifest)) {
    return [`${formatSource(options)} manifest 必须是对象`]
  }

  for (const fieldName of REQUIRED_STRING_FIELDS) {
    if (typeof manifest[fieldName] !== 'string' || manifest[fieldName].trim().length === 0) {
      errors.push(`${fieldName} 必须是非空字符串`)
    }
  }

  for (const fieldName of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(manifest[fieldName])) {
      errors.push(`${fieldName} 必须是数组`)
    }
  }

  for (const fieldName of REQUIRED_OBJECT_FIELDS) {
    if (!isPlainObject(manifest[fieldName])) {
      errors.push(`${fieldName} 必须是对象`)
    }
  }

  validatePackageManagerField(errors, manifest, 'requiredPm')
  validateForbiddenPackageManagers(errors, manifest)
  validateFeatures(errors, manifest)
  validateExtras(errors, manifest)
  validateSubPrompts(errors, manifest)

  if (manifest.templatePath && !existsSync(manifest.templatePath)) {
    errors.push(`templatePath 不存在：${manifest.templatePath}`)
  }

  return errors
}

export function validateManifestDefinition(manifest, options = {}) {
  const errors = getManifestValidationErrors(manifest, options)

  if (errors.length === 0) {
    return manifest
  }

  throw new Error(`${formatSource(options)} manifest 无效：\n- ${errors.join('\n- ')}`)
}
