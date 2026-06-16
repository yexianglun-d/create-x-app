import { intro, outro } from '@clack/prompts'
import chalk from 'chalk'
import { ensureTelemetryConsent } from '../analytics/consent.js'
import { reportCreateEvent } from '../analytics/index.js'
import { generateProject } from '../generator/index.js'
import { runPostActions } from '../steps/post-actions.js'
import { runBaseEnvCheck, runTemplateEnvCheck } from '../steps/env-check.js'
import { runPrompts } from '../steps/prompts.js'
import { resolveTemplateSource } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'
import { validateConfig } from '../validator/index.js'

const DEPENDENCY_STRATEGIES = new Set([
  'baseline',
  'latest-patch',
  'latest-minor',
  'latest-major',
  'latest',
])

function resolveDefaultRemoteRef(options) {
  if (options.ref) {
    return options.ref
  }

  return options.cliVersion ? `v${options.cliVersion}` : undefined
}

function resolveDependencyStrategy(options = {}) {
  if (options.deps && !DEPENDENCY_STRATEGIES.has(options.deps)) {
    throw new Error(`不支持的依赖策略：${options.deps}。可选值：${[...DEPENDENCY_STRATEGIES].join(', ')}`)
  }

  if (options.latest) {
    if (options.deps) {
      logger.warn('--latest 已弃用，且当前已显式传入 --deps，将使用 --deps 指定的策略')
      return options.deps
    }

    logger.warn('--latest 已弃用，请改用 --deps latest')
    return 'latest'
  }

  return options.deps ?? 'baseline'
}

function printDependencyStrategyWarning(strategy) {
  if (strategy === 'latest-major') {
    logger.warn('依赖策略 latest-major 允许跨 major 升级，可能导致模板代码和依赖 API 不兼容')
  } else if (strategy === 'latest') {
    logger.warn('依赖策略 latest 为实验模式，会使用 npm latest，可能引入 breaking changes')
  }
}

export async function createCommand(projectNameArg, options) {
  try {
    console.log()
    intro(chalk.bgCyan.black(' create-x-app '))
    logger.debug(`CLI 选项：${JSON.stringify(options)}`)
    const dependencyStrategy = resolveDependencyStrategy(options)
    printDependencyStrategyWarning(dependencyStrategy)

    await runBaseEnvCheck()

    const config = await runPrompts(projectNameArg, options)
    validateConfig(config)

    if (options.printConfig) {
      console.log(JSON.stringify({
        ...config,
        dependencyStrategy,
      }, null, 2))
      return
    }

    const templateSource = await resolveTemplateSource(config.template, {
      remote: options.remote,
      noCache: options.cache === false,
      ref: resolveDefaultRemoteRef(options),
      strictRemote: options.strictRemote,
    })

    await runTemplateEnvCheck(templateSource.manifest, config, {
      skipGit: options.skipGit,
    })

    logger.detail(`目标目录：${config.targetDir}`)
    logger.detail(`模板目录：${templateSource.templatePath}`)

    await generateProject({
      config,
      options: {
        cliVersion: options.cliVersion,
        dryRun: options.dryRun,
        force: options.force,
        dependencyStrategy,
      },
      templatePath: templateSource.templatePath,
      templateSource: templateSource.source,
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
