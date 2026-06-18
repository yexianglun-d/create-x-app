import {
  cancel,
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
} from '../ui/create-ui.js'
import { ensurePromptNotCancelled } from '../utils/prompt-helpers.js'
import { resolveDisplayPath } from '../utils/path.js'
import { getTemplateHelp } from '../ux/help-texts.js'

const DEFAULT_PROJECT_NAME = 'my-app'
const PROJECT_NAME_PATTERN = /^[a-z0-9-_]+$/
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn']
const MODULE_PRESETS = {
  recommended: 'recommended',
  minimal: 'minimal',
  custom: 'custom',
}
export const BACK_PROMPT_VALUE = '__cxa_back__'

const CANCEL_PROMPT_VALUE = '__cxa_cancel__'
const GENERATE_PROMPT_VALUE = '__cxa_generate__'
const BACK_CHOICE = {
  value: BACK_PROMPT_VALUE,
  label: '← 返回上一步',
  hint: '回到上一项继续修改',
}
const PROMPT_STEPS = {
  projectName: 'projectName',
  template: 'template',
  modulePreset: 'modulePreset',
  customModules: 'customModules',
  packageManager: 'packageManager',
  subPrompt: 'subPrompt',
  targetDir: 'targetDir',
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
  const help = getTemplateHelp(manifest.key)
  const parts = [
    manifest.description,
    `包管理器：${buildPackageManagerHint(manifest)}`,
  ]

  if (manifest.devPort) {
    parts.push(`dev 端口：${manifest.devPort}`)
  }

  if (help) {
    parts.push(help.bestFor)
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

function getPromptAdapter(options = {}) {
  const promptAdapter = options.promptAdapter ?? {}

  return {
    text: promptAdapter.text ?? text,
    select: promptAdapter.select ?? select,
    multiselect: promptAdapter.multiselect ?? multiselect,
    note: promptAdapter.note ?? note,
    printLines: promptAdapter.printLines ?? printLines,
  }
}

function appendBackChoice(choices, canGoBack = true) {
  return canGoBack ? [...choices, BACK_CHOICE] : choices
}

async function promptText(promptAdapter, promptOptions, options) {
  return ensurePromptNotCancelled(await promptAdapter.text(promptOptions), options)
}

async function promptSelect(promptAdapter, promptOptions, options, behavior = {}) {
  return ensurePromptNotCancelled(await promptAdapter.select({
    ...promptOptions,
    options: appendBackChoice(promptOptions.options, behavior.canGoBack),
  }), options)
}

async function promptMultiselect(promptAdapter, promptOptions, options, behavior = {}) {
  return ensurePromptNotCancelled(await promptAdapter.multiselect({
    ...promptOptions,
    options: appendBackChoice(promptOptions.options, behavior.canGoBack),
  }), options)
}

function emitNote(promptAdapter, message, title) {
  promptAdapter.note(message, title)
}

function isBackResult(value) {
  return value === BACK_PROMPT_VALUE
    || (Array.isArray(value) && value.includes(BACK_PROMPT_VALUE))
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
  return buildTemplateOverviewRows(manifest).join('\n')
}

function buildTemplateOverviewRows(manifest) {
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
  })
}

function printTemplateOverview(promptAdapter, manifest) {
  promptAdapter.printLines([
    '',
    ...buildTemplateOverviewRows(manifest),
    '',
  ])
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

function buildDefaultSubPromptValues(manifest) {
  return Object.fromEntries((manifest.subPrompts ?? [])
    .map((subPrompt) => [subPrompt.key, subPrompt.default]))
}

function resetDraftForTemplate(draft, manifest) {
  const selectedConfig = resolveModulePreset(manifest, MODULE_PRESETS.recommended)
  const packageManagerChoices = buildPackageManagerChoices(manifest)

  draft.modulePreset = MODULE_PRESETS.recommended
  draft.features = selectedConfig.features
  draft.extras = selectedConfig.extras
  draft.selectedModules = buildInitialModuleValues(manifest)
  draft.packageManager = manifest.requiredPm ?? packageManagerChoices[0]?.value
  draft.subPromptValues = buildDefaultSubPromptValues(manifest)
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function inferModulePreset(manifest, config) {
  const features = config.features ?? []
  const extras = config.extras ?? []
  const recommended = resolveModulePreset(manifest, MODULE_PRESETS.recommended)
  const minimal = resolveModulePreset(manifest, MODULE_PRESETS.minimal)

  if (arraysEqual(features, recommended.features) && arraysEqual(extras, recommended.extras)) {
    return MODULE_PRESETS.recommended
  }

  if (arraysEqual(features, minimal.features) && arraysEqual(extras, minimal.extras)) {
    return MODULE_PRESETS.minimal
  }

  return MODULE_PRESETS.custom
}

function createPromptDraft(projectNameArg, manifests, options = {}) {
  const initialConfig = options.initialConfig
  const initialManifest = manifests.find((manifest) => manifest.key === initialConfig?.template)
    ?? manifests[0]
  const draft = {
    projectName: initialConfig?.projectName ?? projectNameArg,
    template: initialConfig?.template ?? initialManifest?.key,
    modulePreset: MODULE_PRESETS.recommended,
    features: initialConfig?.features,
    extras: initialConfig?.extras,
    selectedModules: initialConfig
      ? [...(initialConfig.features ?? []), ...(initialConfig.extras ?? [])]
      : undefined,
    packageManager: initialConfig?.packageManager,
    subPromptValues: {},
  }

  if (initialManifest) {
    resetDraftForTemplate(draft, initialManifest)
  }

  if (initialConfig && initialManifest) {
    draft.modulePreset = inferModulePreset(initialManifest, initialConfig)
    draft.features = [...(initialConfig.features ?? draft.features ?? [])]
    draft.extras = [...(initialConfig.extras ?? draft.extras ?? [])]
    draft.selectedModules = [...draft.features, ...draft.extras]
    draft.packageManager = initialConfig.packageManager ?? draft.packageManager
    draft.subPromptValues = buildDefaultSubPromptValues(initialManifest)

    for (const subPrompt of initialManifest.subPrompts ?? []) {
      if (initialConfig[subPrompt.key] !== undefined) {
        draft.subPromptValues[subPrompt.key] = initialConfig[subPrompt.key]
      }
    }
  }

  return draft
}

function findSelectedManifest(template, manifests) {
  const selectedManifest = manifests.find((manifest) => manifest.key === template)

  if (!selectedManifest) {
    throw createUnknownTemplateError(template, manifests)
  }

  return selectedManifest
}

function getPreviousModuleStep(draft) {
  return draft.modulePreset === MODULE_PRESETS.custom
    ? PROMPT_STEPS.customModules
    : PROMPT_STEPS.modulePreset
}

function getStepAfterPackageManager(manifest) {
  return manifest.subPrompts?.length > 0
    ? PROMPT_STEPS.subPrompt
    : PROMPT_STEPS.targetDir
}

export function getPromptResumeStep(manifest) {
  if (manifest.subPrompts?.length > 0) {
    return {
      step: PROMPT_STEPS.subPrompt,
      subPromptIndex: manifest.subPrompts.length - 1,
    }
  }

  if (manifest.requiredPm) {
    return {
      step: getPreviousModuleStep({
        modulePreset: MODULE_PRESETS.recommended,
      }),
      subPromptIndex: 0,
    }
  }

  return {
    step: PROMPT_STEPS.packageManager,
    subPromptIndex: 0,
  }
}

function buildInteractiveConfig(draft, manifest) {
  const config = {
    projectName: draft.projectName,
    template: draft.template,
    features: draft.features ?? [],
    extras: draft.extras ?? [],
    fileBasedExtras: buildFileBasedExtras(manifest, draft.extras ?? []),
    targetDir: resolve(process.cwd(), draft.projectName),
    packageManager: draft.packageManager,
  }

  for (const subPrompt of manifest.subPrompts ?? []) {
    config[subPrompt.key] = draft.subPromptValues[subPrompt.key] ?? subPrompt.default
  }

  return config
}

async function runSubPrompt(subPrompt, promptAdapter, options = {}, value) {
  switch (subPrompt.type) {
    case 'select':
      return promptSelect(promptAdapter, {
        message: subPrompt.label,
        options: subPrompt.options,
        initialValue: value ?? subPrompt.default,
      }, options, { canGoBack: true })
    case 'text':
      return promptText(promptAdapter, {
        message: subPrompt.label,
        initialValue: value ?? subPrompt.default ?? '',
      }, options)
    case 'confirm':
      return promptSelect(promptAdapter, {
        message: subPrompt.label,
        options: [
          { value: true, label: '是' },
          { value: false, label: '否' },
        ],
        initialValue: Boolean(value ?? subPrompt.default),
      }, options, { canGoBack: true })
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
  const promptAdapter = getPromptAdapter(options)

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

  const action = await promptSelect(promptAdapter, {
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
    options: [
      {
        value: GENERATE_PROMPT_VALUE,
        label: '生成项目',
        hint: '使用以上计划继续创建',
      },
      {
        value: BACK_PROMPT_VALUE,
        label: '← 返回上一步',
        hint: '回到配置步骤继续修改',
      },
      {
        value: CANCEL_PROMPT_VALUE,
        label: '取消',
        hint: '退出，不生成项目',
      },
    ],
    initialValue: GENERATE_PROMPT_VALUE,
  }, options)

  if (action === BACK_PROMPT_VALUE) {
    return BACK_PROMPT_VALUE
  }

  if (action === CANCEL_PROMPT_VALUE) {
    cancel('操作已取消')
    process.exit(0)
  }

  return true
}

export async function runPrompts(projectNameArg, options = {}) {
  if (shouldBuildConfigFromOptions(options)) {
    return buildConfigFromOptions(projectNameArg, options)
  }

  const promptAdapter = getPromptAdapter(options)
  const manifests = loadAllManifests()
  const draft = createPromptDraft(projectNameArg, manifests, options)
  const projectNameLocked = Boolean(projectNameArg)
  let step = options.startStep?.step
    ?? (projectNameLocked ? PROMPT_STEPS.template : PROMPT_STEPS.projectName)
  let subPromptIndex = options.startStep?.subPromptIndex ?? 0

  if (projectNameLocked) {
    const projectNameValidationResult = validateProjectName(draft.projectName)

    if (projectNameValidationResult) {
      throw new Error(`无效的项目名称：${projectNameValidationResult}`)
    }
  }

  while (true) {
    const selectedManifest = findSelectedManifest(draft.template, manifests)

    switch (step) {
      case PROMPT_STEPS.projectName:
        draft.projectName = await promptText(promptAdapter, {
          message: '请输入项目名称',
          initialValue: draft.projectName ?? DEFAULT_PROJECT_NAME,
          validate(value) {
            return validateProjectName(value)
          },
        }, options)
        step = PROMPT_STEPS.template
        break

      case PROMPT_STEPS.template: {
        const nextTemplate = await promptSelect(promptAdapter, {
          message: '请选择项目模板',
          options: buildTemplateChoices(manifests),
          initialValue: draft.template ?? manifests[0]?.key,
        }, options, { canGoBack: !projectNameLocked })

        if (isBackResult(nextTemplate)) {
          step = PROMPT_STEPS.projectName
          break
        }

        if (nextTemplate !== draft.template) {
          draft.template = nextTemplate
          resetDraftForTemplate(draft, findSelectedManifest(draft.template, manifests))
        } else {
          draft.template = nextTemplate
        }

        printTemplateOverview(promptAdapter, findSelectedManifest(draft.template, manifests))
        step = PROMPT_STEPS.modulePreset
        break
      }

      case PROMPT_STEPS.modulePreset: {
        const modulePreset = await promptSelect(promptAdapter, {
          message: '请选择功能组合',
          options: buildModulePresetChoices(selectedManifest),
          initialValue: draft.modulePreset ?? MODULE_PRESETS.recommended,
        }, options, { canGoBack: true })

        if (isBackResult(modulePreset)) {
          step = PROMPT_STEPS.template
          break
        }

        draft.modulePreset = modulePreset

        if (draft.modulePreset === MODULE_PRESETS.custom) {
          step = PROMPT_STEPS.customModules
          break
        }

        const selectedConfig = resolveModulePreset(selectedManifest, draft.modulePreset)
        draft.features = selectedConfig.features
        draft.extras = selectedConfig.extras
        draft.selectedModules = [...draft.features, ...draft.extras]
        step = PROMPT_STEPS.packageManager
        break
      }

      case PROMPT_STEPS.customModules: {
        const selectedModules = await promptMultiselect(promptAdapter, {
          message: '请选择需要的功能模块',
          options: [
            ...buildFeatureChoices(selectedManifest),
            ...buildExtraChoices(selectedManifest),
          ],
          initialValues: draft.selectedModules ?? buildInitialModuleValues(selectedManifest),
          required: false,
        }, options, { canGoBack: true })

        if (isBackResult(selectedModules)) {
          step = PROMPT_STEPS.modulePreset
          break
        }

        const selectedConfig = splitSelectedModules(selectedManifest, selectedModules)
        draft.features = selectedConfig.features
        draft.extras = selectedConfig.extras
        draft.selectedModules = selectedModules
        step = PROMPT_STEPS.packageManager
        break
      }

      case PROMPT_STEPS.packageManager:
        if (selectedManifest.requiredPm) {
          draft.packageManager = selectedManifest.requiredPm
          emitNote(promptAdapter, `${selectedManifest.name} 必须使用 ${selectedManifest.requiredPm}`, '包管理器已锁定')
          step = getStepAfterPackageManager(selectedManifest)
          break
        }

        {
          const packageManagerChoices = buildPackageManagerChoices(selectedManifest)
          const packageManager = await promptSelect(promptAdapter, {
            message: '请选择包管理器',
            options: packageManagerChoices,
            initialValue: draft.packageManager ?? packageManagerChoices[0]?.value,
          }, options, { canGoBack: true })

          if (isBackResult(packageManager)) {
            step = getPreviousModuleStep(draft)
            break
          }

          draft.packageManager = packageManager
          step = getStepAfterPackageManager(selectedManifest)
        }
        break

      case PROMPT_STEPS.subPrompt: {
        const subPrompt = selectedManifest.subPrompts[subPromptIndex]

        if (!subPrompt) {
          step = PROMPT_STEPS.targetDir
          break
        }

        const subPromptValue = await runSubPrompt(
          subPrompt,
          promptAdapter,
          options,
          draft.subPromptValues[subPrompt.key],
        )

        if (isBackResult(subPromptValue)) {
          if (subPromptIndex > 0) {
            subPromptIndex -= 1
          } else {
            step = selectedManifest.requiredPm
              ? getPreviousModuleStep(draft)
              : PROMPT_STEPS.packageManager
          }
          break
        }

        draft.subPromptValues[subPrompt.key] = subPromptValue
        subPromptIndex += 1
        step = subPromptIndex < selectedManifest.subPrompts.length
          ? PROMPT_STEPS.subPrompt
          : PROMPT_STEPS.targetDir
        break
      }

      case PROMPT_STEPS.targetDir: {
        const config = buildInteractiveConfig(draft, selectedManifest)

        config.targetDir = await resolveInteractiveTargetDir(config, options)
        return config
      }

      default:
        throw new Error(`未知交互步骤：${step}`)
    }
  }
}
