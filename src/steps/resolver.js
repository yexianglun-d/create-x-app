import { loadManifest } from '../manifest/loader.js'
import { fetchRemoteTemplateSource } from '../remote/template-fetcher.js'
import { logger } from '../utils/logger.js'

function buildLocalTemplateSource(manifest, fallbackReason) {
  const source = {
    type: manifest.source ?? 'builtin',
    templatePath: manifest.templatePath,
  }

  if (manifest.source === 'plugin') {
    source.packageName = manifest.packageName
    source.packageVersion = manifest.packageVersion
  }

  if (fallbackReason) {
    source.fallbackReason = fallbackReason
  }

  return source
}

/**
 * 根据模板标识解析模板目录绝对路径。
 *
 * @param {string} templateKey 模板唯一标识
 * @param {{remote?: boolean, noCache?: boolean, ref?: string, strictRemote?: boolean, fetchImpl?: typeof fetch}} options 模板解析选项
 * @returns {Promise<{templatePath: string, source: Record<string, unknown>, manifest: Record<string, unknown>}>} 模板目录与来源
 * @throws {Error} 当模板标识不存在时抛出异常
 */
export async function resolveTemplateSource(templateKey, options = {}) {
  const manifest = loadManifest(templateKey)

  if (!options.remote || manifest.source === 'plugin') {
    const source = buildLocalTemplateSource(manifest)

    return {
      templatePath: source.templatePath,
      source,
      manifest,
    }
  }

  try {
    logger.step(`正在拉取远端模板（ref: ${options.ref ?? 'main'}）...`)
    const source = await fetchRemoteTemplateSource(templateKey, {
      noCache: options.noCache,
      ref: options.ref,
      fetchImpl: options.fetchImpl,
    })

    return {
      templatePath: source.templatePath,
      source,
      manifest,
    }
  } catch (error) {
    if (options.strictRemote) {
      throw new Error(`远端模板拉取失败，已启用 strict remote：${error.message}`)
    }

    logger.warn(`远端模板拉取失败，使用本地版本（${error.message}）`)
    const source = buildLocalTemplateSource(manifest, error.message)

    return {
      templatePath: source.templatePath,
      source,
      manifest,
    }
  }
}

export async function resolveTemplate(templateKey, options = {}) {
  const templateSource = await resolveTemplateSource(templateKey, options)
  return templateSource.templatePath
}
