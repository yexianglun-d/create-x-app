import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'fs-extra'
import { join } from 'node:path'
import { createTempDir, removeTempDir } from '../helpers/project.js'
import { buildNextStepLines, runPostActions } from '../../src/steps/post-actions.js'

function createConfig(overrides = {}) {
  return {
    projectName: 'post-actions-test',
    template: 'react-vite-ts',
    features: [],
    packageManager: 'npm',
    targetDir: '/tmp/post-actions-test',
    ...overrides,
  }
}

function createCommandRecorder() {
  const commands = []

  return {
    commands,
    runner: async (commandOptions) => {
      commands.push(commandOptions)
      return true
    },
  }
}

async function captureConsoleOutput(callback) {
  const originalLog = console.log
  const output = []

  console.log = (...args) => {
    output.push(args.join(' '))
  }

  try {
    await callback()
  } finally {
    console.log = originalLog
  }

  return output.join('\n')
}

test('skip-install prevents dependency install and Husky initialization', async () => {
  const { commands, runner } = createCommandRecorder()
  let chmodCalled = false

  await captureConsoleOutput(async () => {
    await runPostActions({
      config: createConfig({ features: ['husky'] }),
      options: { skipInstall: true, skipGit: true },
      runner,
      chmodFile: async () => {
        chmodCalled = true
      },
      pathExists: async () => false,
    })
  })

  assert.deepEqual(commands, [])
  assert.equal(chmodCalled, false)
})

test('Husky uses Node chmod instead of spawning chmod command', async () => {
  const { commands, runner } = createCommandRecorder()
  const chmodCalls = []

  await captureConsoleOutput(async () => {
    await runPostActions({
      config: createConfig({ features: ['husky'] }),
      options: { skipInstall: false, skipGit: true },
      runner,
      chmodFile: async (filePath, mode) => {
        chmodCalls.push({ filePath, mode })
      },
      pathExists: async () => false,
      platform: 'darwin',
    })
  })

  assert.deepEqual(
    commands.map((commandOptions) => [commandOptions.command, commandOptions.args]),
    [
      ['npm', ['install']],
      ['npm', ['exec', '--', 'husky', 'install']],
    ],
  )
  assert.equal(commands.some((commandOptions) => commandOptions.command === 'chmod'), false)
  assert.equal(chmodCalls.length, 1)
  assert.equal(chmodCalls[0].mode, 0o755)
  assert.equal(chmodCalls[0].filePath.endsWith(join('.husky', 'commit-msg')), true)
})

test('Windows skips chmod for Husky hooks', async () => {
  const { runner } = createCommandRecorder()
  let chmodCalled = false

  await captureConsoleOutput(async () => {
    await runPostActions({
      config: createConfig({ features: ['husky'] }),
      options: { skipInstall: false, skipGit: true },
      runner,
      chmodFile: async () => {
        chmodCalled = true
      },
      pathExists: async () => false,
      platform: 'win32',
    })
  })

  assert.equal(chmodCalled, false)
})

test('next steps only print documents that exist in the generated project', async () => {
  const targetDir = await createTempDir('cxa-post-actions-')

  try {
    await fs.writeFile(join(targetDir, 'AGENTS.md'), '# AGENTS.md\n')

    const output = await captureConsoleOutput(async () => {
      await runPostActions({
        config: createConfig({ targetDir }),
        options: { skipInstall: true, skipGit: true },
        runner: async () => true,
        pathExists: fs.pathExists,
      })
    })

    assert.match(output, /npm run dev/)
    assert.match(output, /AGENTS\.md/)
    assert.doesNotMatch(output, /coding-rules\.md/)
  } finally {
    await removeTempDir(targetDir)
  }
})

test('next step lines include build command, metadata and git recovery hint', async () => {
  const targetDir = await createTempDir('cxa-next-lines-')

  try {
    await fs.writeFile(join(targetDir, 'AGENTS.md'), '# AGENTS.md\n')

    const lines = await buildNextStepLines(
      createConfig({ targetDir }),
      {
        applicationWorkspace: targetDir,
        gitWorkspace: targetDir,
        huskyWorkspace: targetDir,
        installTargets: [targetDir],
      },
      {
        devScript: 'dev',
        buildScript: 'build',
      },
      fs.pathExists,
      {
        failedGitActions: ['git commit'],
      },
    )
    const output = lines.join('\n')

    assert.match(output, /npm run dev/)
    assert.match(output, /npm run build/)
    assert.match(output, /\.create-x-app\/template-lock\.json/)
    assert.match(output, /AGENTS\.md/)
    assert.match(output, /git commit 未成功/)
  } finally {
    await removeTempDir(targetDir)
  }
})

test('Git failures notify post action stage failure hook without throwing', async () => {
  const failures = []

  await captureConsoleOutput(async () => {
    await runPostActions({
      config: createConfig(),
      options: { skipInstall: true, skipGit: false },
      runner: async (commandOptions) => commandOptions.command !== 'git',
      pathExists: async () => false,
      onStageFailure: async (failure) => {
        failures.push(failure)
      },
    })
  })

  assert.deepEqual(failures, [
    { event: 'git_failed', action: 'init' },
    { event: 'git_failed', action: 'add' },
    { event: 'git_failed', action: 'commit' },
  ])
})

test('install failures are tagged for telemetry reporting', async () => {
  await assert.rejects(
    () => runPostActions({
      config: createConfig(),
      options: { skipInstall: false, skipGit: true },
      runner: async () => {
        throw new Error('install failed with local path /tmp/demo')
      },
      pathExists: async () => false,
    }),
    (error) => {
      assert.equal(error.telemetryEvent, 'install_failed')
      return true
    },
  )
})
