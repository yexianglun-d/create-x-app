import { execa } from 'execa'
import ora from 'ora'
import { logger } from '../utils/logger.js'

export async function runGlobalNpmCommand(title, args) {
  const spinner = ora(title).start()

  try {
    logger.command('npm', args)

    const result = await execa('npm', args, {
      reject: false,
    })

    if (result.exitCode === 0) {
      spinner.succeed(title)
      return
    }

    throw new Error((result.stderr || result.stdout || 'npm 命令执行失败').trim())
  } catch (error) {
    spinner.fail(title)
    throw error
  }
}
