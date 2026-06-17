import { existsSync } from 'node:fs'
import semver from 'semver'

const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])
const REQUIREMENT_TOOL_NAMES = new Set(['node', 'git', 'pnpm', 'yarn', 'java', 'maven', 'docker'])
const REQUIRED_STRING_FIELDS = ['schemaVersion', 'key', 'name', 'description', 'version', 'framework']
const REQUIRED_ARRAY_FIELDS = ['supportedFeatures', 'defaultFeatures', 'extras', 'subPrompts']
const REQUIRED_OBJECT_FIELDS = ['requiredEnv', 'optionalEnv', 'features']

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
  const defaultFeatures = new Set(manifest.defaultFeatures ?? [])
  const featureDefinitions = manifest.features ?? {}

  for (const [feature, featureDefinition] of Object.entries(featureDefinitions)) {
    const isSupportedFeature = supportedFeatures.has(feature)

    if (!isPlainObject(featureDefinition)) {
      errors.push(`features.${feature} 必须是对象`)
      continue
    }

    if (typeof featureDefinition.label !== 'string' || featureDefinition.label.length === 0) {
      errors.push(`features.${feature}.label 必须是非空字符串`)
    }

    if (featureDefinition.hint !== undefined && typeof featureDefinition.hint !== 'string') {
      errors.push(`features.${feature}.hint 必须是字符串`)
    }

    if (typeof featureDefinition.default !== 'boolean') {
      errors.push(`features.${feature}.default 必须是布尔值`)
    } else if (isSupportedFeature && featureDefinition.default !== defaultFeatures.has(feature)) {
      errors.push(`features.${feature}.default 必须与 defaultFeatures 保持一致`)
    }

    if (featureDefinition.artifacts !== undefined && !Array.isArray(featureDefinition.artifacts)) {
      errors.push(`features.${feature}.artifacts 必须是数组`)
    }

    for (const artifact of featureDefinition.artifacts ?? []) {
      if (typeof artifact !== 'string' || artifact.length === 0) {
        errors.push(`features.${feature}.artifacts 只能包含非空字符串`)
      }
    }

    if (featureDefinition.postActions !== undefined && !Array.isArray(featureDefinition.postActions)) {
      errors.push(`features.${feature}.postActions 必须是数组`)
    }
  }

  for (const feature of supportedFeatures) {
    if (!isPlainObject(featureDefinitions[feature])) {
      errors.push(`features.${feature} 必须声明功能定义`)
    }
  }

  for (const feature of manifest.defaultFeatures ?? []) {
    if (!supportedFeatures.has(feature)) {
      errors.push(`defaultFeatures 包含未声明的功能：${feature}`)
    }
  }
}

function validateRequirements(errors, manifest) {
  if (manifest.requirements === undefined) {
    return
  }

  if (!isPlainObject(manifest.requirements)) {
    errors.push('requirements 必须是对象')
    return
  }

  for (const [toolName, requirement] of Object.entries(manifest.requirements)) {
    if (toolName === 'packageManagers') {
      if (!Array.isArray(requirement) || requirement.length === 0) {
        errors.push('requirements.packageManagers 必须是非空数组')
        continue
      }

      for (const packageManager of requirement) {
        if (!PACKAGE_MANAGERS.has(packageManager)) {
          errors.push(`requirements.packageManagers 包含不支持的包管理器：${packageManager}`)
        }
      }

      continue
    }

    if (!REQUIREMENT_TOOL_NAMES.has(toolName)) {
      errors.push(`requirements 包含不支持的工具：${toolName}`)
      continue
    }

    if (requirement !== null && typeof requirement !== 'string') {
      errors.push(`requirements.${toolName} 必须是字符串或 null`)
    } else if (typeof requirement === 'string' && !semver.validRange(requirement)) {
      errors.push(`requirements.${toolName} 必须是有效的 semver range`)
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

    if (!['inline', 'file'].includes(extra.source)) {
      errors.push(`extras[${index}].source 必须是 inline 或 file`)
    }

    if (extra.source === 'file' && extra.templatePath !== undefined && typeof extra.templatePath !== 'string') {
      errors.push(`extras[${index}].templatePath 必须是字符串`)
    }

    if (extra.artifacts !== undefined && !Array.isArray(extra.artifacts)) {
      errors.push(`extras[${index}].artifacts 必须是数组`)
    }

    if (extra.detectDependencies !== undefined && !Array.isArray(extra.detectDependencies)) {
      errors.push(`extras[${index}].detectDependencies 必须是数组`)
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

function validatePluginTrustFields(errors, manifest) {
  if (manifest.cxaPluginApi !== undefined) {
    if (typeof manifest.cxaPluginApi !== 'string' || manifest.cxaPluginApi.trim().length === 0) {
      errors.push('cxaPluginApi 必须是非空字符串')
    } else if (!semver.validRange(manifest.cxaPluginApi)) {
      errors.push('cxaPluginApi 必须是有效的 semver range')
    }
  }

  for (const fieldName of ['author', 'repository', 'license']) {
    if (manifest[fieldName] !== undefined && typeof manifest[fieldName] !== 'string') {
      errors.push(`${fieldName} 必须是字符串`)
    }
  }

  for (const fieldName of ['requiresNetwork', 'writesOutsideTarget']) {
    if (manifest[fieldName] !== undefined && typeof manifest[fieldName] !== 'boolean') {
      errors.push(`${fieldName} 必须是布尔值`)
    }
  }

  if (manifest.postActions !== undefined && !Array.isArray(manifest.postActions)) {
    errors.push('postActions 必须是数组')
  }

  for (const [index, action] of (manifest.postActions ?? []).entries()) {
    if (typeof action !== 'string' || action.length === 0) {
      errors.push(`postActions[${index}] 必须是非空字符串`)
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

  if (manifest.schemaVersion !== '1.0') {
    errors.push('schemaVersion 必须是 1.0')
  }

  validatePackageManagerField(errors, manifest, 'requiredPm')
  validateForbiddenPackageManagers(errors, manifest)
  validateRequirements(errors, manifest)
  validateFeatures(errors, manifest)
  validateExtras(errors, manifest)
  validateSubPrompts(errors, manifest)
  validatePluginTrustFields(errors, manifest)

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
