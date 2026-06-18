import assert from 'node:assert/strict'
import test from 'node:test'
import { loadManifest } from '../../src/manifest/loader.js'
import { buildTemplateToolDefinitions, runBaseEnvCheck } from '../../src/steps/env-check.js'

function getToolKeys(tools) {
  return tools.map((tool) => tool.key).sort()
}

test('react template does not check Java or pnpm for npm users', () => {
  const manifest = loadManifest('react-vite-ts')
  const tools = buildTemplateToolDefinitions(manifest, {
    packageManager: 'npm',
  }, {
    skipGit: true,
  })

  assert.deepEqual(getToolKeys(tools), [])
})

test('template env check includes Git unless git init is skipped', () => {
  const manifest = loadManifest('react-vite-ts')
  const tools = buildTemplateToolDefinitions(manifest, {
    packageManager: 'npm',
  }, {
    skipGit: false,
  })

  assert.deepEqual(getToolKeys(tools), ['git'])
})

test('java fullstack template checks Java and Maven as required backend tooling', () => {
  const manifest = loadManifest('java-fullstack')
  const tools = buildTemplateToolDefinitions(manifest, {
    packageManager: 'npm',
  }, {
    skipGit: true,
  })
  const java = tools.find((tool) => tool.key === 'java')
  const maven = tools.find((tool) => tool.key === 'maven')

  assert.ok(java)
  assert.equal(java.required, true)
  assert.equal(java.minimum, '21.0.0')
  assert.ok(maven)
  assert.equal(maven.required, true)
  assert.equal(maven.minimum, '3.9.0')
})

test('monorepo template checks pnpm for pnpm users', () => {
  const manifest = loadManifest('monorepo')
  const tools = buildTemplateToolDefinitions(manifest, {
    packageManager: 'pnpm',
  }, {
    skipGit: true,
  })

  assert.deepEqual(getToolKeys(tools), ['pnpm'])
})

test('base env check does not emit spinner control codes in CI output', async () => {
  const originalError = console.error
  const originalLog = console.log
  const originalCi = process.env.CI
  const output = []

  console.error = (...args) => {
    output.push(args.join(' '))
  }
  console.log = (...args) => {
    output.push(args.join(' '))
  }
  process.env.CI = '1'

  try {
    await runBaseEnvCheck({
      detectVersionImpl: async () => '22.0.0',
    })
  } finally {
    console.error = originalError
    console.log = originalLog

    if (originalCi === undefined) {
      delete process.env.CI
    } else {
      process.env.CI = originalCi
    }
  }

  const text = output.join('\n')

  assert.match(text, /CLI 运行环境检测完成/)
  // 该正则专用于捕获终端光标显示/隐藏控制序列。
  // eslint-disable-next-line no-control-regex
  assert.doesNotMatch(text, /\u001B\[\?25[lh]/)
})
