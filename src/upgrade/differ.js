import fs from 'fs-extra'
import { basename, join, relative } from 'node:path'

const CONFIG_FILE_NAMES = new Set([
  'tsconfig.json',
  'tsconfig.node.json',
  '.eslintrc.json',
  'vite.config.ts',
  '.prettierrc',
  'commitlint.config.js',
])

async function collectConfigFiles(rootDir, currentDir = rootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const configFiles = []

  for (const entry of entries) {
    const currentPath = join(currentDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue
      }

      configFiles.push(...await collectConfigFiles(rootDir, currentPath))
      continue
    }

    if (CONFIG_FILE_NAMES.has(basename(entry.name))) {
      configFiles.push(relative(rootDir, currentPath))
    }
  }

  return configFiles
}

function normalizeContent(content) {
  return content.replace(/\r\n/g, '\n').trimEnd()
}

function buildDiffOperations(currentLines, expectedLines) {
  const dp = Array.from({ length: currentLines.length + 1 }, () => Array(expectedLines.length + 1).fill(0))

  for (let i = currentLines.length - 1; i >= 0; i -= 1) {
    for (let j = expectedLines.length - 1; j >= 0; j -= 1) {
      if (currentLines[i] === expectedLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const operations = []
  let currentIndex = 0
  let expectedIndex = 0

  while (currentIndex < currentLines.length && expectedIndex < expectedLines.length) {
    if (currentLines[currentIndex] === expectedLines[expectedIndex]) {
      operations.push({ type: 'equal', line: currentLines[currentIndex] })
      currentIndex += 1
      expectedIndex += 1
    } else if (dp[currentIndex + 1][expectedIndex] >= dp[currentIndex][expectedIndex + 1]) {
      operations.push({ type: 'remove', line: currentLines[currentIndex] })
      currentIndex += 1
    } else {
      operations.push({ type: 'add', line: expectedLines[expectedIndex] })
      expectedIndex += 1
    }
  }

  while (currentIndex < currentLines.length) {
    operations.push({ type: 'remove', line: currentLines[currentIndex] })
    currentIndex += 1
  }

  while (expectedIndex < expectedLines.length) {
    operations.push({ type: 'add', line: expectedLines[expectedIndex] })
    expectedIndex += 1
  }

  return operations
}

export function createTextDiff(currentContent, expectedContent) {
  const currentLines = normalizeContent(currentContent).split('\n')
  const expectedLines = normalizeContent(expectedContent).split('\n')

  return buildDiffOperations(currentLines, expectedLines)
}

export async function diffConfigFiles(currentDir, expectedDir) {
  const expectedConfigFiles = await collectConfigFiles(expectedDir)
  const diffs = []

  for (const relativePath of expectedConfigFiles) {
    const currentPath = join(currentDir, relativePath)
    const expectedPath = join(expectedDir, relativePath)
    const currentExists = await fs.pathExists(currentPath)
    const currentContent = currentExists ? await fs.readFile(currentPath, 'utf8') : ''
    const expectedContent = await fs.readFile(expectedPath, 'utf8')

    if (normalizeContent(currentContent) === normalizeContent(expectedContent)) {
      continue
    }

    diffs.push({
      relativePath,
      currentPath,
      expectedPath,
      currentContent,
      expectedContent,
      operations: createTextDiff(currentContent, expectedContent),
      status: currentExists ? 'modified' : 'missing',
    })
  }

  return diffs
}
