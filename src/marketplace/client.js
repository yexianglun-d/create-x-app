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

function normalizeRepository(repository, links = {}) {
  if (typeof repository === 'string' && repository.trim()) {
    return repository.trim()
  }

  if (repository && typeof repository === 'object' && typeof repository.url === 'string') {
    return repository.url
  }

  if (typeof links.repository === 'string' && links.repository.trim()) {
    return links.repository.trim()
  }

  return null
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

async function requestPackageMetadata(packageName) {
  const url = getRegistryUrl(encodeURIComponent(packageName))
  return requestJson(url)
}

function pickLatestVersion(metadata) {
  return metadata['dist-tags']?.latest ?? metadata.version ?? null
}

function normalizePackageMetadata(packageName, metadata, weeklyDownloads = null) {
  const version = pickLatestVersion(metadata)
  const latestVersion = version ? metadata.versions?.[version] : null
  const cxaPluginApi = latestVersion?.cxaPluginApi
    ?? latestVersion?.['cxa-plugin-api']
    ?? metadata.cxaPluginApi
    ?? metadata['cxa-plugin-api']
    ?? null

  return {
    name: metadata.name ?? packageName,
    version: version ?? '-',
    description: latestVersion?.description ?? metadata.description ?? '',
    weeklyDownloads,
    updatedAt: metadata.time?.modified ?? null,
    license: latestVersion?.license ?? metadata.license ?? null,
    repository: normalizeRepository(latestVersion?.repository ?? metadata.repository, latestVersion?.links ?? metadata.links),
    cxaPluginApi,
    scripts: latestVersion?.scripts ?? {},
    isCxaPlugin: metadata['cxa-plugin'] === true || latestVersion?.['cxa-plugin'] === true,
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
    updatedAt: pkg.date ?? null,
    license: pkg.license ?? null,
    repository: normalizeRepository(pkg.repository, pkg.links),
  })))
}

export async function getPluginPackageMetadata(packageName) {
  const normalizedPackageName = normalizePluginPackageName(packageName)
  const [metadata, weeklyDownloads] = await Promise.all([
    requestPackageMetadata(normalizedPackageName),
    getWeeklyDownloads(normalizedPackageName),
  ])

  if (!metadata['cxa-plugin'] && !metadata.versions?.[pickLatestVersion(metadata)]?.['cxa-plugin']) {
    throw new Error(`${normalizedPackageName} 不是有效的 create-x-app 插件包`)
  }

  return normalizePackageMetadata(normalizedPackageName, metadata, weeklyDownloads)
}
