import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import {
  buildAnalyticsPayload,
  getErrorCategory,
  reportAnalyticsEvent,
} from '../../src/analytics/index.js'

test('analytics payload omits project names, paths and error messages', () => {
  const payload = buildAnalyticsPayload({
    event: 'generate_failed',
    config: {
      projectName: 'secret-project',
      targetDir: '/Users/example/secret-project',
      template: 'react-vite-ts',
    },
    cliVersion: '1.2.3',
    stage: 'generate',
    errorCategory: 'error',
  })

  assert.deepEqual(Object.keys(payload).sort(), [
    'cliVersion',
    'errorCategory',
    'event',
    'nodeVersion',
    'osType',
    'stage',
    'template',
  ])
  assert.equal(JSON.stringify(payload).includes('secret-project'), false)
  assert.equal(JSON.stringify(payload).includes('/Users/example'), false)
})

test('getErrorCategory returns coarse error categories only', () => {
  const error = new Error('sensitive /Users/example/path')

  assert.equal(getErrorCategory(error), 'error')
  assert.equal(getErrorCategory({ name: 'AbortError' }), 'abort')
  assert.equal(getErrorCategory({ code: 'EACCES' }), 'EACCES')
})

test('reportAnalyticsEvent respects disabled telemetry', async () => {
  let called = false
  mock.method(globalThis, 'fetch', async () => {
    called = true
    return { ok: true }
  })

  const reported = await reportAnalyticsEvent({
    event: 'create_start',
    enabled: false,
  })

  assert.equal(reported, false)
  assert.equal(called, false)
})
