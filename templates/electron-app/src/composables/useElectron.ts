export interface BatchItem {
  id: string
  fileName: string
  filePath: string
  status: 'queued' | 'processing' | 'done'
  note: string
}

function getElectronAPI() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('桌面能力未注入，请确认应用运行在 Electron 环境中')
  }

  return window.electronAPI
}

/**
 * 统一收口渲染进程访问 preload API 的入口，页面只关心业务动作。
 */
export function useElectron() {
  return {
    selectFiles() {
      return getElectronAPI().selectFiles()
    },
    readBatchItems() {
      return getElectronAPI().readBatchItems()
    },
    saveBatchItems(items: BatchItem[]) {
      return getElectronAPI().saveBatchItems(items)
    },
  }
}
