import assert from 'node:assert/strict'
import test from 'node:test'
import { getConfigValidationErrors } from '../../src/validator/index.js'

test('monorepo must use pnpm', () => {
  const errors = getConfigValidationErrors({
    template: 'monorepo',
    packageManager: 'npm',
    extras: [],
  })

  assert.deepEqual(errors, ['Monorepo 模板必须使用 pnpm（依赖 pnpm workspace）'])
})

test('react-router is limited to react templates', () => {
  const errors = getConfigValidationErrors({
    template: 'node-ts',
    packageManager: 'npm',
    extras: ['react-router'],
  })

  assert.deepEqual(errors, ['React Router 仅适用于 React 类模板'])
})

test('valid react router config passes', () => {
  const errors = getConfigValidationErrors({
    template: 'react-vite-ts',
    packageManager: 'npm',
    extras: ['react-router'],
  })

  assert.deepEqual(errors, [])
})
