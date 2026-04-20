import test from 'node:test'
import assert from 'node:assert/strict'
import { detectVersion } from '../src/utils/version.js'

test('detectVersion 对未知命令返回 null', async () => {
  const detectedVersion = await detectVersion('create-x-app-command-not-found', ['--version'])

  assert.equal(detectedVersion, null)
})

test('detectVersion 对 node 命令返回语义化版本号', async () => {
  const detectedVersion = await detectVersion('node', ['--version'])

  assert.match(detectedVersion, /^\d+\.\d+\.\d+$/)
})
