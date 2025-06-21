// Electron主进程API类型定义

interface PresetCommand {
  id: string
  label: string
  value: string
  isCustom?: boolean
}

interface AdbToolsAPI {
  // 获取ADB路径
  getAdbPath: () => Promise<string>
  
  // 获取应用版本
  getAppVersion: () => Promise<string>
  
  // 获取用户主目录
  getUserHomeDir: () => Promise<string>
  
  // 拼接路径
  joinPath: (...paths: string[]) => Promise<string>
  
  // 显示文件保存对话框
  showSaveDialog: (options: {
    title: string
    defaultPath: string
    filters: Array<{
      name: string
      extensions: string[]
    }>
  }) => Promise<{
    canceled: boolean
    filePath?: string
  }>
  
  // 打开新窗口
  openWin: (arg: string) => Promise<void>
  
  // 打开文件夹
  openFolder: (path: string) => Promise<void>
  
  // 执行ADB命令
  execAdbCommand: (command: string) => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  
  // 获取设备列表
  getDevices: () => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  
  // 重启ADB服务器
  restartAdbServer: () => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  
  // 获取队列状态
  getQueueStatus: () => Promise<{
    isRunning: boolean
    currentTask: string | null
    queueLength: number
  }>
  
  // 安装APK
  installApk: (fileData: Uint8Array | Buffer, fileName: string, deviceId: string, installOptions?: string) => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  
  // 获取已安装应用
  getInstalledApps: (deviceId: string) => Promise<{
    success: boolean
    data?: Array<{
      path: string
      packageName: string
      appName: string
      versionName: string
    }>
    error?: string
  }>
  
  // 卸载应用
  uninstallApp: (deviceId: string, packageName: string) => Promise<{
    success: boolean
    data?: string
    error?: string
  }>
  
  // 监听主进程消息
  onMainProcessMessage: (callback: (message: string) => void) => void
  
  // 移除监听器
  removeAllListeners: (channel: string) => void
  
  // 获取预设命令
  getPresetCommands: () => Promise<PresetCommand[]>
  
  // 保存预设命令
  savePresetCommands: (commands: PresetCommand[]) => Promise<boolean>
}

declare global {
  interface Window {
    adbToolsAPI: AdbToolsAPI
  }
}

export {} 