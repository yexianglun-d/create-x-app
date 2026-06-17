import assert from 'node:assert/strict'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import {
  buildConfigFromOptions,
  buildGenerationPlanMessage,
  buildTemplateChoices,
  resolveModulePreset,
} from '../../src/steps/prompts.js'
import { resolvePresetOptions } from '../../src/presets/loader.js'
import { loadManifest } from '../../src/manifest/loader.js'
import { getConfigValidationErrors } from '../../src/validator/index.js'
import { createTempDir, removeTempDir } from '../helpers/project.js'

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
  assert.match(choice.hint, /适合中小型前端应用/)
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
