import fs from 'fs-extra'
import { homedir } from 'node:os'
import { join } from 'node:path'

const GITHUB_API_BASE_URL = 'https://api.github.com'
const REMOTE_OWNER = 'yexianglun-d'
const REMOTE_REPO = 'create-x-app'
const DEFAULT_REMOTE_REF = 'main'
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

function normalizeRemoteRef(ref) {
  return typeof ref === 'string' && ref.trim().length > 0 ? ref.trim() : DEFAULT_REMOTE_REF
}

function encodeRemoteRef(ref) {
  return encodeURIComponent(normalizeRemoteRef(ref))
}

function createCacheRefSegment(ref) {
  return normalizeRemoteRef(ref).replace(/[^a-zA-Z0-9._-]/g, '-')
}

function createCachePrefix(templateKey, ref) {
  return `cxa-${templateKey}-${createCacheRefSegment(ref)}-`
}

function createRemoteSource({ templatePath, ref, commit, cacheHit }) {
  return {
    type: 'github',
    owner: REMOTE_OWNER,
    repo: REMOTE_REPO,
    ref: normalizeRemoteRef(ref),
    commit,
    cacheHit,
    templatePath,
  }
}

async function requestWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const fetchImpl = options.fetchImpl ?? fetch

  try {
    const requestOptions = { ...options }
    delete requestOptions.fetchImpl

    const response = await fetchImpl(url, {
      ...requestOptions,
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

async function fetchJson(url, options = {}) {
  const response = await requestWithTimeout(url, {
    fetchImpl: options.fetchImpl,
    headers: buildGitHubHeaders(),
  })

  return response.json()
}

async function fetchFile(url, options = {}) {
  const response = await requestWithTimeout(url, {
    fetchImpl: options.fetchImpl,
    headers: buildGitHubHeaders(),
  })
  const arrayBuffer = await response.arrayBuffer()

  return Buffer.from(arrayBuffer)
}

async function findValidCache(templateKey, cacheDir, ref) {
  const cacheExists = await fs.pathExists(cacheDir)

  if (!cacheExists) {
    return null
  }

  const entries = await fs.readdir(cacheDir, { withFileTypes: true })
  const cachePrefix = createCachePrefix(templateKey, ref)
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

  const cachedTemplatePath = candidates[0]?.path

  if (!cachedTemplatePath) {
    return null
  }

  return createRemoteSource({
    templatePath: cachedTemplatePath,
    ref,
    commit: cachedTemplatePath.split(cachePrefix).at(-1) ?? null,
    cacheHit: true,
  })
}

async function getRemoteCommitSha(ref, options = {}) {
  const commit = await fetchJson(
    `${GITHUB_API_BASE_URL}/repos/${REMOTE_OWNER}/${REMOTE_REPO}/commits/${encodeRemoteRef(ref)}`,
    options,
  )

  if (!commit.sha) {
    throw new Error('远端提交信息缺少 sha')
  }

  return commit.sha.slice(0, 12)
}

async function downloadGitHubDirectory(apiUrl, targetDir, options = {}) {
  const entries = await fetchJson(apiUrl, options)

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
      await downloadGitHubDirectory(entry.url, targetPath, options)
      continue
    }

    if (entry.type === 'file') {
      const fileContent = await fetchFile(entry.download_url, options)
      await fs.outputFile(targetPath, fileContent)
    }
  }
}

/**
 * 拉取远端模板到本地缓存目录。
 *
 * 说明：
 * 1. 默认优先复用 24 小时内的缓存，保证 `--remote` 不会每次都打 GitHub API
 * 2. `--no-cache` 会跳过缓存并按指定 ref 重新下载
 * 3. 本函数只负责远端能力；失败语义由 resolver 决定
 *
 * @param {string} templateKey 模板唯一标识
 * @param {{cacheDir?: string, noCache?: boolean, ref?: string, fetchImpl?: typeof fetch}} options 拉取选项
 * @returns {Promise<{type: string, owner: string, repo: string, ref: string, commit: string, cacheHit: boolean, templatePath: string}>} 远端模板来源
 */
export async function fetchRemoteTemplateSource(templateKey, options = {}) {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR
  const ref = normalizeRemoteRef(options.ref)

  if (!options.noCache) {
    const cachedTemplateSource = await findValidCache(templateKey, cacheDir, ref)

    if (cachedTemplateSource) {
      return cachedTemplateSource
    }
  }

  const commitSha = await getRemoteCommitSha(ref, {
    fetchImpl: options.fetchImpl,
  })
  const targetDir = join(cacheDir, `${createCachePrefix(templateKey, ref)}${commitSha}`)
  const templateExists = await fs.pathExists(targetDir)

  if (templateExists && !options.noCache) {
    const now = new Date()
    await fs.utimes(targetDir, now, now)
    return createRemoteSource({
      templatePath: targetDir,
      ref,
      commit: commitSha,
      cacheHit: true,
    })
  }

  const temporaryDir = `${targetDir}.tmp-${Date.now()}`
  const templateApiUrl = `${GITHUB_API_BASE_URL}/repos/${REMOTE_OWNER}/${REMOTE_REPO}/contents/templates/${templateKey}?ref=${encodeRemoteRef(ref)}`

  await fs.remove(temporaryDir)

  try {
    await downloadGitHubDirectory(templateApiUrl, temporaryDir, {
      fetchImpl: options.fetchImpl,
    })
    await fs.remove(targetDir)
    await fs.move(temporaryDir, targetDir, { overwrite: true })
    return createRemoteSource({
      templatePath: targetDir,
      ref,
      commit: commitSha,
      cacheHit: false,
    })
  } finally {
    await fs.remove(temporaryDir)
  }
}

export async function fetchRemoteTemplate(templateKey, options = {}) {
  const source = await fetchRemoteTemplateSource(templateKey, options)
  return source.templatePath
}
