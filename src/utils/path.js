import { relative } from 'node:path'

export function resolveDisplayPath(targetPath) {
  const relativePath = relative(process.cwd(), targetPath)

  if (!relativePath || relativePath.startsWith('..')) {
    return targetPath
  }

  return relativePath
}
