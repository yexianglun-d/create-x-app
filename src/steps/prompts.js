import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  note,
  select,
  text,
} from '@clack/prompts'
import fs from 'fs-extra'
import { resolve } from 'node:path'
import { loadAllManifests } from '../manifest/loader.js'
import {
  buildGenerationPlanLines,
  buildGenerationPlanMessage as buildUiGenerationPlanMessage,
  buildTemplateOverviewLines,
  printLines,
  resolveDisplayPath,
} from '../ui/create-ui.js'

const DEFAULT_PROJECT_NAME = 'my-app'
const PROJECT_NAME_PATTERN = /^[a-z0-9-_]+$/
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn']
const MODULE_PRESETS = {
  recommended: 'recommended',
  minimal: 'minimal',
  custom: 'custom',
}

async function ensurePromptNotCancelled(value, options = {}) {
  if (isCancel(value)) {
    if (options.onCancel) {
      await options.onCancel()
    }

    cancel('操作已取消')
    process.exit(0)
  }

  return value
}

export function validateProjectName(projectName) {
  if (!projectName) {
    return '项目名称不能为空'
  }

  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    return '项目名称仅支持小写字母、数字、中划线和下划线'
  }

  return undefined
}

function getFeatureDefinition(manifest, featureKey) {
  const featureDefinition = manifest.features?.[featureKey]

  if (!featureDefinition) {
    throw new Error(`${manifest.name} 未定义功能项：${featureKey}`)
  }

  return featureDefinition
}

function buildPackageManagerHint(manifest) {
  if (manifest.requiredPm) {
    return `仅 ${manifest.requiredPm}`
  }

  const choices = buildPackageManagerChoices(manifest).map((choice) => choice.value)
  return choices.join('/')
}

function buildTemplateHint(manifest) {
  const parts = [
    manifest.description,
    `包管理器：${buildPackageManagerHint(manifest)}`,
  ]

  if (manifest.devPort) {
    parts.push(`dev 端口：${manifest.devPort}`)
  }

  return parts.filter(Boolean).join(' · ')
}

export function buildTemplateChoices(manifests) {
  return manifests.map((manifest) => ({
    value: manifest.key,
    label: manifest.name,
    hint: buildTemplateHint(manifest),
  }))
}

function buildFeatureChoices(manifest) {
  return manifest.supportedFeatures.map((featureKey) => {
    const featureDefinition = getFeatureDefinition(manifest, featureKey)

    return {
      value: featureKey,
      label: featureDefinition.label,
      hint: featureDefinition.hint,
    }
  })
}

function buildExtraChoices(manifest) {
  return manifest.extras.map((extra) => ({
    value: extra.key,
    label: extra.label,
  }))
}

export function buildInitialModuleValues(manifest) {
  return [
    ...manifest.defaultFeatures,
    ...manifest.extras.filter((extra) => extra.default).map((extra) => extra.key),
  ]
}

export function splitSelectedModules(manifest, selectedModules) {
  const extraValues = new Set(manifest.extras.map((extra) => extra.key))
  const features = []
  const extras = []

  /**
   * 将用户勾选结果拆分成通用能力和模板专属扩展。
   *
   * 说明：
   * 1. 交互层对用户展示为一组多选，减少问答跳转
   * 2. 生成层需要明确区分公共功能和模板附加项，便于后续注入文件
   */
  for (const moduleName of selectedModules) {
    if (extraValues.has(moduleName)) {
      extras.push(moduleName)
      continue
    }

    features.push(moduleName)
  }

  return { features, extras }
}

function buildPackageManagerChoices(manifest) {
  return PACKAGE_MANAGERS
    .filter((packageManager) => !(manifest.forbiddenPm ?? []).includes(packageManager))
    .map((packageManager) => ({
      value: packageManager,
      label: packageManager,
    }))
}

function getFeatureLabel(manifest, featureKey) {
  return getFeatureDefinition(manifest, featureKey).label
}

function buildFileBasedExtras(manifest, extras) {
  return extras.filter((extraKey) => manifest.extras
    .find((extra) => extra.key === extraKey)?.source === 'file')
}

function buildMinimalModuleValues(manifest) {
  const alwaysUsefulFeatures = ['agents', 'coding-rules']

  return alwaysUsefulFeatures.filter((featureKey) => manifest.supportedFeatures.includes(featureKey))
}

export function resolveModulePreset(manifest, preset) {
  if (preset === MODULE_PRESETS.minimal) {
    return splitSelectedModules(manifest, buildMinimalModuleValues(manifest))
  }

  return splitSelectedModules(manifest, buildInitialModuleValues(manifest))
}

function buildModulePresetChoices(manifest) {
  const recommendedCount = buildInitialModuleValues(manifest).length
  const minimalCount = buildMinimalModuleValues(manifest).length

  return [
    {
      value: MODULE_PRESETS.recommended,
      label: '推荐配置',
      hint: `启用默认质量工具和模板推荐扩展（${recommendedCount} 项）`,
    },
    {
      value: MODULE_PRESETS.minimal,
      label: '极简配置',
      hint: minimalCount > 0 ? `只保留基础协作文档（${minimalCount} 项）` : '不启用额外功能模块',
    },
    {
      value: MODULE_PRESETS.custom,
      label: '自定义配置',
      hint: '手动选择通用功能和模板扩展',
    },
  ]
}

export function buildTemplateOverview(manifest) {
  const requiredTools = Object.entries(manifest.requiredEnv ?? manifest.requirements ?? {})
    .filter(([toolKey]) => toolKey !== 'packageManagers')
    .map(([toolKey, requirement]) => `${toolKey} ${requirement}`)
  const defaultFeatureLabels = (manifest.defaultFeatures ?? [])
    .map((featureKey) => getFeatureLabel(manifest, featureKey))
  const defaultExtraLabels = (manifest.extras ?? [])
    .filter((extra) => extra.default)
    .map((extra) => extra.label)

  return buildTemplateOverviewLines({
    description: manifest.description,
    requirements: requiredTools,
    defaultFeatures: defaultFeatureLabels,
    defaultExtras: defaultExtraLabels,
    devCommand: manifest.devScript ? `run ${manifest.devScript}` : '按模板 README',
  }).join('\n')
}

function parseListOption(value, fallback) {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (typeof value !== 'string') {
    return [...fallback]
  }

  if (value.trim() === '') {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function createUnknownTemplateError(template, manifests) {
  const availableTemplates = manifests.map((manifest) => manifest.key).join(', ')
  return new Error(`未找到模板定义：${template}。可用模板：${availableTemplates}`)
}

function shouldBuildConfigFromOptions(options) {
  return Boolean(
    options.template
      || options.preset
      || options.pm
      || typeof options.features === 'string'
      || typeof options.extras === 'string'
      || options.yes
      || options.cwd
      || options.target
      || options.printConfig,
  )
}

export function buildConfigFromOptions(projectNameArg, options = {}) {
  const manifests = loadAllManifests()
  const template = options.template ?? manifests[0]?.key
  const selectedManifest = manifests.find((manifest) => manifest.key === template)

  if (!selectedManifest) {
    throw createUnknownTemplateError(template, manifests)
  }

  const projectName = projectNameArg ?? DEFAULT_PROJECT_NAME
  const projectNameValidationResult = validateProjectName(projectName)

  if (projectNameValidationResult) {
    throw new Error(`无效的项目名称：${projectNameValidationResult}`)
  }

  const defaultExtras = selectedManifest.extras
    .filter((extra) => extra.default)
    .map((extra) => extra.key)
  const features = parseListOption(options.features, selectedManifest.defaultFeatures)
  const extras = parseListOption(options.extras, defaultExtras)
  const baseDir = options.cwd ? resolve(options.cwd) : process.cwd()
  const targetDir = options.target ? resolve(baseDir, options.target) : resolve(baseDir, projectName)
  const config = {
    projectName,
    template,
    features,
    extras,
    fileBasedExtras: buildFileBasedExtras(selectedManifest, extras),
    targetDir,
    packageManager: selectedManifest.requiredPm ?? options.pm ?? 'npm',
  }

  for (const subPrompt of selectedManifest.subPrompts ?? []) {
    config[subPrompt.key] = subPrompt.default
  }

  return config
}

export function buildGenerationPlanMessage({
  projectName,
  config,
  manifest,
  templateSource,
  packageManager,
  features,
  extras,
  dependencyStrategy = 'baseline',
  options = {},
}) {
  return buildUiGenerationPlanMessage({
    config: {
      ...config,
      projectName: projectName ?? config.projectName,
      packageManager: packageManager ?? config.packageManager,
      features: features ?? config.features,
      extras: extras ?? config.extras,
    },
    manifest,
    templateSource,
    dependencyStrategy,
    options,
  })
}

async function runSubPrompt(subPrompt, options = {}) {
  switch (subPrompt.type) {
    case 'select':
      return ensurePromptNotCancelled(await select({
        message: subPrompt.label,
        options: subPrompt.options,
        initialValue: subPrompt.default,
      }), options)
    case 'text':
      return ensurePromptNotCancelled(await text({
        message: subPrompt.label,
        initialValue: subPrompt.default ?? '',
      }), options)
    case 'confirm':
      return ensurePromptNotCancelled(await confirm({
        message: subPrompt.label,
        initialValue: Boolean(subPrompt.default),
      }), options)
    default:
      throw new Error(`不支持的子问答类型：${subPrompt.type}`)
  }
}

async function isDirectoryEmpty(targetDir) {
  const targetExists = await fs.pathExists(targetDir)

  if (!targetExists) {
    return true
  }

  const entries = await fs.readdir(targetDir)
  return entries.length === 0
}

async function resolveInteractiveTargetDir(config, options = {}) {
  if (options.force || await isDirectoryEmpty(config.targetDir)) {
    return config.targetDir
  }

  note(
    '为避免覆盖现有文件，请输入新的目标目录；如确需覆盖，请退出后显式添加 --force。',
    `目标目录已存在且非空：${resolveDisplayPath(config.targetDir)}`,
  )

  while (true) {
    const nextTarget = await ensurePromptNotCancelled(await text({
      message: '请输入新的目标目录',
      initialValue: `${config.projectName}-new`,
      validate(value) {
        return value ? undefined : '目标目录不能为空'
      },
    }), options)
    const resolvedTarget = resolve(process.cwd(), nextTarget)

    if (await isDirectoryEmpty(resolvedTarget)) {
      return resolvedTarget
    }

    note(
      '请选择一个不存在或为空的目录。',
      `目标目录仍然非空：${resolveDisplayPath(resolvedTarget)}`,
    )
  }
}

export async function confirmGenerationPlan({
  config,
  manifest,
  templateSource,
  dependencyStrategy,
  options = {},
}) {
  if (shouldBuildConfigFromOptions(options)) {
    printLines(buildGenerationPlanLines({
      config,
      manifest,
      templateSource,
      dependencyStrategy,
      options,
    }))
    return true
  }

  const confirmed = await ensurePromptNotCancelled(await confirm({
    message: buildGenerationPlanMessage({
      projectName: config.projectName,
      config,
      manifest,
      templateSource,
      packageManager: config.packageManager,
      features: config.features,
      extras: config.extras,
      dependencyStrategy,
      options,
    }),
    initialValue: true,
  }), options)

  if (!confirmed) {
    cancel('操作已取消')
    process.exit(0)
  }

  return true
}

export async function runPrompts(projectNameArg, options = {}) {
  if (shouldBuildConfigFromOptions(options)) {
    return buildConfigFromOptions(projectNameArg, options)
  }

  const manifests = loadAllManifests()
  let projectName = projectNameArg

  if (projectName) {
    const projectNameValidationResult = validateProjectName(projectName)

    if (projectNameValidationResult) {
      throw new Error(`无效的项目名称：${projectNameValidationResult}`)
    }
  } else {
    projectName = await ensurePromptNotCancelled(await text({
      message: '请输入项目名称',
      initialValue: DEFAULT_PROJECT_NAME,
      validate(value) {
        return validateProjectName(value)
      },
    }), options)
  }

  const template = await ensurePromptNotCancelled(await select({
    message: '请选择项目模板',
    options: buildTemplateChoices(manifests),
    initialValue: manifests[0]?.key,
  }), options)
  const selectedManifest = manifests.find((manifest) => manifest.key === template)

  if (!selectedManifest) {
    throw createUnknownTemplateError(template, manifests)
  }

  note(buildTemplateOverview(selectedManifest), selectedManifest.name)

  const modulePreset = await ensurePromptNotCancelled(await select({
    message: '请选择功能组合',
    options: buildModulePresetChoices(selectedManifest),
    initialValue: MODULE_PRESETS.recommended,
  }), options)
  let features
  let extras

  if (modulePreset === MODULE_PRESETS.custom) {
    const selectedModules = await ensurePromptNotCancelled(await multiselect({
      message: '请选择需要的功能模块',
      options: [
        ...buildFeatureChoices(selectedManifest),
        ...buildExtraChoices(selectedManifest),
      ],
      initialValues: buildInitialModuleValues(selectedManifest),
      required: false,
    }), options)
    const selectedConfig = splitSelectedModules(selectedManifest, selectedModules)

    features = selectedConfig.features
    extras = selectedConfig.extras
  } else {
    const selectedConfig = resolveModulePreset(selectedManifest, modulePreset)

    features = selectedConfig.features
    extras = selectedConfig.extras
  }

  const config = {
    projectName,
    template,
    features,
    extras,
    fileBasedExtras: buildFileBasedExtras(selectedManifest, extras),
    targetDir: resolve(process.cwd(), projectName),
  }

  for (const subPrompt of selectedManifest.subPrompts ?? []) {
    config[subPrompt.key] = await runSubPrompt(subPrompt, options)
  }

  if (selectedManifest.requiredPm) {
    config.packageManager = selectedManifest.requiredPm
    note(`${selectedManifest.name} 必须使用 ${selectedManifest.requiredPm}`, '包管理器已锁定')
  } else {
    const packageManagerChoices = buildPackageManagerChoices(selectedManifest)

    config.packageManager = await ensurePromptNotCancelled(await select({
      message: '请选择包管理器',
      options: packageManagerChoices,
      initialValue: packageManagerChoices[0]?.value,
    }), options)
  }

  config.targetDir = await resolveInteractiveTargetDir(config, options)

  return config
}
