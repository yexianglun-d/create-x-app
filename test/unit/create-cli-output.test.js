import assert from 'node:assert/strict'
import test from 'node:test'
import { execa } from 'execa'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = join(__dirname, '../../bin/cli.js')

test('--print-config writes pure JSON to stdout', async () => {
  const result = await execa('node', [
    CLI_PATH,
    'demo-app',
    '--template',
    'react-vite-ts',
    '--print-config',
    '--no-telemetry',
  ])

  assert.equal(result.stderr, '')
  assert.doesNotMatch(result.stdout, /┌\s+create-x-app/)
  assert.doesNotMatch(result.stdout, /正在检测/)

  const config = JSON.parse(result.stdout)

  assert.equal(config.projectName, 'demo-app')
  assert.equal(config.template, 'react-vite-ts')
  assert.equal(config.dependencyStrategy, 'baseline')
})

test('--print-config errors keep stdout empty and explain available templates', async () => {
  const result = await execa('node', [
    CLI_PATH,
    'demo-app',
    '--template',
    'missing-template',
    '--print-config',
    '--no-telemetry',
  ], {
    reject: false,
  })

  assert.equal(result.exitCode, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /未找到模板定义：missing-template/)
  assert.match(result.stderr, /可用模板：/)
})

test('dry-run output stays lightweight and free of terminal control codes', async () => {
  const result = await execa('node', [
    CLI_PATH,
    'demo-app',
    '--template',
    'react-vite-ts',
    '--yes',
    '--dry-run',
    '--skip-install',
    '--skip-git',
    '--no-telemetry',
  ], {
    env: {
      CI: '1',
      NO_COLOR: '1',
    },
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.match(result.stdout, /create-x-app/)
  assert.match(result.stdout, /01 Project/)
  assert.match(result.stdout, /04 Generate/)
  assert.match(result.stdout, /Preview only/)
  // 该正则专用于捕获终端光标显示/隐藏控制序列。
  // eslint-disable-next-line no-control-regex
  assert.doesNotMatch(output, /\u001B\[\?25[lh]/)
  assert.doesNotMatch(output, /___/)
})
