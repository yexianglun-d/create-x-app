import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const TEMPLATES_DIR = join(__dirname, '../../templates')

export function loadManifest(templateKey) {
  const manifestPath = join(TEMPLATES_DIR, templateKey, 'manifest.json')

  if (!existsSync(manifestPath)) {
    throw new Error(`模板 ${templateKey} 缺少 manifest.json`)
  }

  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

export function loadAllManifests() {
  return readdirSync(TEMPLATES_DIR)
    .filter((directoryName) => existsSync(join(TEMPLATES_DIR, directoryName, 'manifest.json')))
    .map((directoryName) => loadManifest(directoryName))
    .sort((left, right) => left.key.localeCompare(right.key))
}
