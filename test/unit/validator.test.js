import assert from 'node:assert/strict'
import test from 'node:test'
import { getConfigValidationErrors } from '../../src/validator/index.js'

test('monorepo must use pnpm', () => {
  const errors = getConfigValidationErrors({
    template: 'monorepo',
    packageManager: 'npm',
    extras: [],
  })

  assert.deepEqual(errors, ['全栈 Monorepo（Turborepo） 必须使用 pnpm'])
})

test('unknown extras are rejected by manifest rules', () => {
  const errors = getConfigValidationErrors({
    template: 'node-ts',
    packageManager: 'npm',
    extras: ['react-router'],
  })

  assert.deepEqual(errors, ['Node.js + TypeScript + ESLint 不支持模板扩展：react-router'])
})

test('valid react router config passes', () => {
  const errors = getConfigValidationErrors({
    template: 'react-vite-ts',
    packageManager: 'npm',
    extras: ['react-router'],
  })

  assert.deepEqual(errors, [])
})
