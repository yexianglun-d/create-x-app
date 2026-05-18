import fs from 'fs-extra'
import { join } from 'node:path'

function mergeDependencyFields(packageJson) {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  }
}

async function readPackageJson(projectDir) {
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJsonExists = await fs.pathExists(packageJsonPath)

  if (!packageJsonExists) {
    throw new Error('当前目录缺少 package.json，无法识别项目模板')
  }

  return fs.readJson(packageJsonPath)
}

async function hasFile(projectDir, filePath) {
  return fs.pathExists(join(projectDir, filePath))
}

async function inferTemplate(projectDir, packageJson) {
  const dependencies = mergeDependencyFields(packageJson)

  if (packageJson.workspaces || await hasFile(projectDir, 'pnpm-workspace.yaml')) {
    return 'monorepo'
  }

  if (dependencies.electron) {
    return 'electron-app'
  }

  if (dependencies['@types/chrome'] || await hasFile(projectDir, 'manifest.json')) {
    return 'chrome-ext'
  }

  if (dependencies.vant) {
    return 'mobile-h5'
  }

  if (await hasFile(projectDir, 'BACKEND.md') || await hasFile(projectDir, 'frontend/package.json')) {
    return 'java-fullstack'
  }

  if (dependencies.antd || dependencies.zustand) {
    return 'react-admin'
  }

  if (dependencies.react && dependencies.vite) {
    return 'react-vite-ts'
  }

  if (dependencies.tsx || dependencies.express) {
    return 'node-ts'
  }

  return null
}

export async function detectProject(projectDir) {
  const packageJson = await readPackageJson(projectDir)
  const templateKey = packageJson['cxa-template'] ?? await inferTemplate(projectDir, packageJson)

  return {
    packageJson,
    templateKey,
  }
}
