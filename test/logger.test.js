import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatTable,
  getLoggerOptions,
  setLoggerOptions,
} from '../src/utils/logger.js'

test('setLoggerOptions 在 debug 模式下自动启用 verbose', () => {
  setLoggerOptions({ debug: true })

  assert.deepEqual(getLoggerOptions(), {
    verbose: true,
    debug: true,
  })

  setLoggerOptions({ verbose: false, debug: false })
})

test('formatTable 会生成表头、分隔线和数据行', () => {
  const lines = formatTable(
    [
      { key: 'status', title: '状态' },
      { key: 'tool', title: '工具' },
    ],
    [
      { status: '✔ 通过', tool: 'Node.js' },
      { status: '⚠ 可选', tool: 'pnpm' },
    ],
  )

  assert.equal(lines.length, 4)
  assert.match(lines[0], /状态/)
  assert.match(lines[0], /工具/)
  assert.match(lines[2], /Node\.js/)
  assert.match(lines[3], /pnpm/)
})
