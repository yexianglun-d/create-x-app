import fs from 'fs-extra'
import { homedir } from 'node:os'
import { join } from 'node:path'

const GITHUB_API_BASE_URL = 'https://api.github.com'
const REMOTE_OWNER = 'yexianglun-d'
const REMOTE_REPO = 'create-x-app'
const REMOTE_REF = 'main'
const REQUEST_TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000
const DEFAULT_CACHE_DIR = join(homedir(), '.create-x-app', 'cache', 'templates')

function buildGitHubHeaders() {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'create-x-app-cli',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function requestWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    return response
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`请求超时：${url}`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchJson(url) {
  const response = await requestWithTimeout(url, {
    headers: buildGitHubHeaders(),
  })

  return response.json()
}

async function fetchFile(url) {
  const response = await requestWithTimeout(url, {
    headers: buildGitHubHeaders(),
  })
  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

async function findValidCache(templateKey, cacheDir) {
  const cacheExists = await fs.pathExists(cacheDir)

  if (!cacheExists) {
    return null
  }

  const entries = await fs.readdir(cacheDir, { withFileTypes: true })
  const cachePrefix = `cxa-${templateKey}-`
  const now = Date.now()
  const candidates = []

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(cachePrefix)) {
      continue
    }

    const candidatePath = join(cacheDir, entry.name)
    const stat = await fs.stat(candidatePath)

    if (now - stat.mtimeMs <= CACHE_TTL_MS) {
      candidates.push({ path: candidatePath, mtimeMs: stat.mtimeMs })
    }
  }

  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs)

  return candidates[0]?.path ?? null
}

async function getRemoteCommitSha() {
  const commit = await fetchJson(
    `${GITHUB_API_BASE_URL}/repos/${REMOTE_OWNER}/${REMOTE_REPO}/commits/${REMOTE_REF}`,
  )

  if (!commit.sha) {
    throw new Error('远端提交信息缺少 sha')
  }

  return commit.sha.slice(0, 12)
}

async function downloadGitHubDirectory(apiUrl, targetDir) {
  const entries = await fetchJson(apiUrl)

  if (!Array.isArray(entries)) {
    throw new Error(`远端路径不是目录：${apiUrl}`)
  }

  await fs.ensureDir(targetDir)

  /**
   * GitHub Contents API 需要逐层遍历目录。
   *
   * 说明：
   * 1. 目录通过 `url` 继续拉取，文件通过 `download_url` 下载原始内容
   * 2. 这里不解析文件类型，统一按 Buffer 写入，避免 SVG、图片等二进制模板被破坏
   */
  for (const entry of entries) {
    const targetPath = join(targetDir, entry.name)

    if (entry.type === 'dir') {
      await downloadGitHubDirectory(entry.url, targetPath)
      continue
    }

    if (entry.type === 'file') {
      const fileContent = await fetchFile(entry.download_url)
      await fs.outputFile(targetPath, fileContent)
    }
  }
}

/**
 * 拉取远端模板到本地缓存目录。
 *
 * 说明：
 * 1. 默认优先复用 24 小时内的缓存，保证 `--remote` 不会每次都打 GitHub API
 * 2. `--no-cache` 会跳过缓存并按当前 main 提交重新下载
 * 3. 本函数只负责远端能力；失败由 resolver 捕获并回退本地模板
 *
 * @param {string} templateKey 模板唯一标识
 * @param {{cacheDir?: string, noCache?: boolean}} options 拉取选项
 * @returns {Promise<string>} 可供生成器复制的模板目录
 */
export async function fetchRemoteTemplate(templateKey, options = {}) {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR

  if (!options.noCache) {
    const cachedTemplatePath = await findValidCache(templateKey, cacheDir)

    if (cachedTemplatePath) {
      return cachedTemplatePath
    }
  }

  const commitSha = await getRemoteCommitSha()
  const targetDir = join(cacheDir, `cxa-${templateKey}-${commitSha}`)
  const templateExists = await fs.pathExists(targetDir)

  if (templateExists && !options.noCache) {
    const now = new Date()
    await fs.utimes(targetDir, now, now)
    return targetDir
  }

  const temporaryDir = `${targetDir}.tmp-${Date.now()}`
  const templateApiUrl = `${GITHUB_API_BASE_URL}/repos/${REMOTE_OWNER}/${REMOTE_REPO}/contents/templates/${templateKey}?ref=${REMOTE_REF}`

  await fs.remove(temporaryDir)

  try {
    await downloadGitHubDirectory(templateApiUrl, temporaryDir)
    await fs.remove(targetDir)
    await fs.move(temporaryDir, targetDir, { overwrite: true })
    return targetDir
  } finally {
    await fs.remove(temporaryDir)
  }
}
