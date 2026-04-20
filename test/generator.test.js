import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs-extra'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateProject } from '../src/generator/index.js'
import { resolveTemplate } from '../src/steps/resolver.js'

async function createTempProjectDir(prefix) {
  return fs.mkdtemp(join(tmpdir(), prefix))
}

test('generateProject 会复制模板、渲染 EJS 并重命名点文件', async (t) => {
  const targetDir = await createTempProjectDir('create-x-app-generator-')

  t.after(async () => {
    await fs.remove(targetDir)
  })

  await generateProject({
    config: {
      projectName: 'demo-app',
      template: 'react-vite-ts',
      features: ['eslint', 'prettier', 'husky', 'agents', 'coding-rules'],
      extras: [],
      packageManager: 'npm',
      targetDir,
    },
    templatePath: resolveTemplate('react-vite-ts'),
  })

  assert.equal(await fs.pathExists(join(targetDir, '.gitignore')), true)
  assert.equal(await fs.pathExists(join(targetDir, '_gitignore')), false)
  assert.equal(await fs.pathExists(join(targetDir, 'AGENTS.md')), true)
  assert.equal(await fs.pathExists(join(targetDir, 'coding-rules.md')), true)

  const readmeContent = await fs.readFile(join(targetDir, 'README.md'), 'utf8')
  const agentsContent = await fs.readFile(join(targetDir, 'AGENTS.md'), 'utf8')

  assert.match(readmeContent, /demo-app/)
  assert.match(agentsContent, /demo-app/)
})

test('generateProject 会移除未勾选功能对应的文件', async (t) => {
  const targetDir = await createTempProjectDir('create-x-app-prune-')

  t.after(async () => {
    await fs.remove(targetDir)
  })

  await generateProject({
    config: {
      projectName: 'lite-app',
      template: 'node-ts',
      features: [],
      extras: [],
      packageManager: 'npm',
      targetDir,
    },
    templatePath: resolveTemplate('node-ts'),
  })

  assert.equal(await fs.pathExists(join(targetDir, '.eslintrc.json')), false)
  assert.equal(await fs.pathExists(join(targetDir, '.prettierrc')), false)
  assert.equal(await fs.pathExists(join(targetDir, '.husky')), false)
  assert.equal(await fs.pathExists(join(targetDir, 'AGENTS.md')), false)
  assert.equal(await fs.pathExists(join(targetDir, 'coding-rules.md')), false)
})
