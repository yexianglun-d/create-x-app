import chalk from 'chalk'
import { join, resolve } from 'node:path'
import { resolveDisplayPath } from '../utils/path.js'

export { resolveDisplayPath }

const SECTION_INDENT = '  '
const EMPTY_TEXT = '无'
const BRAND_BLUE = chalk.hex('#0099F7')

// 该正则专用于剥离终端 ANSI 控制序列，保留控制字符匹配是预期行为。
// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001B\[[0-9;]*m/g

function stripAnsi(value) {
  return String(value).replaceAll(ANSI_PATTERN, '')
}

function isCombiningCodePoint(codePoint) {
  return (codePoint >= 0x0300 && codePoint <= 0x036f)
    || (codePoint >= 0x1ab0 && codePoint <= 0x1aff)
    || (codePoint >= 0x1dc0 && codePoint <= 0x1dff)
    || (codePoint >= 0x20d0 && codePoint <= 0x20ff)
    || (codePoint >= 0xfe20 && codePoint <= 0xfe2f)
}

function isFullWidthCodePoint(codePoint) {
  return (codePoint >= 0x1100 && codePoint <= 0x115f)
    || codePoint === 0x2329
    || codePoint === 0x232a
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
}

export function getDisplayWidth(value) {
  let width = 0

  for (const character of stripAnsi(value)) {
    const codePoint = character.codePointAt(0)

    if (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      continue
    }

    if (isCombiningCodePoint(codePoint)) {
      continue
    }

    width += isFullWidthCodePoint(codePoint) ? 2 : 1
  }

  return width
}

function padVisible(value, targetWidth) {
  const padding = Math.max(0, targetWidth - getDisplayWidth(value))
  return `${value}${' '.repeat(padding)}`
}

function truncateVisible(value, maxWidth) {
  const text = stripAnsi(value)

  if (getDisplayWidth(text) <= maxWidth) {
    return text
  }

  let output = ''
  let width = 0
  const suffix = '...'
  const suffixWidth = getDisplayWidth(suffix)

  for (const character of text) {
    const characterWidth = getDisplayWidth(character)

    if (width + characterWidth + suffixWidth > maxWidth) {
      break
    }

    output += character
    width += characterWidth
  }

  return `${output}${suffix}`
}

function splitLongToken(token, maxWidth) {
  const chunks = []
  let current = ''
  let currentWidth = 0

  for (const character of token) {
    const characterWidth = getDisplayWidth(character)

    if (current && currentWidth + characterWidth > maxWidth) {
      chunks.push(current)
      current = ''
      currentWidth = 0
    }

    current += character
    currentWidth += characterWidth
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

export function wrapText(value, maxWidth) {
  const text = stripAnsi(value).trim()

  if (!text) {
    return ['']
  }

  const safeWidth = Math.max(1, maxWidth)
  const lines = []
  let currentLine = ''

  for (const token of text.split(/\s+/u)) {
    if (getDisplayWidth(token) > safeWidth) {
      if (currentLine) {
        lines.push(currentLine)
        currentLine = ''
      }

      lines.push(...splitLongToken(token, safeWidth))
      continue
    }

    if (!currentLine) {
      currentLine = token
      continue
    }

    const nextLine = `${currentLine} ${token}`

    if (getDisplayWidth(nextLine) <= safeWidth) {
      currentLine = nextLine
    } else {
      lines.push(currentLine)
      currentLine = token
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function boxLine(content, width) {
  return `│  ${content}${' '.repeat(Math.max(0, width - getDisplayWidth(content) - 6))}  │`
}

function boxTop(width) {
  return `┌${'─'.repeat(width - 2)}┐`
}

function boxBottom(width) {
  return `└${'─'.repeat(width - 2)}┘`
}

function boxSeparator(width) {
  return `├${'─'.repeat(width - 2)}┤`
}

function getBoxWidth() {
  const terminalWidth = process.stdout.columns ?? 80
  return Math.max(48, Math.min(76, terminalWidth - 2))
}

function formatBoxValue(value) {
  return stripAnsi(Array.isArray(value) ? formatList(value) : (value ?? EMPTY_TEXT))
}

function getLabelWidth(rows) {
  const maxLabelWidth = Math.max(
    ...rows.map((row) => getDisplayWidth(row.label)),
    0,
  )

  return Math.min(18, Math.max(12, maxLabelWidth + 2))
}

function buildBoxRowLines(row, width, labelWidth) {
  const innerWidth = width - 6
  const valueWidth = innerWidth - labelWidth
  const label = truncateVisible(row.label, labelWidth - 1)
  const valueLines = wrapText(formatBoxValue(row.value), valueWidth)
  const lines = []

  for (const [index, valueLine] of valueLines.entries()) {
    const labelText = index === 0 ? label : ''
    const renderedLabel = chalk.gray(padVisible(labelText, labelWidth))
    lines.push(boxLine(`${renderedLabel}${valueLine}`, width))
  }

  return lines
}

function wrapInBox(title, rows = []) {
  const width = getBoxWidth()
  const labelWidth = getLabelWidth(rows)
  const lines = [
    boxTop(width),
    boxLine(BRAND_BLUE.bold(title), width),
  ]

  if (rows.length > 0) {
    lines.push(boxSeparator(width))

    for (const row of rows) {
      lines.push(...buildBoxRowLines(row, width, labelWidth))
    }
  }

  lines.push(boxBottom(width))
  return lines
}

export function getApplicationWorkspace(config) {
  if (config.template === 'java-fullstack') {
    return resolve(config.targetDir, 'frontend')
  }

  return config.targetDir
}

export function formatTemplateSource(templateSource = {}) {
  if (templateSource.type === 'github') {
    const ref = templateSource.ref ? `#${templateSource.ref}` : ''
    const commit = templateSource.commit ? ` (${String(templateSource.commit).slice(0, 7)})` : ''
    return `GitHub ${templateSource.owner}/${templateSource.repo}${ref}${commit}`
  }

  if (templateSource.type === 'plugin') {
    return `插件 ${templateSource.packageName ?? 'unknown'}@${templateSource.packageVersion ?? 'unknown'}`
  }

  if (templateSource.fallbackReason) {
    return `内置模板（远端回退：${templateSource.fallbackReason}）`
  }

  return '内置模板'
}

export function formatList(values, fallback = EMPTY_TEXT) {
  return values?.length > 0 ? values.join(', ') : fallback
}

export function formatManifestLabels(manifest, values, type) {
  if (!values || values.length === 0) {
    return EMPTY_TEXT
  }

  if (type === 'extra') {
    return values
      .map((extraKey) => manifest.extras?.find((extra) => extra.key === extraKey)?.label ?? extraKey)
      .join(', ')
  }

  return values
    .map((featureKey) => manifest.features?.[featureKey]?.label ?? featureKey)
    .join(', ')
}

function padLabel(label) {
  return label.padEnd(12)
}

export function buildKeyValueLines(rows) {
  return rows.map((row) => {
    const value = Array.isArray(row.value) ? formatList(row.value) : row.value
    return `${SECTION_INDENT}${chalk.gray(padLabel(row.label))}${value ?? EMPTY_TEXT}`
  })
}

export function buildBlockLines(title, rows) {
  return wrapInBox(title, rows)
}

export function printBrandIntro(options = {}) {
  const version = options.version ? chalk.gray(` v${options.version}`) : ''

  console.log()
  console.log(`${BRAND_BLUE.bold('create-x-app')}${version}`)
  console.log(chalk.gray('Production-ready starters with a guided, scriptable create flow.'))
}

export function printStep(index, _total, title, description) {
  console.log()
  console.log(`${chalk.gray(String(index).padStart(2, '0'))} ${BRAND_BLUE.bold(title)}`)

  if (description) {
    console.log(chalk.gray(`${SECTION_INDENT}${description}`))
  }
}

export function printLines(lines) {
  for (const line of lines) {
    console.log(line)
  }
}

export function printSummaryBlock(title, rows) {
  printLines(buildBlockLines(title, rows))
}

export function buildActionPlan({ config, options = {} }) {
  const hasHusky = config.features.includes('husky')

  return {
    install: options.skipInstall ? '跳过' : `${config.packageManager} install`,
    git: options.skipGit ? '跳过' : 'git init + git add + git commit',
    husky: hasHusky
      ? (options.skipInstall ? '安装依赖后手动初始化' : '初始化 commit hook')
      : '未启用',
    templateLock: join('.create-x-app', 'template-lock.json'),
  }
}

export function buildGenerationPlanLines({
  config,
  manifest,
  templateSource,
  dependencyStrategy = 'baseline',
  options = {},
}) {
  const actionPlan = buildActionPlan({ config, options })
  const appWorkspace = getApplicationWorkspace(config)

  return [
    ...buildBlockLines('Project', [
      { label: 'name', value: config.projectName },
      { label: 'target', value: resolveDisplayPath(config.targetDir) },
      { label: 'workspace', value: resolveDisplayPath(appWorkspace) },
    ]),
    '',
    ...buildBlockLines('Stack', [
      { label: 'template', value: `${manifest.name} (${manifest.key})` },
      { label: 'source', value: formatTemplateSource(templateSource) },
      { label: 'package', value: config.packageManager },
      { label: 'features', value: formatManifestLabels(manifest, config.features, 'feature') },
      { label: 'extras', value: formatManifestLabels(manifest, config.extras, 'extra') },
    ]),
    '',
    ...buildBlockLines('Actions', [
      { label: 'deps', value: dependencyStrategy },
      { label: 'install', value: actionPlan.install },
      { label: 'git', value: actionPlan.git },
      { label: 'husky', value: actionPlan.husky },
      { label: 'lockfile', value: actionPlan.templateLock },
    ]),
  ]
}

export function buildGenerationPlanMessage(input) {
  return [
    ...buildGenerationPlanLines(input),
    '',
    '确认开始生成项目？',
  ].join('\n')
}

export function buildTemplateOverviewLines({
  description,
  requirements,
  defaultFeatures,
  defaultExtras,
  devCommand,
}) {
  return [
    ...buildBlockLines('Template', [
      { label: 'use case', value: description },
      { label: 'requires', value: formatList(requirements) },
      { label: 'defaults', value: formatList(defaultFeatures) },
      { label: 'extras', value: formatList(defaultExtras) },
      { label: 'dev', value: devCommand },
    ]),
  ]
}

export function buildDryRunSummaryLines({
  config,
  manifest,
  plannedFiles,
  dependencyStrategy,
  templateSource,
  options = {},
}) {
  const sortedFiles = [...plannedFiles].sort()
  const previewFiles = [
    ...new Set([
      ...sortedFiles.slice(0, 12),
      join('.create-x-app', 'template-lock.json'),
    ]),
  ]
  const actionPlan = buildActionPlan({ config, options })
  const planLines = options.previewPlanPrinted
    ? []
    : [
        '',
        ...buildGenerationPlanLines({
          config,
          manifest,
          templateSource,
          dependencyStrategy,
          options,
        }),
        '',
      ]

  return [
    BRAND_BLUE('Preview only'),
    `${SECTION_INDENT}${chalk.gray('No files will be written, overwritten, installed, or committed.')}`,
    ...planLines,
    ...buildBlockLines('Files', [
      { label: 'planned', value: String(sortedFiles.length) },
      { label: 'lockfile', value: actionPlan.templateLock },
    ]),
    `${SECTION_INDENT}${chalk.gray('preview')}`,
    ...previewFiles.map((filePath) => `${SECTION_INDENT}${SECTION_INDENT}${filePath}`),
  ]
}

export function buildDryRunCompletionLines(config) {
  return [
    chalk.green('Preview complete'),
    `${SECTION_INDENT}${chalk.gray('Dry-run finished without writing files.')}`,
    '',
    ...buildBlockLines('Result', [
      { label: 'project', value: config.projectName },
      { label: 'target', value: resolveDisplayPath(config.targetDir) },
      { label: 'writes', value: 'none' },
      { label: 'installs', value: 'none' },
      { label: 'git', value: 'none' },
    ]),
  ]
}

export function buildCompletionLines(config, workspaceLayout, manifest, documents = [], options = {}) {
  const devScript = manifest.devScript ?? 'dev'
  const commandRows = [
    { label: 'open', value: `cd ${resolveDisplayPath(workspaceLayout.applicationWorkspace)}` },
    { label: 'dev', value: `${config.packageManager} run ${devScript}` },
  ]

  if (manifest.buildScript) {
    commandRows.push({ label: 'build', value: `${config.packageManager} run ${manifest.buildScript}` })
  }

  const lines = [
    chalk.green.bold('Project ready'),
    `${SECTION_INDENT}${chalk.gray('Use the commands below from the generated workspace.')}`,
    '',
    ...buildBlockLines('Commands', commandRows),
    '',
    ...buildBlockLines('Workspace', [
      { label: 'app', value: resolveDisplayPath(workspaceLayout.applicationWorkspace) },
      { label: 'git', value: resolveDisplayPath(workspaceLayout.gitWorkspace) },
      { label: 'metadata', value: join('.create-x-app', 'template-lock.json') },
    ]),
  ]

  if (documents.length > 0) {
    lines.push(
      '',
      ...buildBlockLines('Docs', documents.map((document) => ({
        label: document.fileName,
        value: document.description,
      }))),
    )
  }

  if (options.failedGitActions?.length > 0) {
    lines.push(
      '',
      chalk.yellow('Recovery'),
      `${SECTION_INDENT}${options.failedGitActions.join(', ')} 未成功；项目文件已生成，可进入目录后手动处理。`,
    )
  }

  return lines
}

export function buildEnvSummaryLines(results) {
  const okCount = results.filter((result) => result.ok).length
  const optionalIssues = results.filter((result) => !result.ok && !result.required).length
  const blockingIssues = results.filter((result) => !result.ok && result.required).length
  const status = blockingIssues > 0
    ? 'blocked'
    : optionalIssues > 0
      ? 'ready with warnings'
      : 'ready'

  return [
    ...buildBlockLines('Runtime', [
      { label: 'status', value: status },
      { label: 'checked', value: `${okCount}/${results.length} passed` },
      { label: 'optional', value: optionalIssues > 0 ? `${optionalIssues} warning(s)` : 'clean' },
    ]),
    ...results
      .filter((result) => !result.ok)
      .map((result) => `${SECTION_INDENT}${chalk.yellow(result.name)} ${result.detected ?? 'not found'}  ${chalk.gray(result.scope ?? result.missingMessage)}`),
  ]
}

function buildHelpHeaderLines(title, description) {
  return [
    '',
    BRAND_BLUE.bold(title),
    chalk.gray(description),
    '',
  ]
}

function buildHelpExamplesLines(sections) {
  const lines = ['', BRAND_BLUE('Recommended paths')]

  for (const section of sections) {
    lines.push(`${SECTION_INDENT}${chalk.gray(section.label.padEnd(10))}${section.command}`)

    if (section.hint) {
      lines.push(`${SECTION_INDENT}${chalk.gray(' '.repeat(10))}${chalk.gray(section.hint)}`)
    }
  }

  return [...lines, '']
}

export function buildHelpHeader(kind) {
  const headers = {
    main: [
      'create-x-app',
      'Guided starters for production-minded React, Node, Java, Electron, Chrome extension, and monorepo projects.',
    ],
    template: [
      'create-x-app template',
      'Authoring tools for validating, rendering, and packaging templates.',
    ],
    plugin: [
      'create-x-app plugin',
      'Plugin scaffolding and diagnostics for community template packages.',
    ],
    upgrade: [
      'create-x-app upgrade',
      'Project maintenance flow for checking and applying scaffold upgrades.',
    ],
  }
  const [title, description] = headers[kind] ?? headers.main

  return buildHelpHeaderLines(title, description).join('\n')
}

export function buildHelpExamples(kind) {
  const examples = {
    main: [
      {
        label: 'preview',
        command: '$ create-x-app demo --template react-vite-ts --dry-run',
        hint: 'Inspect the plan before writing files.',
      },
      {
        label: 'create',
        command: '$ create-x-app demo --template react-vite-ts --yes',
        hint: 'Use recommended defaults without prompts.',
      },
      {
        label: 'config',
        command: '$ create-x-app demo --template react-vite-ts --print-config',
        hint: 'Emit JSON only for scripts and CI.',
      },
      {
        label: 'team',
        command: '$ create-x-app app --preset company-react --yes',
        hint: 'Replay a shared team profile.',
      },
    ],
    template: [
      {
        label: 'lint',
        command: '$ create-x-app template lint --template react-vite-ts',
      },
      {
        label: 'test',
        command: '$ create-x-app template test --template react-vite-ts',
      },
      {
        label: 'pack',
        command: '$ create-x-app template pack',
      },
    ],
    plugin: [
      {
        label: 'create',
        command: '$ create-x-app plugin init cxa-plugin-demo',
      },
      {
        label: 'doctor',
        command: '$ create-x-app plugin doctor --details',
      },
    ],
    upgrade: [
      {
        label: 'check',
        command: '$ create-x-app upgrade --check',
      },
      {
        label: 'review',
        command: '$ create-x-app upgrade --diff',
      },
      {
        label: 'apply',
        command: '$ create-x-app upgrade --apply --backup',
      },
    ],
  }

  return buildHelpExamplesLines(examples[kind] ?? examples.main).join('\n')
}
