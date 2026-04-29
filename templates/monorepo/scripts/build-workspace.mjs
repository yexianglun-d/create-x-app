import { spawnSync } from 'node:child_process'

function hasCommand(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
  })

  return !result.error
}

function runStep(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  })

  if (result.status === 0) {
    return
  }

  process.exit(result.status ?? 1)
}

/**
 * 优先使用 Turborepo 执行增量构建；若当前环境只有 corepack 而没有独立 pnpm 二进制，
 * 则回退为显式构建各工作区，保证 `pnpm build` 在最小 Node 18 环境下也能跑通。
 */
if (hasCommand('pnpm')) {
  runStep('turbo', ['run', 'build'])
} else {
  runStep('corepack', ['pnpm', '-C', 'packages/shared', 'run', 'build'])
  runStep('corepack', ['pnpm', '-C', 'apps/api', 'run', 'build'])
  runStep('corepack', ['pnpm', '-C', 'apps/web', 'run', 'build'])
}
