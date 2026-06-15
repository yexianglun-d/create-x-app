import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'
import { ensureTelemetryConsent } from '../analytics/consent.js'
import { reportCreateEvent } from '../analytics/index.js'
import { generateProject } from '../generator/index.js'
import { runPostActions } from '../steps/post-actions.js'
import { runEnvCheck } from '../steps/env-check.js'
import { runPrompts } from '../steps/prompts.js'
import { resolveTemplate } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'
import { validateConfig } from '../validator/index.js'

export async function createCommand(projectNameArg, options) {
  try {
    console.log()
    intro(chalk.bgCyan.black(' create-x-app '))
    logger.debug(`CLI 选项：${JSON.stringify(options)}`)

    await runEnvCheck()

    const config = await runPrompts(projectNameArg, options)
    validateConfig(config)

    if (options.printConfig) {
      console.log(JSON.stringify(config, null, 2))
      return
    }

    const templatePath = await resolveTemplate(config.template, {
      remote: options.remote,
      noCache: options.cache === false,
    })

    logger.detail(`目标目录：${config.targetDir}`)
    logger.detail(`模板目录：${templatePath}`)

    await generateProject({
      config,
      options: {
        dryRun: options.dryRun,
        force: options.force,
        latest: options.latest,
      },
      templatePath,
    })

    if (options.dryRun) {
      outro(chalk.green('Dry run 完成，未写入任何文件'))
      return
    }

    const telemetryEnabled = await ensureTelemetryConsent({
      noTelemetry: options.telemetry === false,
    })

    await runPostActions({
      config,
      options,
    })

    outro(chalk.green(`项目 ${config.projectName} 已就绪！`))

    await reportCreateEvent({
      config,
      cliVersion: options.cliVersion,
      enabled: telemetryEnabled,
    })
  } catch (error) {
    logger.reportError('创建项目失败', error)
    process.exit(1)
  }
}
