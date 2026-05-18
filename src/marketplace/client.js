const NPM_REGISTRY_URL = process.env.npm_config_registry ?? 'https://registry.npmjs.org'
const NPM_DOWNLOADS_API_URL = 'https://api.npmjs.org'
const REQUEST_TIMEOUT_MS = 5_000
const DEFAULT_SEARCH_LIMIT = 10
const MAX_SEARCH_LIMIT = 50
const PLUGIN_PACKAGE_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?cxa-plugin-[a-z0-9][a-z0-9._-]*$/

function getRegistryUrl(pathname) {
  return new URL(pathname, `${NPM_REGISTRY_URL.replace(/\/+$/, '')}/`)
}

function buildSearchText(keyword) {
  const normalizedKeyword = keyword?.trim()

  if (!normalizedKeyword) {
    return 'cxa-plugin-'
  }

  return `cxa-plugin- ${normalizedKeyword}`
}

function normalizeLimit(limit) {
  const parsedLimit = Number.parseInt(limit, 10)

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return DEFAULT_SEARCH_LIMIT
  }

  return Math.min(parsedLimit, MAX_SEARCH_LIMIT)
}

function getUnscopedPackageName(packageName) {
  return packageName.split('/').at(-1)
}

async function requestJson(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'create-x-app-cli',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    return response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`请求超时：${url}`)
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getWeeklyDownloads(packageName) {
  const encodedPackageName = encodeURIComponent(packageName)
  const url = `${NPM_DOWNLOADS_API_URL}/downloads/point/last-week/${encodedPackageName}`

  try {
    const result = await requestJson(url)
    return Number.isInteger(result.downloads) ? result.downloads : null
  } catch {
    return null
  }
}

export function isPluginPackageName(packageName) {
  if (typeof packageName !== 'string') {
    return false
  }

  return PLUGIN_PACKAGE_PATTERN.test(packageName)
}

export function normalizePluginPackageName(packageName) {
  if (typeof packageName !== 'string') {
    throw new Error('插件包名必须是 cxa-plugin-* 或 @scope/cxa-plugin-*')
  }

  const normalizedPackageName = packageName.trim().toLowerCase()

  if (!isPluginPackageName(normalizedPackageName)) {
    throw new Error('插件包名必须是 cxa-plugin-* 或 @scope/cxa-plugin-*')
  }

  return normalizedPackageName
}

export async function searchMarketplacePlugins(keyword, options = {}) {
  const limit = normalizeLimit(options.limit)
  const url = getRegistryUrl('-/v1/search')

  url.searchParams.set('text', buildSearchText(keyword))
  url.searchParams.set('size', String(limit))

  const result = await requestJson(url)
  const packages = (result.objects ?? [])
    .map((item) => item.package)
    .filter((pkg) => pkg?.name && isPluginPackageName(getUnscopedPackageName(pkg.name)))
    .slice(0, limit)

  return Promise.all(packages.map(async (pkg) => ({
    name: pkg.name,
    version: pkg.version,
    description: pkg.description ?? '',
    weeklyDownloads: await getWeeklyDownloads(pkg.name),
  })))
}
