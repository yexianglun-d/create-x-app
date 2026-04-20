import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, '../../templates')

const TEMPLATE_MAP = {
  'react-vite-ts': join(TEMPLATES_DIR, 'react-vite-ts'),
  'node-ts': join(TEMPLATES_DIR, 'node-ts'),
  'java-fullstack': join(TEMPLATES_DIR, 'java-fullstack'),
}

/**
 * 根据模板标识解析模板目录绝对路径。
 *
 * @param {string} templateKey 模板唯一标识
 * @returns {string} 模板目录绝对路径
 * @throws {Error} 当模板标识不存在时抛出异常
 */
export function resolveTemplate(templateKey) {
  const templatePath = TEMPLATE_MAP[templateKey]

  if (!templatePath) {
    throw new Error(`未知模板：${templateKey}`)
  }

  return templatePath
}
