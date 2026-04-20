import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from '@clack/prompts'
import { resolve } from 'node:path'

const DEFAULT_PROJECT_NAME = 'my-app'
const PROJECT_NAME_PATTERN = /^[a-z0-9-_]+$/
const DEFAULT_FEATURE_VALUES = ['eslint', 'prettier', 'husky', 'agents', 'coding-rules']

const COMMON_FEATURE_OPTIONS = [
  { value: 'eslint', label: 'ESLint', hint: '代码质量检查' },
  { value: 'prettier', label: 'Prettier', hint: '代码格式化' },
  { value: 'husky', label: 'commitlint + Husky', hint: '提交信息校验' },
  { value: 'agents', label: 'AGENTS.md', hint: 'AI 协作约定' },
  { value: 'coding-rules', label: 'coding-rules.md', hint: '团队代码规范' },
]

const EXTRA_OPTIONS_MAP = {
  'react-vite-ts': [
    { value: 'react-router', label: 'React Router v6', hint: '增加路由能力' },
    { value: 'tailwind', label: 'Tailwind CSS v3', hint: '增加样式工具链' },
  ],
  'node-ts': [
    { value: 'express', label: 'Express.js', hint: '增加 HTTP 服务能力' },
    { value: 'dotenv', label: 'Dotenv + 环境变量校验', hint: '增加环境变量加载能力' },
  ],
  'java-fullstack': [],
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

function buildFeatureOptions(template) {
  return [...COMMON_FEATURE_OPTIONS, ...EXTRA_OPTIONS_MAP[template]]
}

function buildInitialModuleValues() {
  return [...DEFAULT_FEATURE_VALUES]
}

function splitSelectedModules(template, selectedModules) {
  const extraValues = new Set(EXTRA_OPTIONS_MAP[template].map((option) => option.value))
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

function buildConfirmationMessage({
  projectName,
  template,
  packageManager,
  features,
  extras,
}) {
  const featureText = features.length > 0 ? features.join(', ') : '无'
  const extraText = extras.length > 0 ? extras.join(', ') : '无'

  return [
    `项目名称：${projectName}`,
    `模板：${template}`,
    `通用功能：${featureText}`,
    `模板扩展：${extraText}`,
    `包管理器：${packageManager}`,
    '确认开始生成项目？',
  ].join('\n')
}

export async function runPrompts(projectNameArg) {
  try {
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
      options: [
        {
          value: 'react-vite-ts',
          label: 'React + Vite + TypeScript',
        },
        {
          value: 'node-ts',
          label: 'Node.js + TypeScript + ESLint',
        },
        {
          value: 'java-fullstack',
          label: 'Java 全栈 + 前端配套说明',
        },
      ],
      initialValue: 'react-vite-ts',
    }))

    const selectedModules = ensurePromptNotCancelled(await multiselect({
      message: '请选择需要的功能模块',
      options: buildFeatureOptions(template),
      initialValues: buildInitialModuleValues(),
      required: false,
    }))

    const { features, extras } = splitSelectedModules(template, selectedModules)

    const packageManager = ensurePromptNotCancelled(await select({
      message: '请选择包管理器',
      options: [
        { value: 'npm', label: 'npm' },
        { value: 'pnpm', label: 'pnpm' },
        { value: 'yarn', label: 'yarn' },
      ],
      initialValue: 'npm',
    }))

    const confirmed = ensurePromptNotCancelled(await confirm({
      message: buildConfirmationMessage({
        projectName,
        template,
        packageManager,
        features,
        extras,
      }),
      initialValue: true,
    }))

    if (!confirmed) {
      cancel('操作已取消')
      process.exit(0)
    }

    return {
      projectName,
      template,
      features,
      extras,
      packageManager,
      targetDir: resolve(process.cwd(), projectName),
    }
  } catch (error) {
    cancel(`交互问答失败：${error.message}`)
    process.exit(1)
  }
}
