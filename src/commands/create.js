import { ensureTelemetryConsent, getTelemetryConsent } from '../analytics/consent.js'
import { reportAnalyticsEvent, reportCreateEvent } from '../analytics/index.js'
import { generateProject } from '../generator/index.js'
import { runPostActions } from '../steps/post-actions.js'
import { runBaseEnvCheck, runTemplateEnvCheck } from '../steps/env-check.js'
import {
  BACK_PROMPT_VALUE,
  buildConfigFromOptions,
  confirmGenerationPlan,
  getPromptResumeStep,
  runPrompts,
} from '../steps/prompts.js'
import { resolveTemplateSource } from '../steps/resolver.js'
import { resolvePresetOptions } from '../presets/loader.js'
import {
  buildDryRunCompletionLines,
  printBrandIntro,
  printLines,
  printStep,
} from '../ui/create-ui.js'
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

function resolveDependencyStrategy(options = {}, behavior = {}) {
  if (options.deps && !DEPENDENCY_STRATEGIES.has(options.deps)) {
    throw new Error(`不支持的依赖策略：${options.deps}。可选值：${[...DEPENDENCY_STRATEGIES].join(', ')}`)
  }

  if (options.latest) {
    if (options.deps) {
      if (!behavior.silent) {
        logger.warn('--latest 已弃用，且当前已显式传入 --deps，将使用 --deps 指定的策略')
      }

      return options.deps
    }

    if (!behavior.silent) {
      logger.warn('--latest 已弃用，请改用 --deps latest')
    }

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

function shouldBuildPrintConfig(options = {}) {
  return Boolean(options.printConfig)
}

function getFailureEvent(stage, error) {
  if (error?.telemetryEvent) {
    return error.telemetryEvent
  }

  const events = {
    env_check: 'env_check_failed',
    prompts: 'prompt_failed',
    validate_config: 'prompt_failed',
    resolve_template: 'resolve_template_failed',
    template_env_check: 'env_check_failed',
    generate: 'generate_failed',
    post_actions: 'install_failed',
  }

  return events[stage] ?? 'create_failed'
}

export async function createCommand(projectNameArg, options) {
  let resolvedOptions = options
  let config = null
  let telemetryEnabled = false
  let currentStage = 'create_start'

  async function reportStageEvent(event, extra = {}) {
    await reportAnalyticsEvent({
      event,
      config,
      cliVersion: resolvedOptions.cliVersion,
      enabled: telemetryEnabled,
      ...extra,
    })
  }

  try {
    resolvedOptions = await resolvePresetOptions(options)
    const dependencyStrategy = resolveDependencyStrategy(resolvedOptions, {
      silent: shouldBuildPrintConfig(resolvedOptions),
    })

    if (shouldBuildPrintConfig(resolvedOptions)) {
      currentStage = 'config'
      config = buildConfigFromOptions(projectNameArg, resolvedOptions)
      validateConfig(config)
      console.log(JSON.stringify({
        ...config,
        dependencyStrategy,
      }, null, 2))
      return
    }

    printBrandIntro({ version: resolvedOptions.cliVersion })
    logger.debug(`CLI 选项：${JSON.stringify(resolvedOptions)}`)
    printDependencyStrategyWarning(dependencyStrategy)
    telemetryEnabled = await getTelemetryConsent({
      noTelemetry: resolvedOptions.telemetry === false,
    }) === true
    await reportStageEvent('create_start')

    let templateSource = null
    let promptStartStep = null
    let projectStepPrinted = false
    const checkedEnvKeys = new Set()

    while (true) {
      currentStage = 'prompts'

      if (!projectStepPrinted) {
        printStep(1, 4, 'Project', 'Choose the project shape and generation defaults.')
        projectStepPrinted = true
      }

      config = await runPrompts(projectNameArg, {
        ...resolvedOptions,
        initialConfig: config ?? undefined,
        startStep: promptStartStep ?? undefined,
        onCancel: async () => {
          await reportStageEvent('prompt_cancelled', {
            stage: 'prompts',
          })
        },
      })
      promptStartStep = null

      currentStage = 'validate_config'
      validateConfig(config)

      currentStage = 'resolve_template'
      templateSource = await resolveTemplateSource(config.template, {
        remote: resolvedOptions.remote,
        noCache: resolvedOptions.cache === false,
        ref: resolveDefaultRemoteRef(resolvedOptions),
        strictRemote: resolvedOptions.strictRemote,
      })

      const envKey = [
        config.template,
        config.packageManager,
        resolvedOptions.skipGit ? 'skip-git' : 'git',
      ].join(':')

      if (!checkedEnvKeys.has(envKey)) {
        currentStage = 'env_check'
        printStep(2, 4, 'Check', 'Validate the runtime needed for this template.')
        await runBaseEnvCheck()

        currentStage = 'template_env_check'
        await runTemplateEnvCheck(templateSource.manifest, config, {
          skipGit: resolvedOptions.skipGit,
        })

        checkedEnvKeys.add(envKey)
      }

      printStep(3, 4, 'Preview', 'Review the exact project plan before generation.')
      const generationPlanAction = await confirmGenerationPlan({
        config,
        manifest: templateSource.manifest,
        templateSource: templateSource.source,
        dependencyStrategy,
        options: resolvedOptions,
      })

      if (generationPlanAction === BACK_PROMPT_VALUE) {
        promptStartStep = getPromptResumeStep(templateSource.manifest)
        continue
      }

      break
    }

    logger.detail(`目标目录：${config.targetDir}`)
    logger.detail(`模板目录：${templateSource.templatePath}`)

    currentStage = 'generate'
    printStep(4, 4, 'Generate', resolvedOptions.dryRun
      ? 'Preview only. No files will be written.'
      : 'Copy, render, and prepare the generated project.')
    await generateProject({
      config,
      options: {
        cliVersion: resolvedOptions.cliVersion,
        dryRun: resolvedOptions.dryRun,
        force: resolvedOptions.force,
        dependencyStrategy,
        preset: resolvedOptions.presetSource ?? resolvedOptions.preset,
        previewPlanPrinted: resolvedOptions.dryRun,
        skipInstall: resolvedOptions.skipInstall,
        skipGit: resolvedOptions.skipGit,
      },
      templatePath: templateSource.templatePath,
      templateSource: templateSource.source,
    })

    if (resolvedOptions.dryRun) {
      printLines(buildDryRunCompletionLines(config))
      return
    }

    telemetryEnabled = await ensureTelemetryConsent({
      noTelemetry: resolvedOptions.telemetry === false,
    })

    currentStage = 'post_actions'
    await runPostActions({
      config,
      options: resolvedOptions,
      onStageFailure: async ({ event, action }) => {
        await reportStageEvent(event, {
          stage: 'post_actions',
          errorCategory: action ? `git_${action}` : 'git',
        })
      },
    })

    await reportCreateEvent({
      config,
      cliVersion: resolvedOptions.cliVersion,
      enabled: telemetryEnabled,
    })
  } catch (error) {
    await reportStageEvent(getFailureEvent(currentStage, error), {
      stage: currentStage,
      error,
    })
    logger.reportError('创建项目失败', error)
    process.exit(1)
  }
}
