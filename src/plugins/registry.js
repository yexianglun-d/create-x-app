import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPluginTemplates } from './loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const TEMPLATES_DIR = join(__dirname, '../../templates')

function readJsonFile(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function loadBuiltinTemplates() {
  return readdirSync(TEMPLATES_DIR)
    .filter((directoryName) => existsSync(join(TEMPLATES_DIR, directoryName, 'manifest.json')))
    .map((directoryName) => {
      const templatePath = join(TEMPLATES_DIR, directoryName)
      const manifest = readJsonFile(join(templatePath, 'manifest.json'))

      return {
        ...manifest,
        source: 'builtin',
        templatePath,
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))
}

export function loadTemplateRegistry() {
  const builtinTemplates = loadBuiltinTemplates()
  const usedTemplateKeys = new Set(builtinTemplates.map((template) => template.key))
  const pluginTemplates = loadPluginTemplates()
    .filter((template) => {
      if (usedTemplateKeys.has(template.key)) {
        return false
      }

      usedTemplateKeys.add(template.key)
      return true
    })
    .sort((left, right) => left.key.localeCompare(right.key))

  return [...builtinTemplates, ...pluginTemplates]
}

export function loadTemplateDefinition(templateKey) {
  const template = loadTemplateRegistry().find((candidate) => candidate.key === templateKey)

  if (!template) {
    throw new Error(`未知模板：${templateKey}`)
  }

  return template
}
