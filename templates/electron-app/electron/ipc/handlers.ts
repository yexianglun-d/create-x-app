import { ipcMain } from 'electron'
import os from 'node:os'

const GET_SYSTEM_INFO_CHANNEL = 'get-system-info'

/**
 * 统一注册主进程对外暴露的 IPC 能力。
 *
 * 说明：
 * 1. 在一个入口集中注册，避免窗口创建逻辑和通道定义相互耦合
 * 2. 先 removeHandler 再 handle，确保开发期重复初始化时不会抛出重复注册错误
 */
export function registerIpcHandlers() {
  ipcMain.removeHandler(GET_SYSTEM_INFO_CHANNEL)
  ipcMain.handle(GET_SYSTEM_INFO_CHANNEL, async () => ({
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    release: os.release(),
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
  }))
}
