import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemInfo() {
    return ipcRenderer.invoke('get-system-info') as Promise<{
      platform: string
      arch: string
      hostname: string
      release: string
      nodeVersion: string
      electronVersion: string
      chromeVersion: string
    }>
  },
})
