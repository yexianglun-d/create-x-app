import { loadManifest } from '../manifest/loader.js'
import { fetchRemoteTemplate } from '../remote/template-fetcher.js'
import { logger } from '../utils/logger.js'

/**
 * 根据模板标识解析模板目录绝对路径。
 *
 * @param {string} templateKey 模板唯一标识
 * @param {{remote?: boolean, noCache?: boolean}} options 模板解析选项
 * @returns {Promise<string>} 模板目录绝对路径
 * @throws {Error} 当模板标识不存在时抛出异常
 */
export async function resolveTemplate(templateKey, options = {}) {
  const manifest = loadManifest(templateKey)
  const localTemplatePath = manifest.templatePath

  if (!options.remote || manifest.source === 'plugin') {
    return localTemplatePath
  }

  try {
    logger.step('正在拉取最新模板...')
    return await fetchRemoteTemplate(templateKey, {
      noCache: options.noCache,
    })
  } catch (error) {
    logger.warn(`远端模板拉取失败，使用本地版本（${error.message}）`)
    return localTemplatePath
  }
}
