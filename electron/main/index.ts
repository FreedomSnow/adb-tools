import { app, BrowserWindow, shell, ipcMain, Menu, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { spawn, exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'fs/promises'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execAsync = promisify(exec)

// The built directory structure
//
// ├─┬ dist
// │ ├─┬ electron
// │ │ ├─┬ main
// │ │ │ └── index.js    > Electron-Main
// │ │ └─┬ preload
// │ │   └── index.js    > Preload-Scripts
// │ ├─┬ static
// │ │ └── icon.png
// │ └─┬ renderer
//   └── index.html      > Electron-Renderer

process.env.DIST_ELECTRON = path.join(__dirname, '../')
process.env.DIST = path.join(process.env.DIST_ELECTRON, '../')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.DIST, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Install "react developer tools"
let win: BrowserWindow | null = null
// Here, you can also use other preload
const preload = path.join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
// 修复生产环境下的HTML文件路径
const indexHtml = path.join(process.env.DIST, 'renderer/index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'ADB Tools - Android调试工具',
    icon: process.env.VITE_PUBLIC ? path.join(process.env.VITE_PUBLIC, 'logo.png') : undefined,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  console.log('Environment variables:')
  console.log('VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL)
  console.log('DIST:', process.env.DIST)
  console.log('Index HTML path:', indexHtml)
  console.log('App is packaged:', app.isPackaged)

  if (url) { // electron-vite-vue#298
    console.log('Loading development URL:', url)
    win.loadURL(url)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    console.log('Loading production HTML file:', indexHtml)
    // 检查文件是否存在
    const fs = require('fs')
    if (fs.existsSync(indexHtml)) {
      console.log('HTML file exists, loading...')
      win.loadFile(indexHtml)
    } else {
      console.error('HTML file does not exist at:', indexHtml)
      // 尝试其他可能的路径
      const alternativePath = path.join(__dirname, '../renderer/index.html')
      console.log('Trying alternative path:', alternativePath)
      if (fs.existsSync(alternativePath)) {
        console.log('Alternative path exists, loading...')
        win.loadFile(alternativePath)
      } else {
        console.error('Alternative path also does not exist')
      }
    }
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    console.log('Window finished loading')
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // 添加加载失败处理
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Failed to load:', {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    })
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  // win.webContents.on('will-navigate', (event, navigationUrl) => { })
}

app.whenReady().then(() => {
  createWindow()
  
  // 设置应用菜单
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重新载入',
          accelerator: 'F5',
          click: () => {
            win?.webContents.reload()
          }
        },
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'F12',
          click: () => {
            win?.webContents.toggleDevTools()
          }
        }
      ]
    }
  ]
  
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// 打开文件夹
ipcMain.handle('open-folder', async (_, path: string) => {
  try {
    await shell.openPath(path)
    return { success: true }
  } catch (error) {
    console.error('打开文件夹失败:', error)
    return { success: false, error: error.message }
  }
})

// ADB命令队列管理，防止过多并发导致系统卡顿
class ADBCommandQueue {
  private queue: Array<() => Promise<any>> = []
  private running = false
  private concurrency = 0
  private maxConcurrency: number
  private name: string

  constructor(name: string, maxConcurrency: number = 3) {
    this.name = name
    this.maxConcurrency = maxConcurrency
  }

  async add<T>(command: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          console.log(`[${this.name}队列] 开始执行命令，当前并发: ${this.concurrency}/${this.maxConcurrency}`)
          const result = await command()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      console.log(`[${this.name}队列] 添加任务，队列长度: ${this.queue.length}`)
      this.process()
    })
  }

  private async process() {
    if (this.running || this.concurrency >= this.maxConcurrency) {
      return
    }
    
    if (this.queue.length === 0) {
      return
    }

    this.running = true
    
    // 启动所有可能的并发任务
    while (this.queue.length > 0 && this.concurrency < this.maxConcurrency) {
      const command = this.queue.shift()
      if (command) {
        this.concurrency++
        console.log(`[${this.name}队列] 启动任务，当前并发: ${this.concurrency}/${this.maxConcurrency}，剩余队列: ${this.queue.length}`)
        
        // 异步执行命令，不阻塞其他命令的启动
        command().finally(() => {
          this.concurrency--
          console.log(`[${this.name}队列] 任务完成，当前并发: ${this.concurrency}/${this.maxConcurrency}，剩余队列: ${this.queue.length}`)
          
          // 如果还有任务且有空闲槽位，继续处理
          if (this.queue.length > 0 && this.concurrency < this.maxConcurrency) {
            setTimeout(() => {
              this.running = false
              this.process()
            }, 10)
          } else if (this.concurrency === 0) {
            this.running = false
          }
        })
      }
    }
    
    // 如果没有启动任何任务，重置running状态
    if (this.concurrency === 0) {
      this.running = false
    }
  }

  // 获取队列状态
  getStatus() {
    return {
      name: this.name,
      queueLength: this.queue.length,
      concurrency: this.concurrency,
      maxConcurrency: this.maxConcurrency
    }
  }
}

// 创建不同优先级的队列
const fastQueue = new ADBCommandQueue('快速', 2)      // 设备管理、连接等核心功能
const normalQueue = new ADBCommandQueue('普通', 2)    // 日志查看、单个命令等
const bulkQueue = new ADBCommandQueue('批量', 4)      // 应用管理、文件管理等批量操作

// 根据命令类型选择合适的队列
function selectQueue(command: string): ADBCommandQueue {
  // 快速队列 - 优先级最高的核心功能
  if (command.includes('devices') || 
      command.includes('connect') || 
      command.includes('disconnect') ||
      command.includes('tcpip') ||
      command.includes('getprop ro.build.version') ||
      command.includes('getprop ro.product.manufacturer') ||
      command.includes('getprop ro.build.version.sdk')) {
    return fastQueue
  }
  
  // 批量队列 - 可能产生大量命令的操作（文件管理和应用管理）
  if (command.includes('shell ls') ||
      command.includes('shell pm list') ||
      command.includes('shell pm path') ||
      command.includes('shell pm dump') ||
      command.includes('shell dumpsys package') ||
      command.includes('shell stat') ||
      command.includes('shell find') ||
      command.includes('shell du') ||
      command.includes('push') ||
      command.includes('pull') ||
      // 应用管理相关的包查询命令
      command.match(/shell pm path com\./)) {
    return bulkQueue
  }
  
  // 普通队列 - 默认队列（单个命令、logcat等）
  return normalQueue
}

// IPC handlers for ADB operations
ipcMain.handle('get-adb-path', () => {
  // 获取打包后的ADB路径
  const adbPath = app.isPackaged
    ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
  
  return adbPath
})

// 执行ADB命令
ipcMain.handle('exec-adb-command', async (_, command: string) => {
  // 根据命令类型选择合适的队列
  const selectedQueue = selectQueue(command)
  console.log(`命令 "${command}" 被分配到 ${selectedQueue.getStatus().name} 队列`)
  
  return selectedQueue.add(async () => {
    try {
      const adbPath = app.isPackaged
        ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
        : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      
      // 处理命令：如果命令以 "adb" 开头，去掉 "adb" 前缀
      let processedCommand = command.trim()
      if (processedCommand.startsWith('adb ')) {
        processedCommand = processedCommand.substring(4) // 去掉 "adb " 前缀
      } else if (processedCommand === 'adb') {
        processedCommand = '' // 如果只是 "adb"，则清空命令
      }
      
      const fullCommand = processedCommand 
        ? `"${adbPath}" ${processedCommand}`
        : `"${adbPath}"`
      
      console.log('执行命令:', fullCommand)
      
      const { stdout, stderr } = await execAsync(fullCommand, { 
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      })
    
    // 改进错误检测逻辑
    const isShellCommand = command.includes('shell')
    const isMonkeyCommand = command.includes('monkey')
    
    // 对于shell命令，特别是monkey命令，需要更宽松的错误检测
    if (stderr) {
      // 忽略常见的警告和调试信息
      const ignorablePatterns = [
        'Warning',
        'args:',
        'arg:',
        'data=',
        'Events injected:',
        'Network speed:',
        'Dropped:'
      ]
      
      const shouldIgnoreStderr = ignorablePatterns.some(pattern => 
        stderr.includes(pattern)
      )
      
      // 对于monkey命令，如果stderr包含调试信息但没有明确错误，认为成功
      if (isMonkeyCommand && shouldIgnoreStderr && !stderr.includes('Error:') && !stderr.includes('CRASH')) {
        console.log('Monkey命令输出调试信息，但执行成功')
        return { success: true, data: stdout.trim() || 'Command executed successfully' }
      }
      
      // 对于其他shell命令，只有明确的错误才认为失败
      if (isShellCommand && shouldIgnoreStderr) {
        return { success: true, data: stdout.trim() }
      }
      
      // 如果是真正的错误
      if (!shouldIgnoreStderr) {
        throw new Error(stderr)
      }
    }
    
      return { success: true, data: stdout.trim() }
    } catch (error: any) {
      console.error('ADB命令执行失败:', error)
      return { success: false, error: error.message }
    }
  })
})

// 重启ADB服务器
ipcMain.handle('restart-adb-server', async () => {
  try {
    const adbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    
    console.log('正在重启ADB服务器...')
    
    // 先停止ADB服务器
    try {
      const killCommand = `"${adbPath}" kill-server`
      console.log('停止ADB服务器:', killCommand)
      await execAsync(killCommand, { timeout: 5000 })
      console.log('ADB服务器已停止')
    } catch (error) {
      console.log('停止ADB服务器时出现错误（可能服务器已经停止）:', error)
    }
    
    // 等待一秒钟确保服务器完全停止
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 启动ADB服务器
    const startCommand = `"${adbPath}" start-server`
    console.log('启动ADB服务器:', startCommand)
    const { stdout, stderr } = await execAsync(startCommand, { 
      timeout: 10000,
      maxBuffer: 1024 * 1024
    })
    
    console.log('ADB服务器启动结果 - stdout:', stdout)
    console.log('ADB服务器启动结果 - stderr:', stderr)
    
    return { success: true, data: 'ADB服务器重启成功' }
  } catch (error: any) {
    console.error('重启ADB服务器失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取设备列表 - 使用快速队列避免被批量操作阻塞
ipcMain.handle('get-devices', async () => {
  // 使用快速队列，确保设备列表获取不会被批量操作阻塞
  console.log('设备列表获取使用快速队列')
  return fastQueue.add(async () => {
    try {
      const adbPath = app.isPackaged
        ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
        : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      
      const fullCommand = `"${adbPath}" devices -l`
      console.log('执行命令:', fullCommand)
      
      const { stdout, stderr } = await execAsync(fullCommand, { 
        timeout: 10000,
        maxBuffer: 1024 * 1024
      })
      
      // 检查是否有端口占用或ADB服务器启动问题
      if (stderr) {
        if (stderr.includes('Address already in use') || 
            stderr.includes('failed to start daemon') ||
            stderr.includes('cannot connect to daemon')) {
          
          console.log('检测到ADB服务器问题，尝试重启...')
          
          // 尝试重启ADB服务器
          try {
            await execAsync(`"${adbPath}" kill-server`, { timeout: 5000 })
            await new Promise(resolve => setTimeout(resolve, 1000))
            await execAsync(`"${adbPath}" start-server`, { timeout: 10000 })
            
            // 重新尝试获取设备列表
            const retryResult = await execAsync(fullCommand, { 
              timeout: 10000,
              maxBuffer: 1024 * 1024
            })
            
            return { success: true, data: retryResult.stdout.trim() }
          } catch (retryError: any) {
            throw new Error(`ADB服务器重启失败: ${retryError.message}`)
          }
        } else if (!stderr.includes('Warning') && !stderr.includes('daemon started successfully')) {
          throw new Error(stderr)
        }
      }
      
      return { success: true, data: stdout.trim() }
    } catch (error: any) {
      console.error('ADB命令执行失败:', error)
      return { success: false, error: error.message }
    }
  })
})

// Security: prevent new window creation
ipcMain.handle('app-version', () => {
  return app.getVersion()
})

// 获取队列状态
ipcMain.handle('get-queue-status', () => {
  return {
    fast: fastQueue.getStatus(),
    normal: normalQueue.getStatus(),
    bulk: bulkQueue.getStatus()
  }
})

// 安装APK
ipcMain.handle('install-apk', async (_, fileData: Buffer | Uint8Array, fileName: string, deviceId: string, installOptions?: string) => {
  try {
    const adbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    
    // 在主进程中创建临时文件
    const fs = require('fs')
    const os = require('os')
    const tempDir = os.tmpdir()
    const tempPath = path.join(tempDir, fileName)
    
    // 确保数据是Buffer格式
    const fileBuffer = fileData instanceof Buffer ? fileData : Buffer.from(fileData)
    
    // 写入文件
    fs.writeFileSync(tempPath, fileBuffer)
    
    console.log('临时文件创建成功:', tempPath)
    
    // 将APK文件推送到设备
    const devicePath = `/data/local/tmp/temp_install.apk`
    const pushCommand = `"${adbPath}" -s ${deviceId} push "${tempPath}" "${devicePath}"`
    
    console.log('推送APK到设备:', pushCommand)
    
    const pushResult = await execAsync(pushCommand)
    console.log('推送结果:', pushResult)
    
    // 安装APK，添加安装参数
    const installCommand = `"${adbPath}" -s ${deviceId} shell pm install ${installOptions || ''} "${devicePath}"`
    
    console.log('安装APK命令:', installCommand)
    
    const installResult = await execAsync(installCommand)
    console.log('安装结果:', installResult)
    
    // 清理临时文件
    try {
      fs.unlinkSync(tempPath)
      console.log('本地临时文件已清理')
    } catch (error) {
      console.log('清理本地临时文件失败:', error)
    }
    
    // 清理设备上的临时文件
    const cleanupCommand = `"${adbPath}" -s ${deviceId} shell rm "${devicePath}"`
    try {
      await execAsync(cleanupCommand)
    } catch (err) {
      console.log('清理设备临时文件失败:', err)
    }
    
    return {
      success: true,
      data: installResult.stdout || installResult.stderr || '安装完成'
    }
  } catch (error: any) {
    console.error('APK安装失败:', error)
    return {
      success: false,
      error: error.message || '安装失败'
    }
  }
})

// 获取已安装的应用列表
ipcMain.handle('get-installed-apps', async (_, deviceId: string) => {
  try {
    const adbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    
    const command = `"${adbPath}" -s ${deviceId} shell pm list packages -f`
    const { stdout } = await execAsync(command)
    
    // 解析输出
    const apps = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const match = line.match(/package:(.*?)=(.*)/)
        if (match) {
          const [, path, packageName] = match
          return {
            path,
            packageName
          }
        }
        return null
      })
      .filter(app => app !== null)
    
    return {
      success: true,
      data: apps
    }
  } catch (error: any) {
    console.error('获取应用列表失败:', error)
    return {
      success: false,
      error: error.message || '获取应用列表失败'
    }
  }
})

// 卸载应用
ipcMain.handle('uninstall-app', async (_, deviceId: string, packageName: string) => {
  try {
    const adbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    
    const command = `"${adbPath}" -s ${deviceId} shell pm uninstall ${packageName}`
    console.log('卸载应用命令:', command)
    
    const { stdout, stderr } = await execAsync(command, { timeout: 30000 })
    
    // 检查卸载结果
    if (stdout.includes('Success') || stdout.includes('success')) {
      return {
        success: true,
        data: '应用卸载成功'
      }
    } else if (stderr && stderr.includes('Failure')) {
      throw new Error(stderr)
    } else {
      // 如果没有明确的成功或失败信息，检查应用是否还存在
      const checkCommand = `"${adbPath}" -s ${deviceId} shell pm list packages ${packageName}`
      const checkResult = await execAsync(checkCommand)
      
      if (checkResult.stdout.includes(packageName)) {
        throw new Error('应用卸载失败，应用仍然存在')
      } else {
        return {
          success: true,
          data: '应用卸载成功'
        }
      }
    }
  } catch (error: any) {
    console.error('卸载应用失败:', error)
    return {
      success: false,
      error: error.message || '卸载应用失败'
    }
  }
})

// 获取用户主目录
ipcMain.handle('get-user-home-dir', () => {
  return app.getPath('home')
})

// 拼接路径
ipcMain.handle('join-path', (_, ...paths: string[]) => {
  return path.join(...paths)
})

// 显示文件保存对话框
ipcMain.handle('show-save-dialog', (_, options: {
  title: string
  defaultPath: string
  filters: Array<{
    name: string
    extensions: string[]
  }>
}) => {
  return dialog.showSaveDialog(options)
})

// 预设命令文件路径
const getPresetCommandsPath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'preset-commands.json')
}

// 默认预设命令
const defaultPresetCommands = [
  { id: '1', label: '获取设备信息', value: 'adb shell getprop' },
  { id: '2', label: '查看已安装应用', value: 'adb shell pm list packages' },
  { id: '3', label: '查看设备型号', value: 'adb shell getprop ro.product.model' },
  { id: '4', label: '查看Android版本', value: 'adb shell getprop ro.build.version.release' },
  { id: '5', label: '查看屏幕分辨率', value: 'adb shell wm size' },
  { id: '6', label: '查看屏幕密度', value: 'adb shell wm density' },
  { id: '7', label: '查看电池信息', value: 'adb shell dumpsys battery' },
  { id: '8', label: '查看内存信息', value: 'adb shell cat /proc/meminfo' },
  { id: '9', label: '查看CPU信息', value: 'adb shell cat /proc/cpuinfo' },
  { id: '10', label: '重启设备', value: 'adb reboot' },
  { id: '11', label: '进入恢复模式', value: 'adb reboot recovery' },
  { id: '12', label: '进入下载模式', value: 'adb reboot download' }
]

// 读取预设命令
ipcMain.handle('get-preset-commands', async () => {
  try {
    const filePath = getPresetCommandsPath()
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data)
    } catch (error) {
      // 如果文件不存在或读取失败，写入默认命令并返回
      await fs.writeFile(filePath, JSON.stringify(defaultPresetCommands, null, 2))
      return defaultPresetCommands
    }
  } catch (error) {
    console.error('读取预设命令失败:', error)
    return defaultPresetCommands
  }
})

// 保存预设命令
ipcMain.handle('save-preset-commands', async (_, commands) => {
  try {
    const filePath = getPresetCommandsPath()
    await fs.writeFile(filePath, JSON.stringify(commands, null, 2))
    return true
  } catch (error) {
    console.error('保存预设命令失败:', error)
    return false
  }
})

// 录屏进程管理
let screenRecordProcess: any = null
let currentRecordingDevice: string | null = null

// 启动录屏
ipcMain.handle('start-screen-record', async (_, deviceId: string, fileName: string) => {
  try {
    const adbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
      : path.join(__dirname, '../../resources/adb', process.platform === 'win32' ? 'adb.exe' : 'adb')
    
    // 如果已有录屏进程在运行，先停止
    if (screenRecordProcess) {
      screenRecordProcess.kill('SIGINT')
      screenRecordProcess = null
    }
    
    // 启动录屏进程
    const command = `${adbPath} -s ${deviceId} shell screenrecord /sdcard/${fileName}`
    console.log('启动录屏命令:', command)
    
    screenRecordProcess = spawn(command, [], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    currentRecordingDevice = deviceId
    
    // 监听进程输出
    screenRecordProcess.stdout?.on('data', (data: Buffer) => {
      console.log('录屏输出:', data.toString())
    })
    
    screenRecordProcess.stderr?.on('data', (data: Buffer) => {
      console.log('录屏错误:', data.toString())
    })
    
    // 监听进程退出
    screenRecordProcess.on('close', (code: number) => {
      console.log('录屏进程退出，代码:', code)
      screenRecordProcess = null
      currentRecordingDevice = null
    })
    
    screenRecordProcess.on('error', (error: Error) => {
      console.error('录屏进程错误:', error)
      screenRecordProcess = null
      currentRecordingDevice = null
    })
    
    return { success: true, data: '录屏已启动' }
  } catch (error: any) {
    console.error('启动录屏失败:', error)
    return { success: false, error: error.message }
  }
})

// 停止录屏
ipcMain.handle('stop-screen-record', async (_, deviceId: string, fileName: string) => {
  try {
    if (!screenRecordProcess || currentRecordingDevice !== deviceId) {
      return { success: false, error: '没有找到对应的录屏进程' }
    }
    
    console.log('停止录屏进程...')
    
    // 发送 SIGINT 信号（相当于 Ctrl+C）
    screenRecordProcess.kill('SIGINT')
    
    // 等待进程完全退出
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('录屏进程停止超时，强制终止')
        screenRecordProcess?.kill('SIGKILL')
        resolve()
      }, 3000)
      
      screenRecordProcess.on('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
    
    screenRecordProcess = null
    currentRecordingDevice = null
    
    // 等待文件写入完成
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return { success: true, data: '录屏已停止' }
  } catch (error: any) {
    console.error('停止录屏失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取录屏状态
ipcMain.handle('get-screen-record-status', () => {
  return {
    isRecording: screenRecordProcess !== null,
    deviceId: currentRecordingDevice
  }
}) 