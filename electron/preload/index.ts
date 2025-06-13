import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(c => c === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(c => c === child)) {
      return parent.removeChild(child)
    }
  },
}

// --------- ADB Tools API ---------
const adbToolsAPI = {
  // 获取ADB路径
  getAdbPath: () => ipcRenderer.invoke('get-adb-path'),
  
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  
  // 获取用户主目录
  getUserHomeDir: () => ipcRenderer.invoke('get-user-home-dir'),
  
  // 拼接路径
  joinPath: (...paths: string[]) => ipcRenderer.invoke('join-path', ...paths),
  
  // 显示文件保存对话框
  showSaveDialog: (options: {
    title: string
    defaultPath: string
    filters: Array<{
      name: string
      extensions: string[]
    }>
  }) => ipcRenderer.invoke('show-save-dialog', options),
  
  // 打开新窗口
  openWin: (arg: string) => ipcRenderer.invoke('open-win', arg),
  
  // 执行ADB命令
  execAdbCommand: (command: string) => ipcRenderer.invoke('exec-adb-command', command),
  
  // 获取设备列表
  getDevices: () => ipcRenderer.invoke('get-devices'),
  
  // 重启ADB服务器
  restartAdbServer: () => ipcRenderer.invoke('restart-adb-server'),
  
  // 获取队列状态
  getQueueStatus: () => ipcRenderer.invoke('get-queue-status'),
  
  // 安装APK
  installApk: (fileData: Uint8Array | Buffer, fileName: string, deviceId: string) => ipcRenderer.invoke('install-apk', fileData, fileName, deviceId),
  
  // 监听主进程消息
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_, message) => callback(message))
  },
  
  // 移除监听器
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

// 将API暴露给渲染进程
contextBridge.exposeInMainWorld('adbToolsAPI', {
  getAdbPath: () => ipcRenderer.invoke('get-adb-path'),
  getAppVersion: () => ipcRenderer.invoke('app-version'),
  getUserHomeDir: () => ipcRenderer.invoke('get-user-home-dir'),
  joinPath: (...paths: string[]) => ipcRenderer.invoke('join-path', ...paths),
  showSaveDialog: (options: {
    title: string
    defaultPath: string
    filters: Array<{
      name: string
      extensions: string[]
    }>
  }) => ipcRenderer.invoke('show-save-dialog', options),
  openWin: (arg: string) => ipcRenderer.invoke('open-win', arg),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  execAdbCommand: (command: string) => ipcRenderer.invoke('exec-adb-command', command),
  getDevices: () => ipcRenderer.invoke('get-devices'),
  restartAdbServer: () => ipcRenderer.invoke('restart-adb-server'),
  getQueueStatus: () => ipcRenderer.invoke('get-queue-status'),
  installApk: (fileData: Uint8Array | Buffer, fileName: string, deviceId: string) => 
    ipcRenderer.invoke('install-apk', fileData, fileName, deviceId),
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_, message) => callback(message))
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  }
})

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { 
    transform: perspective(100px) rotateX(180deg) rotateY(0); 
  }
  50% { 
    transform: perspective(100px) rotateX(180deg) rotateY(180deg); 
  }
  75% { 
    transform: perspective(100px) rotateX(0) rotateY(180deg); 
  }
  100% { 
    transform: perspective(100px) rotateX(0) rotateY(0); 
  }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ------------------ Loading ------------------
const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999) 