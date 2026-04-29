import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts'
import { resolve } from 'node:path'
import { loadAllManifests } from '../manifest/loader.js'

const DEFAULT_PROJECT_NAME = 'my-app'
const PROJECT_NAME_PATTERN = /^[a-z0-9-_]+$/
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn']
const FEATURE_DEFINITIONS = {
  eslint: { label: 'ESLint', hint: '代码质量检查' },
  prettier: { label: 'Prettier', hint: '代码格式化' },
  husky: { label: 'commitlint + Husky', hint: '提交信息校验' },
  agents: { label: 'AGENTS.md', hint: 'AI 协作约定' },
  'coding-rules': { label: 'coding-rules.md', hint: '团队代码规范' },
}

function ensurePromptNotCancelled(value) {
  if (isCancel(value)) {
    cancel('操作已取消')
    process.exit(0)
  }

  return value
}

function validateProjectName(projectName) {
  if (!projectName) {
    return '项目名称不能为空'
  }

  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    return '项目名称仅支持小写字母、数字、中划线和下划线'
  }

  return undefined
}

function getFeatureDefinition(featureKey) {
  const featureDefinition = FEATURE_DEFINITIONS[featureKey]

  if (!featureDefinition) {
    throw new Error(`未定义的功能项：${featureKey}`)
  }

  return featureDefinition
}

function buildTemplateChoices(manifests) {
  return manifests.map((manifest) => ({
    value: manifest.key,
    label: manifest.name,
    hint: manifest.description,
  }))
}

function buildFeatureChoices(manifest) {
  return manifest.supportedFeatures.map((featureKey) => {
    const featureDefinition = getFeatureDefinition(featureKey)

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

function buildInitialModuleValues(manifest) {
  return [
    ...manifest.defaultFeatures,
    ...manifest.extras.filter((extra) => extra.default).map((extra) => extra.key),
  ]
}

function splitSelectedModules(manifest, selectedModules) {
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

function getFeatureLabel(featureKey) {
  return getFeatureDefinition(featureKey).label
}

function getExtraLabel(manifest, extraKey) {
  const extra = manifest.extras.find((candidate) => candidate.key === extraKey)

  if (!extra) {
    return extraKey
  }

  return extra.label
}

function buildFileBasedExtras(manifest, extras) {
  return extras.filter((extraKey) => manifest.extras
    .find((extra) => extra.key === extraKey)?.source === 'file')
}

function buildConfirmationMessage({
  projectName,
  manifest,
  packageManager,
  features,
  extras,
}) {
  const featureText = features.length > 0 ? features.map(getFeatureLabel).join(', ') : '无'
  const extraText = extras.length > 0
    ? extras.map((extraKey) => getExtraLabel(manifest, extraKey)).join(', ')
    : '无'

  return [
    `项目名称：${projectName}`,
    `模板：${manifest.name}`,
    `通用功能：${featureText}`,
    `模板扩展：${extraText}`,
    `包管理器：${packageManager}`,
    '确认开始生成项目？',
  ].join('\n')
}

async function runSubPrompt(subPrompt) {
  switch (subPrompt.type) {
    case 'select':
      return ensurePromptNotCancelled(await select({
        message: subPrompt.label,
        options: subPrompt.options,
        initialValue: subPrompt.default,
      }))
    case 'text':
      return ensurePromptNotCancelled(await text({
        message: subPrompt.label,
        initialValue: subPrompt.default ?? '',
      }))
    case 'confirm':
      return ensurePromptNotCancelled(await confirm({
        message: subPrompt.label,
        initialValue: Boolean(subPrompt.default),
      }))
    default:
      throw new Error(`不支持的子问答类型：${subPrompt.type}`)
  }
}

export async function runPrompts(projectNameArg) {
  try {
    const manifests = loadAllManifests()
    let projectName = projectNameArg

    if (projectName) {
      const projectNameValidationResult = validateProjectName(projectName)

      if (projectNameValidationResult) {
        throw new Error(`无效的项目名称：${projectNameValidationResult}`)
      }
    } else {
      projectName = ensurePromptNotCancelled(await text({
        message: '请输入项目名称',
        initialValue: DEFAULT_PROJECT_NAME,
        validate(value) {
          return validateProjectName(value)
        },
      }))
    }

    const template = ensurePromptNotCancelled(await select({
      message: '请选择项目模板',
      options: buildTemplateChoices(manifests),
      initialValue: manifests[0]?.key,
    }))
    const selectedManifest = manifests.find((manifest) => manifest.key === template)

    if (!selectedManifest) {
      throw new Error(`未找到模板定义：${template}`)
    }

    const selectedModules = ensurePromptNotCancelled(await multiselect({
      message: '请选择需要的功能模块',
      options: [
        ...buildFeatureChoices(selectedManifest),
        ...buildExtraChoices(selectedManifest),
      ],
      initialValues: buildInitialModuleValues(selectedManifest),
      required: false,
    }))

    const { features, extras } = splitSelectedModules(selectedManifest, selectedModules)
    const config = {
      projectName,
      template,
      features,
      extras,
      fileBasedExtras: buildFileBasedExtras(selectedManifest, extras),
      targetDir: resolve(process.cwd(), projectName),
    }

    for (const subPrompt of selectedManifest.subPrompts ?? []) {
      config[subPrompt.key] = await runSubPrompt(subPrompt)
    }

    if (selectedManifest.requiredPm) {
      config.packageManager = selectedManifest.requiredPm
    } else {
      const packageManagerChoices = buildPackageManagerChoices(selectedManifest)

      config.packageManager = ensurePromptNotCancelled(await select({
        message: '请选择包管理器',
        options: packageManagerChoices,
        initialValue: packageManagerChoices[0]?.value,
      }))
    }

    const confirmed = ensurePromptNotCancelled(await confirm({
      message: buildConfirmationMessage({
        projectName: config.projectName,
        manifest: selectedManifest,
        packageManager: config.packageManager,
        features: config.features,
        extras: config.extras,
      }),
      initialValue: true,
    }))

    if (!confirmed) {
      cancel('操作已取消')
      process.exit(0)
    }

    return config
  } catch (error) {
    cancel(`交互问答失败：${error.message}`)
    process.exit(1)
  }
}
