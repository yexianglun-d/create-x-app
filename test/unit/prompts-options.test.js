import assert from 'node:assert/strict'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import {
  BACK_PROMPT_VALUE,
  buildConfigFromOptions,
  buildGenerationPlanMessage,
  buildTemplateChoices,
  confirmGenerationPlan,
  getPromptResumeStep,
  resolveModulePreset,
  runPrompts,
} from '../../src/steps/prompts.js'
import { resolvePresetOptions } from '../../src/presets/loader.js'
import { loadManifest } from '../../src/manifest/loader.js'
import { getConfigValidationErrors } from '../../src/validator/index.js'
import { createTempDir, removeTempDir } from '../helpers/project.js'

let promptProjectCounter = 0

function createPromptAdapter(responses) {
  const calls = []
  let responseIndex = 0

  async function nextResponse(type, options) {
    calls.push({
      type,
      ...options,
    })

    if (responseIndex >= responses.length) {
      throw new Error(`缺少 ${type} prompt 的测试响应：${options.message}`)
    }

    const response = responses[responseIndex]
    responseIndex += 1

    return typeof response === 'function' ? response(options, calls) : response
  }

  return {
    calls,
    text: (options) => nextResponse('text', options),
    select: (options) => nextResponse('select', options),
    multiselect: (options) => nextResponse('multiselect', options),
    note(message, title) {
      calls.push({
        type: 'note',
        message,
        title,
      })
    },
    printLines(lines) {
      calls.push({
        type: 'printLines',
        lines,
      })
    },
  }
}

function nextPromptProjectName(prefix = 'prompt-back') {
  promptProjectCounter += 1
  return `${prefix}-${process.pid}-${promptProjectCounter}`
}

function assertConfigHasNoBackSentinel(config) {
  assert.equal(JSON.stringify(config).includes(BACK_PROMPT_VALUE), false)
}

test('buildConfigFromOptions creates a non-interactive config', () => {
  const cwd = join(tmpdir(), 'cxa-options')
  const config = buildConfigFromOptions('demo-app', {
    template: 'react-vite-ts',
    pm: 'pnpm',
    features: 'eslint,prettier',
    extras: 'tailwind',
    cwd,
  })

  assert.equal(config.projectName, 'demo-app')
  assert.equal(config.template, 'react-vite-ts')
  assert.equal(config.packageManager, 'pnpm')
  assert.deepEqual(config.features, ['eslint', 'prettier'])
  assert.deepEqual(config.extras, ['tailwind'])
  assert.deepEqual(config.fileBasedExtras, ['tailwind'])
  assert.equal(config.targetDir, join(cwd, 'demo-app'))
})

test('required package manager overrides non-interactive pm option', () => {
  const config = buildConfigFromOptions('demo-mono', {
    template: 'monorepo',
    pm: 'npm',
  })

  assert.equal(config.packageManager, 'pnpm')
})

test('validator rejects unknown non-interactive features and extras', () => {
  const errors = getConfigValidationErrors({
    projectName: 'demo-app',
    template: 'node-ts',
    packageManager: 'npm',
    features: ['eslint', 'agents', 'unknown-feature'],
    extras: ['tailwind'],
  })

  assert.match(errors.join('\n'), /unknown-feature/)
  assert.match(errors.join('\n'), /tailwind/)
})

test('template choices include first-time decision hints', () => {
  const manifest = loadManifest('react-vite-ts')
  const [choice] = buildTemplateChoices([manifest])

  assert.equal(choice.value, 'react-vite-ts')
  assert.equal(choice.label, 'React + Vite + TypeScript')
  assert.match(choice.hint, /最轻的 React 起步方案/)
  assert.match(choice.hint, /包管理器：npm\/pnpm\/yarn/)
  assert.match(choice.hint, /dev 端口：5173/)
})

test('module presets split recommended and minimal module selections', () => {
  const manifest = loadManifest('node-ts')
  const recommended = resolveModulePreset(manifest, 'recommended')
  const minimal = resolveModulePreset(manifest, 'minimal')

  assert.deepEqual(recommended.features, ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'])
  assert.deepEqual(recommended.extras, ['express', 'dotenv'])
  assert.deepEqual(minimal.features, ['agents', 'coding-rules'])
  assert.deepEqual(minimal.extras, [])
})

test('generation plan summarizes source and post actions before confirmation', () => {
  const manifest = loadManifest('react-vite-ts')
  const config = buildConfigFromOptions('demo-app', {
    template: 'react-vite-ts',
    features: 'eslint,husky,agents',
    extras: 'tailwind',
  })
  const message = buildGenerationPlanMessage({
    projectName: config.projectName,
    config,
    manifest,
    templateSource: { type: 'builtin' },
    packageManager: config.packageManager,
    features: config.features,
    extras: config.extras,
    dependencyStrategy: 'baseline',
    options: { skipInstall: true, skipGit: true },
  })

  assert.match(message, /Project/)
  assert.match(message, /source\s+内置模板/)
  assert.match(message, /target\s+/)
  assert.match(message, /install\s+跳过/)
  assert.match(message, /git\s+跳过/)
  assert.match(message, /husky\s+安装依赖后手动初始化/)
})

test('template Back returns to project name input', async () => {
  const firstName = nextPromptProjectName('first-name')
  const secondName = nextPromptProjectName('second-name')
  const promptAdapter = createPromptAdapter([
    firstName,
    BACK_PROMPT_VALUE,
    secondName,
    'react-vite-ts',
    'recommended',
    'npm',
  ])

  const config = await runPrompts(undefined, { promptAdapter })
  const textCalls = promptAdapter.calls.filter((call) => call.type === 'text')
  const templateCalls = promptAdapter.calls
    .filter((call) => call.type === 'select' && call.message === '请选择项目模板')

  assert.equal(config.projectName, secondName)
  assert.equal(config.template, 'react-vite-ts')
  assert.equal(textCalls.length, 2)
  assert.equal(templateCalls[0].options.some((option) => option.value === BACK_PROMPT_VALUE), true)
  assertConfigHasNoBackSentinel(config)
})

test('module preset Back returns to template and preserves selected template as initial value', async () => {
  const projectName = nextPromptProjectName('module-back')
  const promptAdapter = createPromptAdapter([
    'node-ts',
    BACK_PROMPT_VALUE,
    'react-vite-ts',
    'minimal',
    'yarn',
  ])

  const config = await runPrompts(projectName, { promptAdapter })
  const templateCalls = promptAdapter.calls
    .filter((call) => call.type === 'select' && call.message === '请选择项目模板')

  assert.equal(config.template, 'react-vite-ts')
  assert.equal(config.packageManager, 'yarn')
  assert.deepEqual(config.features, ['agents', 'coding-rules'])
  assert.equal(templateCalls.length, 2)
  assert.equal(templateCalls[1].initialValue, 'node-ts')
  assertConfigHasNoBackSentinel(config)
})

test('custom module Back returns to module preset and ignores mixed multiselect values', async () => {
  const projectName = nextPromptProjectName('custom-back')
  const promptAdapter = createPromptAdapter([
    'react-vite-ts',
    'custom',
    [BACK_PROMPT_VALUE, 'tailwind'],
    'minimal',
    'npm',
  ])

  const config = await runPrompts(projectName, { promptAdapter })

  assert.equal(config.template, 'react-vite-ts')
  assert.deepEqual(config.features, ['agents', 'coding-rules'])
  assert.deepEqual(config.extras, [])
  assertConfigHasNoBackSentinel(config)
})

test('package manager Back returns to module preset and recomputes recommended modules', async () => {
  const projectName = nextPromptProjectName('pm-back')
  const promptAdapter = createPromptAdapter([
    'node-ts',
    'minimal',
    BACK_PROMPT_VALUE,
    'recommended',
    'pnpm',
  ])

  const config = await runPrompts(projectName, { promptAdapter })

  assert.equal(config.template, 'node-ts')
  assert.equal(config.packageManager, 'pnpm')
  assert.deepEqual(config.features, ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'])
  assert.deepEqual(config.extras, ['express', 'dotenv'])
  assertConfigHasNoBackSentinel(config)
})

test('Electron subPrompt Back returns to package manager before collecting renderer again', async () => {
  const projectName = nextPromptProjectName('electron-back')
  const promptAdapter = createPromptAdapter([
    'electron-app',
    'recommended',
    'npm',
    BACK_PROMPT_VALUE,
    'yarn',
    'react',
  ])

  const config = await runPrompts(projectName, { promptAdapter })
  const packageManagerCalls = promptAdapter.calls
    .filter((call) => call.type === 'select' && call.message === '请选择包管理器')
  const rendererCalls = promptAdapter.calls
    .filter((call) => call.type === 'select' && call.message === '选择渲染进程框架')

  assert.equal(config.template, 'electron-app')
  assert.equal(config.packageManager, 'yarn')
  assert.equal(config.renderer, 'react')
  assert.equal(packageManagerCalls.length, 2)
  assert.equal(rendererCalls.length, 2)
  assertConfigHasNoBackSentinel(config)
})

test('generation plan Back returns a retry action and later confirmation can continue', async () => {
  const manifest = loadManifest('react-vite-ts')
  const config = buildConfigFromOptions(nextPromptProjectName('preview-back'), {
    template: 'react-vite-ts',
  })
  const promptAdapter = createPromptAdapter([
    BACK_PROMPT_VALUE,
    (options) => options.options[0].value,
  ])

  const backAction = await confirmGenerationPlan({
    config,
    manifest,
    templateSource: { type: 'builtin' },
    dependencyStrategy: 'baseline',
    options: { promptAdapter },
  })
  const confirmAction = await confirmGenerationPlan({
    config,
    manifest,
    templateSource: { type: 'builtin' },
    dependencyStrategy: 'baseline',
    options: { promptAdapter },
  })

  assert.equal(backAction, BACK_PROMPT_VALUE)
  assert.equal(confirmAction, true)
})

test('Preview Back resume keeps inferred module preset before stepping back again', async () => {
  const manifest = loadManifest('react-vite-ts')
  const initialConfig = buildConfigFromOptions(nextPromptProjectName('preview-resume'), {
    template: 'react-vite-ts',
    features: 'agents,coding-rules',
    extras: '',
  })
  const promptAdapter = createPromptAdapter([
    BACK_PROMPT_VALUE,
    'recommended',
    'npm',
  ])

  const config = await runPrompts(initialConfig.projectName, {
    promptAdapter,
    initialConfig,
    startStep: getPromptResumeStep(manifest),
  })
  const modulePresetCalls = promptAdapter.calls
    .filter((call) => call.type === 'select' && call.message === '请选择功能组合')

  assert.equal(modulePresetCalls[0].initialValue, 'minimal')
  assert.deepEqual(config.features, ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'])
  assert.deepEqual(config.extras, [])
})

test('built-in preset resolves create options', async () => {
  const options = await resolvePresetOptions({
    preset: 'company-react',
  })

  assert.equal(options.template, 'react-vite-ts')
  assert.equal(options.pm, 'pnpm')
  assert.equal(options.features, 'eslint,prettier,husky,agents,coding-rules,ai-native')
  assert.equal(options.extras, 'react-router,tailwind')
})

test('local preset resolves create options and keeps explicit overrides', async () => {
  const rootDir = await createTempDir('cxa-preset-')

  try {
    const presetPath = join(rootDir, 'preset.json')

    await fs.writeJson(presetPath, {
      template: 'node-ts',
      pm: 'pnpm',
      features: ['agents'],
      extras: ['express'],
      install: false,
    })

    const options = await resolvePresetOptions({
      preset: presetPath,
      pm: 'npm',
    })

    assert.equal(options.template, 'node-ts')
    assert.equal(options.pm, 'npm')
    assert.equal(options.features, 'agents')
    assert.equal(options.extras, 'express')
    assert.equal(options.skipInstall, true)
  } finally {
    await removeTempDir(rootDir)
  }
})
