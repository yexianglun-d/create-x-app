import { join } from 'node:path'
import { TEMPLATES_DIR, loadManifest } from '../manifest/loader.js'

/**
 * 根据模板标识解析模板目录绝对路径。
 *
 * @param {string} templateKey 模板唯一标识
 * @returns {string} 模板目录绝对路径
 * @throws {Error} 当模板标识不存在时抛出异常
 */
export function resolveTemplate(templateKey) {
  try {
    loadManifest(templateKey)
  } catch {
    throw new Error(`未知模板：${templateKey}`)
  }

  return join(TEMPLATES_DIR, templateKey)
}
