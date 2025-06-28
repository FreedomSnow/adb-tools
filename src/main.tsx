import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

// 移除加载动画
postMessage({ payload: 'removeLoading' }, '*')

// 监听主进程日志，在开发者工具Console中显示
if (window.adbToolsAPI) {
  window.adbToolsAPI.onMainProcessLog((logData: any) => {
    const { type, message, args, timestamp } = logData
    const prefix = `[主进程 ${timestamp}]`
    
    if (type === 'error') {
      console.error(prefix, message, ...args)
    } else {
      console.log(prefix, message, ...args)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
) 