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
import { PageProvider, usePage } from './contexts/PageContext'
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
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
// 导入类型声明
import './types/electron.d.ts'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography

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
  return (
    <Router>
      <DeviceProvider>
        <PageProvider>
          <MainLayout />
        </PageProvider>
      </DeviceProvider>
    </Router>
  )
}

const MainLayout: React.FC = () => {
  const [selectedKey, setSelectedKey] = useState('devices')
  const [appVersion, setAppVersion] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const { setPageState, getPageState } = usePage()
  const navigate = useNavigate()
  const location = useLocation()

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
    const pageState = getPageState(key)
    if (pageState.path.length > 0) {
      navigate(`/${key}/${pageState.path.join('/')}`)
    } else {
      navigate(`/${key}`)
    }
  }

  const currentMenuItem = menuItems.find(item => item.key === selectedKey)
  const CurrentComponent = currentMenuItem?.component || DeviceManager

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={setCollapsed}
        theme="light"
      >
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>ADB Tools</Title>
          <Typography.Text type="secondary" style={{ fontSize: '12px' }}>v{appVersion}</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => handleMenuClick(key)}
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label
          }))}
        />
      </Sider>
      <Layout>
        <Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
          <Routes>
            <Route path="/" element={<DeviceManager />} />
            <Route path="/devices" element={<DeviceManager />} />
            <Route path="/apps" element={<AppManager />} />
            <Route path="/commands" element={<CommandExecutor />} />
            <Route path="/screen" element={<ScreenCapture />} />
            <Route path="/install-apk" element={<InstallApk />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App 