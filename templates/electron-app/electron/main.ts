import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerIpcHandlers } from './ipc/handlers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEV_SERVER_URL = 'http://localhost:5173'

/**
 * 创建主窗口并按环境选择加载开发服务或打包后的静态页面。
 *
 * 说明：
 * 1. 开发期统一指向本地 Vite 服务，保持前端调试体验
 * 2. 打包后从 dist 目录加载静态文件，保证发布产物不依赖额外服务进程
 */
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#f5f7fb',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (app.isPackaged) {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'))
    return
  }

  void mainWindow.loadURL(process.env.CXA_RENDERER_URL ?? DEV_SERVER_URL)
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
