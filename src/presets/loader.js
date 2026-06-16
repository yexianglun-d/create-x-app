import fs from 'fs-extra'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'

const BUILT_IN_PRESETS = {
  'company-react': {
    template: 'react-vite-ts',
    pm: 'pnpm',
    features: ['eslint', 'prettier', 'husky', 'agents', 'coding-rules', 'ai-native'],
    extras: ['react-router', 'tailwind'],
    deps: 'baseline',
    install: true,
    git: true,
  },
  'node-service': {
    template: 'node-ts',
    pm: 'npm',
    features: ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'],
    extras: ['express', 'dotenv'],
    deps: 'baseline',
    install: true,
    git: true,
  },
}

function expandHome(path) {
  if (path === '~') {
    return homedir()
  }

  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2))
  }

  return path
}

function isPathPreset(ref) {
  return ref.startsWith('.')
    || ref.startsWith('/')
    || ref.startsWith('~')
    || ref.endsWith('.json')
}

function parseGithubPreset(ref) {
  const value = ref.slice('github:'.length)
  const [pathPart, refPart = 'main'] = value.split('#')
  const parts = pathPart.split('/').filter(Boolean)

  if (parts.length < 2) {
    throw new Error('GitHub preset 格式应为 github:owner/repo[/path/to/preset.json][#ref]')
  }

  const [owner, repo, ...presetPathParts] = parts
  const presetPath = presetPathParts.length > 0 ? presetPathParts.join('/') : 'preset.json'

  return {
    owner,
    repo,
    path: presetPath,
    ref: refPart,
  }
}

async function loadGithubPreset(ref) {
  const preset = parseGithubPreset(ref)
  const url = `https://raw.githubusercontent.com/${preset.owner}/${preset.repo}/${preset.ref}/${preset.path}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`GitHub preset 拉取失败：${response.status} ${response.statusText}`)
  }

  return {
    source: ref,
    config: await response.json(),
  }
}

async function loadPathPreset(ref) {
  const presetPath = isAbsolute(expandHome(ref))
    ? expandHome(ref)
    : resolve(process.cwd(), expandHome(ref))

  return {
    source: presetPath,
    config: await fs.readJson(presetPath),
  }
}

export async function loadPreset(ref) {
  if (!ref) {
    return null
  }

  if (BUILT_IN_PRESETS[ref]) {
    return {
      source: ref,
      config: BUILT_IN_PRESETS[ref],
    }
  }

  if (ref.startsWith('github:')) {
    return loadGithubPreset(ref)
  }

  if (isPathPreset(ref)) {
    return loadPathPreset(ref)
  }

  throw new Error(`未知 preset：${ref}`)
}

function hasOption(options, key) {
  return options[key] !== undefined
}

function normalizeList(value) {
  if (!Array.isArray(value)) {
    return value
  }

  return value.join(',')
}

export async function resolvePresetOptions(options = {}) {
  const preset = await loadPreset(options.preset)

  if (!preset) {
    return options
  }

  const presetConfig = preset.config
  const resolvedOptions = {
    ...options,
    presetSource: preset.source,
    template: hasOption(options, 'template') ? options.template : presetConfig.template,
    pm: hasOption(options, 'pm') ? options.pm : presetConfig.pm ?? presetConfig.packageManager,
    features: hasOption(options, 'features') ? options.features : normalizeList(presetConfig.features),
    extras: hasOption(options, 'extras') ? options.extras : normalizeList(presetConfig.extras),
    deps: hasOption(options, 'deps') ? options.deps : presetConfig.deps ?? presetConfig.dependencyStrategy,
  }

  if (presetConfig.install === false) {
    resolvedOptions.skipInstall = true
  }

  if (presetConfig.git === false) {
    resolvedOptions.skipGit = true
  }

  return resolvedOptions
}
