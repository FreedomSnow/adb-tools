import React, { useState, useEffect, useRef } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Table, 
  Typography,
  Upload,
  message,
  Modal,
  Descriptions,
  Tag,
  Input,
  Select,
  Progress,
  Row,
  Col,
  Tabs,
  List,
  Avatar,
  Switch,
  Alert
} from 'antd'
import { 
  AppstoreOutlined,
  UploadOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  AndroidOutlined,
  PlayCircleOutlined,
  StopOutlined,
  BugOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'
import { getInstalledApps, getAppCount, getPaginatedApps, type AppType } from '../utils/appUtils'
import type { AppInfo } from '../types/app'
// 导入类型声明
import '../types/electron.d.ts'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select
const { TabPane } = Tabs

// 添加缓存接口
interface AppDetailCache {
  [key: string]: {
    data: AppInfo
    timestamp: number
  }
}

const AppManager: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [installedApps, setInstalledApps] = useState<AppInfo[]>([])
  const [filteredApps, setFilteredApps] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedApp, setSelectedApp] = useState<AppInfo | null>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'user' | 'system'>('all')
  const [installing, setInstalling] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [totalApps, setTotalApps] = useState(0)
  const [loadedApps, setLoadedApps] = useState(0)
  const [runningApps, setRunningApps] = useState<Set<string>>(new Set())
  const [loadingCancelled, setLoadingCancelled] = useState(false)
  
  // 添加缓存状态
  const [appDetailCache, setAppDetailCache] = useState<AppDetailCache>({})
  const [packageList, setPackageList] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // 添加appType变量
  const appType = filterType === 'all' ? 'all' : filterType === 'system' ? 'system' : 'user'

  // 缓存过期时间（5分钟）
  const CACHE_EXPIRY = 5 * 60 * 1000

  // 添加缓存刷新定时器引用
  const cacheRefreshTimerRef = useRef<NodeJS.Timeout>()

  const navigate = useNavigate()

  // 检查缓存是否有效
  const isCacheValid = (timestamp: number) => {
    return Date.now() - timestamp < CACHE_EXPIRY
  }

  // 自动加载应用列表
  useEffect(() => {
    if (selectedDevice?.status === 'device' && installedApps.length === 0 && !loading) {
      loadInstalledApps()
    }
  }, [selectedDevice?.status, installedApps.length, loading])

  // 修改过滤逻辑
  useEffect(() => {
    let filtered = installedApps

    // 按类型过滤
    if (filterType === 'user') {
      filtered = filtered.filter(app => !app.isSystem)
    } else if (filterType === 'system') {
      filtered = filtered.filter(app => app.isSystem)
    }

    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(app => 
        app.appName.toLowerCase().includes(searchText.toLowerCase()) ||
        app.packageName.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    setFilteredApps(filtered)
  }, [installedApps, filterType, searchText])

  // 检查并刷新缓存中的应用详情
  const refreshCachedAppDetails = async (packageName: string) => {
    const cached = appDetailCache[packageName]
    if (!cached) return

    // 如果缓存未过期，不刷新
    if (isCacheValid(cached.timestamp)) return

    try {
      const newAppInfo = await getAppDetails(packageName)
      if (newAppInfo) {
        // 更新缓存
        setAppDetailCache(prev => ({
          ...prev,
          [packageName]: {
            data: newAppInfo,
            timestamp: Date.now()
          }
        }))

        // 如果应用当前显示在页面上，更新显示
        setInstalledApps(prev => {
          const index = prev.findIndex(app => app.packageName === packageName)
          if (index !== -1) {
            const newApps = [...prev]
            newApps[index] = newAppInfo
            return newApps
          }
          return prev
        })
      }
    } catch (error) {
      console.error(`刷新应用详情失败: ${packageName}`, error)
    }
  }

  // 设置缓存刷新定时器
  useEffect(() => {
    // 清除旧的定时器
    if (cacheRefreshTimerRef.current) {
      clearInterval(cacheRefreshTimerRef.current)
    }

    // 设置新的定时器，每分钟检查一次缓存
    cacheRefreshTimerRef.current = setInterval(() => {
      // 获取当前显示在页面上的应用包名
      const visiblePackages = filteredApps.map(app => app.packageName)
      
      // 检查并刷新这些应用的缓存
      visiblePackages.forEach(packageName => {
        refreshCachedAppDetails(packageName)
      })
    }, 60000) // 每分钟检查一次

    return () => {
      if (cacheRefreshTimerRef.current) {
        clearInterval(cacheRefreshTimerRef.current)
      }
    }
  }, [filteredApps]) // 当过滤后的应用列表变化时重新设置定时器

  // 获取应用详情（带缓存）
  const getAppDetails = async (packageName: string): Promise<AppInfo | null> => {
    // 检查缓存
    const cached = appDetailCache[packageName]
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.data
    }

    const addDebugLog = (log: string) => {
      if (debugMode) {
        setDebugLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${log}`])
      }
    }

    try {
      addDebugLog(`开始获取应用信息: ${packageName}`)
      
      // 首先检查应用是否存在
      const packageExistsResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell pm list packages ${packageName}`)
      
      if (!packageExistsResult.success || !packageExistsResult.data?.includes(packageName)) {
        addDebugLog(`应用包 ${packageName} 不存在，跳过获取详细信息`)
        return null
      }

      addDebugLog(`应用包 ${packageName} 存在，继续获取详细信息`)

      // 并行获取应用信息
      const [pathResult, versionResult] = await Promise.allSettled([
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell pm path ${packageName}`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell dumpsys package ${packageName} | grep versionName`)
      ])

      // 处理路径信息
      let isSystemApp = false
      if (pathResult.status === 'fulfilled' && pathResult.value.success && pathResult.value.data) {
        isSystemApp = pathResult.value.data.includes('/system/')
        addDebugLog(`获取应用路径成功: ${packageName} (系统应用: ${isSystemApp})`)
      }
      
      // 处理版本信息
      let version = '未知'
      let versionCode = '未知'
      if (versionResult.status === 'fulfilled' && versionResult.value.success && versionResult.value.data) {
        const versionMatch = versionResult.value.data.match(/versionName=([^\s]+)/)
        if (versionMatch) {
          version = versionMatch[1]
        }
        const codeMatch = versionResult.value.data.match(/versionCode=(\d+)/)
        if (codeMatch) {
          versionCode = codeMatch[1]
        }
      }

      // 获取应用名称
      let appName = packageName.split('.').pop() || packageName
      if (appName.length > 20) {
        appName = appName.substring(0, 20) + '...'
      }

      const appInfo: AppInfo = {
        packageName,
        appName,
        version,
        versionCode,
        targetSdk: '未知',
        minSdk: '未知',
        size: '未知',
        installTime: '未知',
        updateTime: '未知',
        isSystemApp,
        isEnabled: true,
        permissions: []
      }

      // 更新缓存
      setAppDetailCache(prev => ({
        ...prev,
        [packageName]: {
          data: appInfo,
          timestamp: Date.now()
        }
      }))

      return appInfo
    } catch (error) {
      console.error(`获取应用详情失败: ${packageName}`, error)
      return null
    }
  }

  // 修改加载当前页应用详情函数
  const loadCurrentPageDetails = async () => {
    if (!packageList.length) return

    const startIndex = (currentPage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, packageList.length)
    const currentPagePackages = packageList.slice(startIndex, endIndex)

    for (const packageName of currentPagePackages) {
      if (cancelLoading) {
        setLoading(false)
        setCancelLoading(false)
        return
      }

      // 检查缓存是否需要刷新
      const cached = appDetailCache[packageName]
      if (cached && !isCacheValid(cached.timestamp)) {
        // 如果缓存过期，静默刷新
        refreshCachedAppDetails(packageName)
      }

      const appInfo = await getAppDetails(packageName)
      if (appInfo) {
        setInstalledApps(prev => {
          const newApps = [...prev]
          const index = newApps.findIndex(app => app.packageName === packageName)
          if (index === -1) {
            newApps.push(appInfo)
          } else {
            newApps[index] = appInfo
          }
          return newApps
        })
        setLoadedApps(prev => prev + 1)
      }
    }
  }

  // 修改加载应用列表函数
  const loadInstalledApps = async () => {
    if (!selectedDevice || selectedDevice.status !== 'device') {
      message.error('请先选择设备')
      return
    }

    setLoading(true)
    setLoadedApps(0)
    setTotalApps(0)
    setInstalledApps([])
    setLoadingCancelled(false)

    try {
      // 使用工具类获取应用列表
      const apps = await getInstalledApps(selectedDevice.id, appType)

      if (loadingCancelled) {
        return
      }

      // 更新总数和应用列表
      const total = getAppCount(apps, appType)
      setTotalApps(total)
      setInstalledApps(apps as AppInfo[])
      setLoadedApps(apps.length)
    } catch (error) {
      console.error('加载应用列表失败:', error)
      message.error('加载应用列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 监听分页变化
  useEffect(() => {
    if (packageList.length > 0) {
      loadCurrentPageDetails()
    }
  }, [currentPage, pageSize])

  const uninstallApp = async (packageName: string, appName: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    Modal.confirm({
      title: '确认卸载',
      content: `确定要从 "${selectedDevice.model}" 卸载 "${appName}" 吗？`,
      okText: '卸载',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.loading('正在卸载...', 0)
          
          const uninstallResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} uninstall ${packageName}`)
          
          message.destroy()
          
          if (uninstallResult.success && uninstallResult.data?.includes('Success')) {
            message.success('卸载成功')
            setInstalledApps(prev => prev.filter(app => app.packageName !== packageName))
          } else {
            throw new Error(uninstallResult.error || uninstallResult.data || '卸载失败')
          }
        } catch (error: any) {
          message.destroy()
          message.error(`卸载失败: ${error.message}`)
        }
      }
    })
  }

  // 添加检查应用运行状态的函数
  const checkAppRunningStatus = async (packageName: string) => {
    if (!selectedDevice) return false
    
    try {
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell pidof ${packageName}`)
      return result.success && result.data && result.data.trim().length > 0
    } catch (error) {
      console.error(`检查应用运行状态失败: ${packageName}`, error)
      return false
    }
  }

  // 修改启动应用函数
  const startApp = async (packageName: string, appName: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      const startResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am start -n ${packageName}/.MainActivity`)
      
      if (!startResult.success) {
        const monkeyResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
        
        if (monkeyResult.success || (monkeyResult.error && !monkeyResult.error.includes('No activities found'))) {
          message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
          setRunningApps(prev => new Set([...prev, packageName]))
          return
        }
        
        throw new Error(monkeyResult.error || '启动失败')
      }
      
      message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
      setRunningApps(prev => new Set([...prev, packageName]))
    } catch (error: any) {
      try {
        const intentResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`)
        
        if (intentResult.success) {
          message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
          setRunningApps(prev => new Set([...prev, packageName]))
        } else {
          message.error(`启动应用失败: ${error.message}`)
        }
      } catch (finalError: any) {
        message.error(`启动应用失败: ${finalError.message}`)
      }
    }
  }

  // 修改停止应用函数
  const stopApp = async (packageName: string, appName: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      const stopResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am force-stop ${packageName}`)
      
      if (stopResult.success) {
        message.success(`已在 ${selectedDevice.model} 上停止 ${appName}`)
        setRunningApps(prev => {
          const newSet = new Set(prev)
          newSet.delete(packageName)
          return newSet
        })
      } else {
        throw new Error(stopResult.error || '停止失败')
      }
    } catch (error: any) {
      message.error(`停止应用失败: ${error.message}`)
    }
  }

  // 添加定期检查应用运行状态的函数
  useEffect(() => {
    if (!selectedDevice || selectedDevice.status !== 'device') return

    const checkRunningApps = async () => {
      const newRunningApps = new Set<string>()
      for (const app of installedApps) {
        const isRunning = await checkAppRunningStatus(app.packageName)
        if (isRunning) {
          newRunningApps.add(app.packageName)
        }
      }
      setRunningApps(newRunningApps)
    }

    // 初始检查
    checkRunningApps()

    // 每30秒检查一次
    const interval = setInterval(checkRunningApps, 30000)

    return () => clearInterval(interval)
  }, [selectedDevice, installedApps])

  const showAppDetail = (app: AppInfo) => {
    setSelectedApp(app)
    setDetailModalVisible(true)
  }

  const columns = [
    {
      title: '应用名称',
      key: 'appName',
      render: (_: any, record: AppInfo) => (
        <Space>
          <Avatar 
            size="large" 
            icon={<AndroidOutlined />}
            style={{ backgroundColor: record.isSystem ? '#1890ff' : '#52c41a' }}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.appName}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.packageName}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: '版本号',
      dataIndex: 'versionName',
      key: 'versionName',
      render: (version: string) => (
        <Text>{version}</Text>
      )
    },
    {
      title: '类型',
      key: 'type',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isSystem ? 'blue' : 'green'}>
          {record.isSystem ? '系统应用' : '用户应用'}
        </Tag>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isRunning ? 'green' : 'red'}>
          {record.isRunning ? '运行中' : '已停止'}
        </Tag>
      )
    },
    {
      title: '安装时间',
      key: 'installTime',
      render: (_: any, record: AppInfo) => (
        <Text>{record.installTime}</Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AppInfo) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            icon={<InfoCircleOutlined />}
            onClick={() => showAppDetail(record)}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={runningApps.has(record.packageName) ? <StopOutlined /> : <PlayCircleOutlined />}
            onClick={() => runningApps.has(record.packageName) 
              ? stopApp(record.packageName, record.appName)
              : startApp(record.packageName, record.appName)
            }
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          >
            {runningApps.has(record.packageName) ? '停止' : '启动'}
          </Button>
          {!record.isSystem && (
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => uninstallApp(record.packageName, record.appName)}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              卸载
            </Button>
          )}
        </Space>
      )
    }
  ]

  const refreshApps = async () => {
    // 如果正在加载，先取消当前加载
    if (loading) {
      setCancelLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500)) // 等待取消生效
    }
    
    // 清空现有数据，强制重新加载
    setInstalledApps([])
    setCancelLoading(false)
    await loadInstalledApps()
  }

  const cancelAppLoading = () => {
    setCancelLoading(true)
    message.info('正在取消加载...')
  }

  // 修改表格数据源
  const tableDataSource = getPaginatedApps(installedApps as any, currentPage, pageSize)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>应用管理</Title>
          </Col>
        </Row>
        <Row gutter={16} align="middle" style={{ marginTop: 16 }}>
          <Col>
            <Button 
              type="primary" 
              icon={<UploadOutlined />}
              onClick={() => navigate('/install-apk')}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              安装APK
            </Button>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      <Card>
        {/* 过滤控制面板 */}
        <div style={{ marginBottom: 16, padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
          <Row gutter={16} align="middle">
            <Col span={5}>
              <Text strong>应用类型:</Text>
              <Select
                value={filterType}
                onChange={setFilterType}
                style={{ width: '100%', marginTop: 4 }}
              >
                <Select.Option value="all">全部应用</Select.Option>
                <Select.Option value="system">系统应用</Select.Option>
                <Select.Option value="user">用户应用</Select.Option>
              </Select>
            </Col>
            <Col span={4}>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={loadInstalledApps}
                loading={loading}
                style={{ marginTop: 28 }}
                disabled={!selectedDevice || selectedDevice.status !== 'device'}
              >
                {loading ? `加载中 ${loadedApps}/${totalApps}` : '加载应用列表'}
              </Button>
            </Col>
            <Col span={4} style={{ textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                style={{ marginTop: 28 }}
              />
            </Col>
            <Col span={11} />
          </Row>
        </div>

        {/* 调试日志面板 */}
        {debugMode && (
          <Alert
            message="调试模式已启用"
            description={
              <div>
                <Text type="secondary">实时显示ADB命令执行详情，帮助排查问题</Text>
                {debugLogs.length > 0 && (
                  <div style={{ 
                    marginTop: 8, 
                    maxHeight: '200px', 
                    overflow: 'auto', 
                    background: '#f5f5f5', 
                    padding: '8px', 
                    borderRadius: '4px',
                    fontFamily: 'Monaco, Menlo, Consolas, monospace',
                    fontSize: '12px'
                  }}>
                    {debugLogs.map((log, index) => (
                      <div key={index} style={{ marginBottom: '2px' }}>
                        {log}
                      </div>
                    ))}
                  </div>
                )}
                {debugLogs.length === 0 && (
                  <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    等待ADB命令执行...
                  </Text>
                )}
                <Button 
                  size="small" 
                  type="link" 
                  onClick={() => setDebugLogs([])}
                  style={{ padding: 0, marginTop: 4 }}
                >
                  清空日志
                </Button>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setDebugMode(false)}
          />
        )}

        <Table
          dataSource={tableDataSource}
          columns={columns}
          rowKey="packageName"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: totalApps,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page)
              setPageSize(size)
            }
          }}
          loading={loading}
          scroll={{ y: 'calc(100vh - 300px)' }}
          onRow={(record) => ({
            onClick: () => showAppDetail(record)
          })}
        />
      </Card>

      {/* 应用详情对话框 */}
      <Modal
        title={`应用详情 - ${selectedDevice?.model || '设备'}`}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedApp(null)
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedApp && (
          <Tabs defaultActiveKey="basic">
            <TabPane tab="基本信息" key="basic">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="应用名称" span={2}>
                  <Space>
                    <Avatar icon={<AndroidOutlined />} />
                    <Text strong>{selectedApp.appName}</Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="包名" span={2}>
                  <Text code>{selectedApp.packageName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="版本">
                  {selectedApp.versionName}
                </Descriptions.Item>
                <Descriptions.Item label="版本代码">
                  {selectedApp.versionCode}
                </Descriptions.Item>
                <Descriptions.Item label="应用类型">
                  <Tag color={selectedApp.isSystem ? 'blue' : 'green'}>
                    {selectedApp.isSystem ? '系统应用' : '用户应用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="运行状态">
                  <Tag color={selectedApp.isRunning ? 'green' : 'red'}>
                    {selectedApp.isRunning ? '运行中' : '已停止'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="安装时间">
                  {selectedApp.installTime}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane tab="权限信息" key="permissions">
              <List
                header={<Text strong>应用权限 ({selectedApp.permissions.length})</Text>}
                bordered
                dataSource={selectedApp.permissions}
                renderItem={(permission) => (
                  <List.Item>
                    <Text code>{permission}</Text>
                  </List.Item>
                )}
                size="small"
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>
    </div>
  )
}

export default AppManager 