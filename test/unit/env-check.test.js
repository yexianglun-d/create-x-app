import assert from 'node:assert/strict'
import test from 'node:test'
import { loadManifest } from '../../src/manifest/loader.js'
import { buildTemplateToolDefinitions } from '../../src/steps/env-check.js'

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
