import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const distDir = join(projectRoot, 'dist')

await mkdir(distDir, { recursive: true })
await copyFile(join(projectRoot, 'manifest.json'), join(distDir, 'manifest.json'))
