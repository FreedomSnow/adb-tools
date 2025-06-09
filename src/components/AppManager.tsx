import React, { useState, useEffect } from 'react'
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
// 导入类型声明
import '../types/electron.d.ts'

const { Title, Text } = Typography
const { Search } = Input
const { Option } = Select
const { TabPane } = Tabs

interface AppInfo {
  packageName: string
  appName: string
  version: string
  versionCode: string
  targetSdk: string
  minSdk: string
  size: string
  installTime: string
  updateTime: string
  isSystemApp: boolean
  isEnabled: boolean
  permissions: string[]
  icon?: string
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [installing, setInstalling] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    if (selectedDevice && selectedDevice.status === 'device') {
      // 防止重复调用，检查是否已经有应用数据
      if (installedApps.length === 0 && !loading) {
        loadInstalledApps()
      }
    } else {
      setInstalledApps([])
    }
  }, [selectedDevice?.id, selectedDevice?.status]) // 只依赖设备ID和状态，避免因设备信息更新导致重复调用

  useEffect(() => {
    let filtered = installedApps

    // 按类型过滤
    if (filterType === 'user') {
      filtered = filtered.filter(app => !app.isSystemApp)
    } else if (filterType === 'system') {
      filtered = filtered.filter(app => app.isSystemApp)
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

  const loadInstalledApps = async () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    // 防止重复调用
    if (loading) {
      return
    }

    setLoading(true)
    setLoadingProgress(0)
    setCancelLoading(false)
    
    try {
      // 获取已安装的应用包名列表
      const packagesResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell pm list packages`)
      
      if (!packagesResult.success) {
        throw new Error(packagesResult.error || '获取应用列表失败')
      }

      const packages = packagesResult.data?.split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', '').trim())
        .filter(pkg => pkg.length > 0) // 过滤空包名
      
      if (!packages?.length) {
        setInstalledApps([])
        setLoading(false)
        setLoadingProgress(0)
        message.info('设备上未找到已安装的应用')
        return
      }

      console.log(`找到 ${packages.length} 个应用包，开始获取详细信息...`)

      // 大幅减少批次大小和增加延迟，防止UI卡顿
      const BATCH_SIZE = 3  // 减少到3个
      const DELAY_BETWEEN_BATCHES = 300  // 增加延迟到300ms
      const validApps: AppInfo[] = []
      let processedCount = 0

      // 使用更保守的分批策略
      for (let i = 0; i < packages.length; i += BATCH_SIZE) {
        const batch = packages.slice(i, i + BATCH_SIZE)
        
        try {
          // 串行处理批次内的每个应用，避免并发过多
          for (const packageName of batch) {
            // 检查是否取消加载
            if (cancelLoading) {
              console.log('用户取消加载')
              setLoading(false)
              setLoadingProgress(0)
              return
            }
            
            try {
              const appInfo = await getAppDetails(packageName)
              if (appInfo) {
                validApps.push(appInfo)
                
                // 每获取一个应用就更新UI，提供更好的响应性
                setInstalledApps([...validApps])
                
                // 小延迟，让UI有时间响应
                await new Promise(resolve => setTimeout(resolve, 50))
              }
            } catch (error) {
              console.warn(`获取应用详情失败: ${packageName}`, error)
            }
            
            processedCount++
            
            // 更新进度
            const progress = Math.round((processedCount / packages.length) * 100)
            setLoadingProgress(progress)
            
            // 每10个应用显示一次进度
            if (processedCount % 10 === 0) {
              console.log(`已处理 ${processedCount}/${packages.length} 个应用 (${progress}%)`)
            }
          }

          // 批次间的较长延迟，确保UI响应性
          if (i + BATCH_SIZE < packages.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
          }

        } catch (batchError) {
          console.error(`批次处理出错 (${i}-${i + BATCH_SIZE}):`, batchError)
          // 继续处理下一批
        }
      }

      setLoading(false)
      setLoadingProgress(100)
      
      if (validApps.length > 0) {
        message.success(`从设备 ${selectedDevice.model} 获取到 ${validApps.length} 个应用`)
        console.log(`应用加载完成，共 ${validApps.length} 个有效应用`)
      } else {
        message.warning('未能获取到有效的应用信息')
      }
      
      // 重置进度
      setTimeout(() => setLoadingProgress(0), 2000)
      
    } catch (error: any) {
      console.error('获取应用列表失败:', error)
      message.error(`获取应用列表失败: ${error.message}`)
      setLoading(false)
      setLoadingProgress(0)
    }
  }

  // 获取应用详细信息
  const getAppDetails = async (packageName: string): Promise<AppInfo | null> => {
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

      // 并行获取应用信息，并添加更好的错误处理
      const [pathResult, versionResult] = await Promise.allSettled([
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell pm path ${packageName}`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell dumpsys package ${packageName} | grep versionName`)
      ])

      // 处理路径信息
      let isSystemApp = false
      if (pathResult.status === 'fulfilled' && pathResult.value.success && pathResult.value.data) {
        isSystemApp = pathResult.value.data.includes('/system/')
        addDebugLog(`获取应用路径成功: ${packageName} (系统应用: ${isSystemApp})`)
      } else if (pathResult.status === 'rejected') {
        addDebugLog(`获取应用路径失败: ${packageName} - ${pathResult.reason}`)
      } else if (pathResult.status === 'fulfilled' && !pathResult.value.success) {
        addDebugLog(`获取应用路径失败: ${packageName} - ${pathResult.value.error}`)
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
        addDebugLog(`获取应用版本成功: ${packageName} v${version} (${versionCode})`)
      } else if (versionResult.status === 'rejected') {
        addDebugLog(`获取应用版本失败: ${packageName} - ${versionResult.reason}`)
      } else if (versionResult.status === 'fulfilled' && !versionResult.value.success) {
        addDebugLog(`获取应用版本失败: ${packageName} - ${versionResult.value.error}`)
      }

      // 获取应用名称（简化处理）
      let appName = packageName.split('.').pop() || packageName
      if (appName.length > 20) {
        appName = appName.substring(0, 20) + '...'
      }

      return {
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
        isEnabled: true, // 简化处理，默认为启用
        permissions: [] // 简化处理，暂不获取权限列表
      }
    } catch (error) {
      console.error(`获取应用详情失败: ${packageName}`, error)
      return null
    }
  }

  const installApk = async (file: File) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setInstalling(true)
    setUploadProgress(0)

    try {
      // 将File对象转换为ArrayBuffer，然后转为Uint8Array
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      setUploadProgress(20)
      
      // 使用主进程的API安装APK
      const installResult = await window.adbToolsAPI.installApk(uint8Array, file.name, selectedDevice.id)
      
      setUploadProgress(90)
      
      if (installResult.success) {
        // 检查安装结果
        const resultText = installResult.data || ''
        if (resultText.includes('Success') || resultText.includes('success') || resultText.includes('安装完成')) {
          setUploadProgress(100)
          message.success(`APK ${file.name} 安装到 ${selectedDevice.model} 成功`)
          
          // 立即刷新应用列表，确保新安装的应用显示
          await refreshApps()
        } else {
          throw new Error(resultText || '安装失败')
        }
      } else {
        throw new Error(installResult.error || '安装失败')
      }
    } catch (error: any) {
      console.error('APK安装失败:', error)
      message.error(`APK安装失败: ${error.message}`)
    } finally {
      setInstalling(false)
      setUploadProgress(0)
    }
  }

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

  const startApp = async (packageName: string, appName: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      // 使用更简单的启动方式
      const startResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am start -n ${packageName}/.MainActivity`)
      
      // 如果第一种方式失败，尝试使用monkey命令
      if (!startResult.success) {
        const monkeyResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`)
        
        // monkey命令通常会输出调试信息，但只要没有明确的错误就认为成功
        if (monkeyResult.success || (monkeyResult.error && !monkeyResult.error.includes('No activities found'))) {
          message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
          return
        }
        
        throw new Error(monkeyResult.error || '启动失败')
      }
      
      message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
    } catch (error: any) {
      // 尝试第三种启动方式
      try {
        const intentResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`)
        
        if (intentResult.success) {
          message.success(`正在从 ${selectedDevice.model} 启动 ${appName}`)
        } else {
          message.error(`启动应用失败: ${error.message}`)
        }
      } catch (finalError: any) {
        message.error(`启动应用失败: ${finalError.message}`)
      }
    }
  }

  const stopApp = async (packageName: string, appName: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      const stopResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell am force-stop ${packageName}`)
      
      if (stopResult.success) {
        message.success(`已在 ${selectedDevice.model} 上停止 ${appName}`)
      } else {
        throw new Error(stopResult.error || '停止失败')
      }
    } catch (error: any) {
      message.error(`停止应用失败: ${error.message}`)
    }
  }

  const showAppDetail = (app: AppInfo) => {
    setSelectedApp(app)
    setDetailModalVisible(true)
  }

  const uploadProps = {
    accept: '.apk',
    showUploadList: false,
    beforeUpload: (file: File) => {
      if (!file.name.endsWith('.apk')) {
        message.error('请选择APK文件')
        return false
      }
      installApk(file)
      return false
    }
  }

  const columns = [
    {
      title: '应用',
      key: 'app',
      render: (_: any, record: AppInfo) => (
        <Space>
          <Avatar 
            size="large" 
            icon={<AndroidOutlined />}
            style={{ backgroundColor: record.isSystemApp ? '#1890ff' : '#52c41a' }}
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
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: string, record: AppInfo) => (
        <div>
          <div>{version}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Code: {record.versionCode}
          </Text>
        </div>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size'
    },
    {
      title: '类型',
      key: 'type',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isSystemApp ? 'blue' : 'green'}>
          {record.isSystemApp ? '系统应用' : '用户应用'}
        </Tag>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isEnabled ? 'green' : 'red'}>
          {record.isEnabled ? '已启用' : '已禁用'}
        </Tag>
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
            icon={<PlayCircleOutlined />}
            onClick={() => startApp(record.packageName, record.appName)}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          >
            启动
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<StopOutlined />}
            onClick={() => stopApp(record.packageName, record.appName)}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          >
            停止
          </Button>
          {!record.isSystemApp && (
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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>应用管理</Title>
          </Col>
          <Col>
            <Upload {...uploadProps}>
              <Button 
                type="primary" 
                icon={<UploadOutlined />}
                loading={installing}
                disabled={!selectedDevice || selectedDevice.status !== 'device'}
              >
                安装APK
              </Button>
            </Upload>
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />}
              onClick={refreshApps}
              loading={loading}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              刷新
            </Button>
          </Col>
          {loading && (
            <Col>
              <Button 
                type="default"
                danger
                onClick={cancelAppLoading}
              >
                取消加载
              </Button>
            </Col>
          )}
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {installing && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>正在安装APK到 {selectedDevice?.model}...</Text>
            <Progress 
              percent={uploadProgress} 
              status={uploadProgress === 100 ? 'success' : 'active'}
            />
          </Space>
        </Card>
      )}

      {loading && loadingProgress > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space align="center">
              <Text>正在加载应用列表...</Text>
              <Text type="secondary">({installedApps.length} 个应用已加载)</Text>
              <Button 
                type="link" 
                size="small"
                danger 
                onClick={cancelAppLoading}
              >
                取消
              </Button>
            </Space>
            <Progress 
              percent={loadingProgress}
              status={cancelLoading ? 'exception' : 'active'}
              format={(percent) => `${percent}%`}
            />
          </Space>
        </Card>
      )}

      <Card>
        {/* 过滤控制面板 */}
        <div style={{ marginBottom: 16, padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
          <Row gutter={16} align="middle">
            <Col span={8}>
              <Text strong>搜索应用:</Text>
              <Search
                placeholder="搜索应用名称或包名"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ marginTop: 4 }}
                allowClear
              />
            </Col>
            <Col span={5}>
              <Text strong>应用类型:</Text>
              <Select 
                value={filterType} 
                onChange={setFilterType}
                style={{ width: '100%', marginTop: 4 }}
              >
                <Option value="all">全部应用</Option>
                <Option value="user">用户应用</Option>
                <Option value="system">系统应用</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Space direction="vertical" size="small">
                <Text strong>统计信息</Text>
                <Text type="secondary">
                  总计: {installedApps.length} | 显示: {filteredApps.length}
                </Text>
              </Space>
            </Col>
            <Col span={3}>
              <Space direction="vertical" size="small">
                <Text strong>当前设备</Text>
                <Text type="secondary">
                  {selectedDevice ? selectedDevice.model : '未选择'}
                </Text>
              </Space>
            </Col>
            <Col span={4}>
              <Space direction="vertical" size="small">
                <Space>
                  <BugOutlined />
                  <Text strong>调试模式</Text>
                </Space>
                <Switch
                  checked={debugMode}
                  onChange={setDebugMode}
                  size="small"
                />
              </Space>
            </Col>
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
          columns={columns}
          dataSource={filteredApps}
          rowKey="packageName"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个应用`
          }}
          size="middle"
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
                  {selectedApp.version}
                </Descriptions.Item>
                <Descriptions.Item label="版本代码">
                  {selectedApp.versionCode}
                </Descriptions.Item>
                <Descriptions.Item label="目标SDK">
                  API {selectedApp.targetSdk}
                </Descriptions.Item>
                <Descriptions.Item label="最小SDK">
                  API {selectedApp.minSdk}
                </Descriptions.Item>
                <Descriptions.Item label="应用大小">
                  {selectedApp.size}
                </Descriptions.Item>
                <Descriptions.Item label="应用类型">
                  <Tag color={selectedApp.isSystemApp ? 'blue' : 'green'}>
                    {selectedApp.isSystemApp ? '系统应用' : '用户应用'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="安装时间">
                  {selectedApp.installTime}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {selectedApp.updateTime}
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