import assert from 'node:assert/strict'
import test from 'node:test'
import { createPmAdapter } from '../../src/utils/pm-adapter.js'

test('npm command mapping is stable', () => {
  const npm = createPmAdapter('npm', { commandExists: () => true })

  assert.deepEqual(npm.getInstallCommand(), { command: 'npm', args: ['install'] })
  assert.deepEqual(npm.getDlxCommand('husky'), { command: 'npm', args: ['exec', '--', 'husky'] })
  assert.equal(npm.lockFile, 'package-lock.json')
})

test('pnpm uses corepack when standalone binary is missing', () => {
  const pnpm = createPmAdapter('pnpm', {
    commandExists: (command) => command === 'corepack',
  })

  assert.deepEqual(pnpm.getInstallCommand(), { command: 'corepack', args: ['pnpm', 'install'] })
  assert.deepEqual(pnpm.getRunCommand('build'), { command: 'corepack', args: ['pnpm', 'run', 'build'] })
})

test('unknown package manager throws', () => {
  assert.throws(() => createPmAdapter('bun'), /不支持的包管理器/)
})
