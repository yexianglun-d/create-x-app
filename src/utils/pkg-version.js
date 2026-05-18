const NPM_REGISTRY_URL = 'https://registry.npmjs.org'
const DEFAULT_TIMEOUT_MS = 3_000

async function fetchPackageLatestVersion(packageName, timeout) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  const packageUrl = `${NPM_REGISTRY_URL}/${encodeURIComponent(packageName)}/latest`

  try {
    const response = await fetch(packageUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'create-x-app-cli',
      },
    })

    if (!response.ok) {
      return null
    }

    const packageMetadata = await response.json()
    return typeof packageMetadata.version === 'string' ? packageMetadata.version : null
  } catch {
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 并发查询 npm 包 latest 版本。
 *
 * 说明：
 * 1. `--latest` 是可选增强能力，不能因网络或单包失败阻断生成流程
 * 2. 失败项返回 `null`，由生成器按包粒度回退模板基线版本
 *
 * @param {string[]} packageNames npm 包名列表
 * @param {{timeout?: number}} options 查询选项
 * @returns {Promise<Record<string, string | null>>} 包名到 latest 版本的映射
 */
export async function getLatestVersions(packageNames, options = {}) {
  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS
  const uniquePackageNames = [...new Set(packageNames)]
  const versionEntries = await Promise.all(uniquePackageNames.map(async (packageName) => [
    packageName,
    await fetchPackageLatestVersion(packageName, timeout),
  ]))

  return Object.fromEntries(versionEntries)
}
