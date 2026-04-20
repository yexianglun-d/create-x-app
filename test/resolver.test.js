import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTemplate } from '../src/steps/resolver.js'

test('resolveTemplate 对已知模板返回正确路径', () => {
  const reactTemplatePath = resolveTemplate('react-vite-ts')
  const nodeTemplatePath = resolveTemplate('node-ts')
  const javaTemplatePath = resolveTemplate('java-fullstack')

  assert.match(reactTemplatePath, /templates\/react-vite-ts$/)
  assert.match(nodeTemplatePath, /templates\/node-ts$/)
  assert.match(javaTemplatePath, /templates\/java-fullstack$/)
})

test('resolveTemplate 对未知模板抛出错误', () => {
  assert.throws(() => resolveTemplate('unknown-template'), /未知模板/)
})
