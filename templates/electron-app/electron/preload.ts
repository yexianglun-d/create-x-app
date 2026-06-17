import { contextBridge, ipcRenderer } from 'electron'
import type { BatchItem } from './ipc/handlers.js'

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles() {
    return ipcRenderer.invoke('workspace:select-files') as Promise<BatchItem[]>
  },
  readBatchItems() {
    return ipcRenderer.invoke('workspace:read-items') as Promise<BatchItem[]>
  },
  saveBatchItems(items: BatchItem[]) {
    return ipcRenderer.invoke('workspace:save-items', items) as Promise<BatchItem[]>
  },
})
