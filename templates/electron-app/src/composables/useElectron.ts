export interface SystemInfo {
  platform: string
  arch: string
  hostname: string
  release: string
  nodeVersion: string
  electronVersion: string
  chromeVersion: string
}

/**
 * 统一收口渲染进程访问 preload API 的入口，避免页面直接依赖全局对象细节。
 */
export function useElectron() {
  return {
    async getSystemInfo() {
      if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron preload API 未注入，请确认应用运行在 Electron 环境中')
      }

      return window.electronAPI.getSystemInfo()
    },
  }
}
