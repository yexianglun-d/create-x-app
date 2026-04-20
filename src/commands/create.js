import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'
import { generateProject } from '../generator/index.js'
import { runPostActions } from '../steps/post-actions.js'
import { runEnvCheck } from '../steps/env-check.js'
import { runPrompts } from '../steps/prompts.js'
import { resolveTemplate } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'

export async function createCommand(projectNameArg, options) {
  try {
    console.log()
    intro(chalk.bgCyan.black(' create-x-app-cli '))
    logger.debug(`CLI 选项：${JSON.stringify(options)}`)

    await runEnvCheck()

    const config = await runPrompts(projectNameArg)
    const templatePath = resolveTemplate(config.template)

    logger.detail(`目标目录：${config.targetDir}`)
    logger.detail(`模板目录：${templatePath}`)

    await generateProject({
      config,
      templatePath,
    })

    await runPostActions({
      config,
      options,
    })

    outro(chalk.green(`项目 ${config.projectName} 已就绪！`))
  } catch (error) {
    logger.reportError('创建项目失败', error)
    process.exit(1)
  }
}
