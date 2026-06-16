import fs from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateProject } from '../generator/index.js'
import { loadAllManifests, loadManifest } from '../manifest/loader.js'
import { resolveTemplate } from '../steps/resolver.js'
import { logger } from '../utils/logger.js'

function selectManifests(templateKey) {
  if (templateKey) {
    return [loadManifest(templateKey)]
  }

  return loadAllManifests()
}

function buildAuthorTestConfig(manifest, targetDir) {
  const extras = (manifest.extras ?? [])
    .filter((extra) => extra.default)
    .map((extra) => extra.key)
  const config = {
    projectName: `cxa-template-test-${manifest.key}`,
    template: manifest.key,
    features: manifest.defaultFeatures ?? [],
    extras,
    fileBasedExtras: extras.filter((extra) => manifest.extras
      .find((candidate) => candidate.key === extra)?.source === 'file'),
    packageManager: manifest.requiredPm ?? 'npm',
    targetDir,
  }

  for (const subPrompt of manifest.subPrompts ?? []) {
    config[subPrompt.key] = subPrompt.default
  }

  return config
}

async function collectTemplateFiles(templatePath, rootPath = templatePath) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const currentPath = join(rootPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...await collectTemplateFiles(templatePath, currentPath))
      continue
    }

    files.push(currentPath.slice(templatePath.length + 1).replaceAll('\\', '/'))
  }

  return files.sort((left, right) => left.localeCompare(right))
}

export async function templateLintCommand(options = {}) {
  try {
    const manifests = selectManifests(options.template)

    logger.success(`模板 manifest 校验通过：${manifests.length} 个`)
    logger.table(
      [
        { key: 'key', title: '模板' },
        { key: 'version', title: '版本' },
        { key: 'framework', title: '类型' },
      ],
      manifests.map((manifest) => ({
        key: manifest.key,
        version: manifest.version,
        framework: manifest.framework,
      })),
    )
  } catch (error) {
    logger.reportError('模板校验失败', error)
    process.exit(1)
  }
}

export async function templateTestCommand(options = {}) {
  const rootDir = await fs.mkdtemp(join(tmpdir(), 'cxa-template-test-'))

  try {
    const manifests = selectManifests(options.template)

    for (const manifest of manifests) {
      const targetDir = join(rootDir, manifest.key)

      await generateProject({
        config: buildAuthorTestConfig(manifest, targetDir),
        options: {
          dependencyStrategy: 'baseline',
        },
        templatePath: await resolveTemplate(manifest.key),
      })
    }

    logger.success(`模板渲染测试通过：${manifests.length} 个`)
  } catch (error) {
    logger.reportError('模板渲染测试失败', error)
    process.exit(1)
  } finally {
    await fs.remove(rootDir)
  }
}

export async function templatePackCommand(options = {}) {
  try {
    const manifests = selectManifests(options.template)
    const rows = []

    for (const manifest of manifests) {
      const templatePath = await resolveTemplate(manifest.key)
      const files = await collectTemplateFiles(templatePath)

      rows.push({
        key: manifest.key,
        version: manifest.version,
        files: files.length,
      })
    }

    logger.table(
      [
        { key: 'key', title: '模板' },
        { key: 'version', title: '版本' },
        { key: 'files', title: '文件数' },
      ],
      rows,
    )
  } catch (error) {
    logger.reportError('模板打包检查失败', error)
    process.exit(1)
  }
}
