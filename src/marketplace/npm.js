import { execa } from 'execa'
import { createStatusSpinner } from '../ui/spinner.js'
import { logger } from '../utils/logger.js'

export async function runGlobalNpmCommand(title, args) {
  const s = createStatusSpinner()
  s.start(title)

  try {
    logger.command('npm', args)

    const result = await execa('npm', args, {
      reject: false,
    })

    if (result.exitCode === 0) {
      s.stop(title)
      return
    }

    throw new Error((result.stderr || result.stdout || 'npm 命令执行失败').trim())
  } catch (error) {
    s.stop(title)
    throw error
  }
}
