import { app, dialog, ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const SELECT_FILES_CHANNEL = 'workspace:select-files'
const READ_ITEMS_CHANNEL = 'workspace:read-items'
const SAVE_ITEMS_CHANNEL = 'workspace:save-items'

export interface BatchItem {
  id: string
  fileName: string
  filePath: string
  status: 'queued' | 'processing' | 'done'
  note: string
}

function getStorePath() {
  return join(app.getPath('userData'), 'batch-workspace.json')
}

function isBatchItem(value: unknown): value is BatchItem {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return typeof candidate.id === 'string'
    && typeof candidate.fileName === 'string'
    && typeof candidate.filePath === 'string'
    && ['queued', 'processing', 'done'].includes(String(candidate.status))
    && typeof candidate.note === 'string'
}

async function readSavedItems() {
  try {
    const rawContent = await readFile(getStorePath(), 'utf8')
    const parsedContent = JSON.parse(rawContent) as unknown

    return Array.isArray(parsedContent) ? parsedContent.filter(isBatchItem) : []
  } catch {
    return []
  }
}

async function saveItems(items: BatchItem[]) {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(getStorePath(), `${JSON.stringify(items, null, 2)}\n`, 'utf8')
  return items
}

/**
 * 渲染进程只拿到经过 preload 暴露的工作台能力，主进程集中处理文件选择和本地持久化。
 */
export function registerIpcHandlers() {
  ipcMain.removeHandler(SELECT_FILES_CHANNEL)
  ipcMain.removeHandler(READ_ITEMS_CHANNEL)
  ipcMain.removeHandler(SAVE_ITEMS_CHANNEL)

  ipcMain.handle(SELECT_FILES_CHANNEL, async () => {
    const result = await dialog.showOpenDialog({
      title: '选择待处理文件',
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled) {
      return []
    }

    return result.filePaths.map((filePath): BatchItem => ({
      id: `${Date.now()}-${filePath}`,
      fileName: basename(filePath),
      filePath,
      status: 'queued',
      note: '等待处理',
    }))
  })

  ipcMain.handle(READ_ITEMS_CHANNEL, async () => readSavedItems())

  ipcMain.handle(SAVE_ITEMS_CHANNEL, async (_event, items: BatchItem[]) => {
    return saveItems(items.filter(isBatchItem))
  })
}
