import fs from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function createTempDir(prefix = 'cxa-test-') {
  return fs.mkdtemp(join(tmpdir(), prefix))
}

export async function removeTempDir(targetDir) {
  await fs.remove(targetDir)
}

export function buildTestConfig(manifest, targetDir) {
  const config = {
    projectName: 'integration-test',
    template: manifest.key,
    features: manifest.defaultFeatures,
    extras: manifest.extras
      .filter((extra) => extra.default)
      .map((extra) => extra.key),
    fileBasedExtras: manifest.extras
      .filter((extra) => extra.default && extra.source === 'file')
      .map((extra) => extra.key),
    packageManager: manifest.requiredPm ?? 'npm',
    targetDir,
  }

  for (const subPrompt of manifest.subPrompts ?? []) {
    config[subPrompt.key] = subPrompt.default
  }

  return config
}
