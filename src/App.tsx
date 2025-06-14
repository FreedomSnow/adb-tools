import React, { useState, useEffect } from 'react'
import { Layout, Menu, Typography, Button, Space, notification } from 'antd'
import { 
  MobileOutlined, 
  FileTextOutlined, 
  AppstoreOutlined, 
  FolderOutlined,
  MonitorOutlined,
  CodeOutlined,
  SettingOutlined,
  CameraOutlined,
  VideoCameraOutlined,
  BugOutlined
} from '@ant-design/icons'
import { DeviceProvider } from './contexts/DeviceContext'
import DeviceManager from './components/DeviceManager'
import LogcatViewer from './components/LogcatViewer'
import AppManager from './components/AppManager'
import FileManager from './components/FileManager'
import SystemInfo from './components/SystemInfo'
import CommandExecutor from './components/CommandExecutor'
import QuickActions from './components/QuickActions'
import ScreenCapture from './components/ScreenCapture'
import QueueMonitor from './components/QueueMonitor'
import InstallApk from './components/InstallApk'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
// 导入类型声明
import './types/electron.d.ts'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type MenuItem = {
  key: string
  icon: React.ReactNode
  label: string
  component: React.ComponentType
}

const menuItems: MenuItem[] = [
  {
    key: 'devices',
    icon: <MobileOutlined />,
    label: '设备管理',
    component: DeviceManager
  },
  {
    key: 'apps',
    icon: <AppstoreOutlined />,
    label: '应用管理',
    component: AppManager
  },
  {
    key: 'commands',
    icon: <CodeOutlined />,
    label: '命令执行',
    component: CommandExecutor
  },
  {
    key: 'screen',
    icon: <CameraOutlined />,
    label: '屏幕截图',
    component: ScreenCapture
  },
  // {
  //   key: 'quick',
  //   icon: <SettingOutlined />,
  //   label: '快捷操作',
  //   component: QuickActions
  // },
  // {
  //   key: 'system',
  //   icon: <MonitorOutlined />,
  //   label: '系统信息',
  //   component: SystemInfo
  // },
  // {
  //   key: 'files',
  //   icon: <FolderOutlined />,
  //   label: '文件管理',
  //   component: FileManager
  // },
  // {
  //   key: 'logcat',
  //   icon: <FileTextOutlined />,
  //   label: 'Logcat查看',
  //   component: LogcatViewer
  // },
]

const App: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('devices')
  const [appVersion, setAppVersion] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    // 获取应用版本
    window.adbToolsAPI?.getAppVersion().then(version => {
      setAppVersion(version)
    }).catch(err => {
      console.error('获取应用版本失败:', err)
    })

    // 监听主进程消息
    window.adbToolsAPI?.onMainProcessMessage((message) => {
      console.log('收到主进程消息:', message)
    })

    return () => {
      window.adbToolsAPI?.removeAllListeners('main-process-message')
    }
  }, [])

  const handleMenuClick = (key: string) => {
    setSelectedKey(key)
  }

  const currentMenuItem = menuItems.find(item => item.key === selectedKey)
  const CurrentComponent = currentMenuItem?.component || DeviceManager

  return (
    <Router>
      <DeviceProvider>
        <Routes>
          <Route path="/" element={
            <div className="app-container">
              <Layout style={{ height: '100vh' }}>
                <Header className="header" style={{ 
                  background: '#fff', 
                  padding: '0 24px', 
                  borderBottom: '1px solid #d9d9d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <BugOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '12px' }} />
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                      ADB Tools
                    </Title>
                    <span style={{ marginLeft: '16px', color: '#666', fontSize: '14px' }}>
                      Android调试工具集成平台
                    </span>
                  </div>
                  <Space>
                    <QueueMonitor />
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      版本: {appVersion || '1.0.0'}
                    </span>
                  </Space>
                </Header>
                
                <Layout>
                  <Sider 
                    className="sidebar"
                    collapsible 
                    collapsed={collapsed} 
                    onCollapse={setCollapsed}
                    theme="light"
                    width={250}
                  >
                    <Menu
                      mode="inline"
                      selectedKeys={[selectedKey]}
                      style={{ height: '100%', borderRight: 0 }}
                      items={menuItems.map(item => ({
                        key: item.key,
                        icon: item.icon,
                        label: item.label,
                        onClick: () => handleMenuClick(item.key)
                      }))}
                    />
                  </Sider>
                  
                  <Content 
                    className="main-content" 
                    style={{ 
                      padding: '24px', 
                      background: '#fff',
                      overflow: 'auto',
                      height: 'calc(100vh - 64px)' // 减去header高度
                    }}
                  >
                    <CurrentComponent />
                  </Content>
                </Layout>
              </Layout>
            </div>
          } />
          <Route path="/install-apk" element={
            <div className="app-container">
              <Layout style={{ height: '100vh' }}>
                <Header className="header" style={{ 
                  background: '#fff', 
                  padding: '0 24px', 
                  borderBottom: '1px solid #d9d9d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <BugOutlined style={{ fontSize: '24px', color: '#1890ff', marginRight: '12px' }} />
                    <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                      ADB Tools
                    </Title>
                    <span style={{ marginLeft: '16px', color: '#666', fontSize: '14px' }}>
                      Android调试工具集成平台
                    </span>
                  </div>
                  <Space>
                    <QueueMonitor />
                    <span style={{ fontSize: '12px', color: '#999' }}>
                      版本: {appVersion || '1.0.0'}
                    </span>
                  </Space>
                </Header>
                
                <Layout>
                  <Sider 
                    className="sidebar"
                    collapsible 
                    collapsed={collapsed} 
                    onCollapse={setCollapsed}
                    theme="light"
                    width={250}
                  >
                    <Menu
                      mode="inline"
                      selectedKeys={[selectedKey]}
                      style={{ height: '100%', borderRight: 0 }}
                      items={menuItems.map(item => ({
                        key: item.key,
                        icon: item.icon,
                        label: item.label,
                        onClick: () => handleMenuClick(item.key)
                      }))}
                    />
                  </Sider>
                  
                  <Content 
                    className="main-content" 
                    style={{ 
                      padding: '24px', 
                      background: '#fff',
                      overflow: 'auto',
                      height: 'calc(100vh - 64px)' // 减去header高度
                    }}
                  >
                    <InstallApk />
                  </Content>
                </Layout>
              </Layout>
            </div>
          } />
        </Routes>
      </DeviceProvider>
    </Router>
  )
}

export default App 