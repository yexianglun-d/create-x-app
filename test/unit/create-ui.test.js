import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBlockLines,
  buildCompletionLines,
  buildDryRunSummaryLines,
  buildEnvSummaryLines,
  buildHelpExamples,
} from '../../src/ui/create-ui.js'
import { loadManifest } from '../../src/manifest/loader.js'

function buildConfig(overrides = {}) {
  return {
    projectName: 'demo-app',
    template: 'react-vite-ts',
    features: ['eslint', 'husky', 'agents'],
    extras: ['tailwind'],
    packageManager: 'npm',
    targetDir: '/tmp/demo-app',
    ...overrides,
  }
}

test('branded block presenter renders aligned sections', () => {
  const output = buildBlockLines('Project', [
    { label: 'name', value: 'demo-app' },
    { label: 'target', value: '/tmp/demo-app' },
  ]).join('\n')

  assert.match(output, /Project/)
  assert.match(output, /name\s+demo-app/)
  assert.match(output, /target\s+\/tmp\/demo-app/)
})

test('dry-run presenter keeps machine-safe action detail and file preview', () => {
  const manifest = loadManifest('react-vite-ts')
  const output = buildDryRunSummaryLines({
    config: buildConfig(),
    manifest,
    plannedFiles: new Set(['package.json', '.gitignore', 'src/App.tsx']),
    dependencyStrategy: 'baseline',
    templateSource: { type: 'builtin' },
    options: {
      skipInstall: true,
      skipGit: true,
      previewPlanPrinted: true,
    },
  }).join('\n')

  assert.match(output, /Preview only/)
  assert.match(output, /Files/)
  assert.match(output, /planned\s+3/)
  assert.match(output, /\.gitignore/)
  assert.doesNotMatch(output, /Stack/)
})

test('completion presenter includes next commands, docs, metadata and recovery', () => {
  const targetDir = '/tmp/demo-app'
  const output = buildCompletionLines(
    buildConfig({ targetDir }),
    {
      applicationWorkspace: targetDir,
      gitWorkspace: targetDir,
      huskyWorkspace: targetDir,
      installTargets: [targetDir],
    },
    {
      devScript: 'dev',
      buildScript: 'build',
    },
    [
      {
        fileName: 'AGENTS.md',
        description: 'AI 协作规则说明',
      },
    ],
    {
      failedGitActions: ['git commit'],
    },
  ).join('\n')

  assert.match(output, /Project ready/)
  assert.match(output, /npm run dev/)
  assert.match(output, /npm run build/)
  assert.match(output, /\.create-x-app\/template-lock\.json/)
  assert.match(output, /AGENTS\.md/)
  assert.match(output, /git commit 未成功/)
})

test('environment summary defaults to compact status output', () => {
  const output = buildEnvSummaryLines([
    {
      name: 'Node.js',
      detected: '22.0.0',
      ok: true,
      required: true,
      minimum: '18.0.0',
      scope: 'CLI 运行',
    },
    {
      name: 'Git',
      detected: null,
      ok: false,
      required: false,
      minimum: '2.0.0',
      scope: 'Git 初始化',
      missingMessage: 'Git 未找到',
    },
  ]).join('\n')

  assert.match(output, /Runtime/)
  assert.match(output, /ready with warnings/)
  assert.match(output, /checked\s+1\/2 passed/)
  assert.match(output, /Git/)
})

test('help examples use the branded recommended-path language', () => {
  const output = buildHelpExamples('main')

  assert.match(output, /Recommended paths/)
  assert.match(output, /create-x-app demo --template react-vite-ts --dry-run/)
  assert.match(output, /--print-config/)
})

