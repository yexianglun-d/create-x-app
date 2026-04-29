import { execa } from 'execa'
import { spawnSync } from 'node:child_process'

const PM_COMMANDS = {
  npm: {
    install: ['install'],
    installPkg: (pkg) => ['install', pkg],
    run: (script) => ['run', script],
    dlx: (command, ...args) => ['exec', '--', command, ...args],
    lockFile: 'package-lock.json',
  },
  pnpm: {
    install: ['install'],
    installPkg: (pkg) => ['add', pkg],
    run: (script) => ['run', script],
    dlx: (command, ...args) => ['dlx', command, ...args],
    lockFile: 'pnpm-lock.yaml',
  },
  yarn: {
    install: ['install'],
    installPkg: (pkg) => ['add', pkg],
    run: (script) => ['run', script],
    dlx: (command, ...args) => ['dlx', command, ...args],
    lockFile: 'yarn.lock',
  },
}

function getPmDefinition(packageManager) {
  const pmDefinition = PM_COMMANDS[packageManager]

  if (!pmDefinition) {
    throw new Error(`不支持的包管理器：${packageManager}`)
  }

  return pmDefinition
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
  })

  return !result.error
}

function resolvePmExecutable(packageManager, hasCommand = commandExists) {
  if (hasCommand(packageManager)) {
    return {
      command: packageManager,
      prefixArgs: [],
    }
  }

  if ((packageManager === 'pnpm' || packageManager === 'yarn') && hasCommand('corepack')) {
    return {
      command: 'corepack',
      prefixArgs: [packageManager],
    }
  }

  return {
    command: packageManager,
    prefixArgs: [],
  }
}

export function createPmAdapter(packageManager, options = {}) {
  const pmDefinition = getPmDefinition(packageManager)
  const executable = resolvePmExecutable(packageManager, options.commandExists)

  return {
    name: packageManager,
    executable: executable.command,
    lockFile: pmDefinition.lockFile,
    getInstallCommand() {
      return {
        command: executable.command,
        args: [...executable.prefixArgs, ...pmDefinition.install],
      }
    },
    getInstallPackageCommand(packageName) {
      return {
        command: executable.command,
        args: [...executable.prefixArgs, ...pmDefinition.installPkg(packageName)],
      }
    },
    getRunCommand(script) {
      return {
        command: executable.command,
        args: [...executable.prefixArgs, ...pmDefinition.run(script)],
      }
    },
    getDlxCommand(command, args = []) {
      return {
        command: executable.command,
        args: [...executable.prefixArgs, ...pmDefinition.dlx(command, ...args)],
      }
    },
    install(cwd, options = {}) {
      const command = this.getInstallCommand()
      return execa(command.command, command.args, { cwd, ...options })
    },
    installPackage(packageName, cwd, options = {}) {
      const command = this.getInstallPackageCommand(packageName)
      return execa(command.command, command.args, { cwd, ...options })
    },
    run(script, cwd, options = {}) {
      const command = this.getRunCommand(script)
      return execa(command.command, command.args, { cwd, ...options })
    },
    dlx(commandName, cwd, args = [], options = {}) {
      const command = this.getDlxCommand(commandName, args)
      return execa(command.command, command.args, { cwd, ...options })
    },
  }
}
