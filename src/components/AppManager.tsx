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
  Avatar
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
  StopOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

// 临时类型声明解决编译问题
declare global {
  interface Window {
    adbToolsAPI: {
      getAdbPath: () => Promise<string>
      getAppVersion: () => Promise<string>
      openWin: (arg: string) => Promise<void>
      execAdbCommand: (command: string) => Promise<{
        success: boolean
        data?: string
        error?: string
      }>
      getDevices: () => Promise<{
        success: boolean
        data?: string
        error?: string
      }>
      installApk: (fileData: Uint8Array | Buffer, fileName: string, deviceId: string) => Promise<{
        success: boolean
        data?: string
        error?: string
      }>
      onMainProcessMessage: (callback: (message: string) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

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
    try {
      // 获取已安装的应用包名列表
      const packagesResult = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell pm list packages`)
      
      if (!packagesResult.success) {
        throw new Error(packagesResult.error || '获取应用列表失败')
      }

      const packages = packagesResult.data?.split('\n')
        .filter(line => line.startsWith('package:'))
        .map(line => line.replace('package:', ''))
        // 移除数量限制，显示所有应用
      
      if (!packages?.length) {
        setInstalledApps([])
        setLoading(false)
        return
      }

      // 获取应用详细信息
      const appsWithDetails = await Promise.all(
        packages.map(async (packageName) => {
          try {
            const appInfo = await getAppDetails(packageName)
            return appInfo
          } catch (error) {
            console.error(`获取应用详情失败: ${packageName}`, error)
            return null
          }
        })
      )

      const validApps = appsWithDetails.filter(app => app !== null) as AppInfo[]
      setInstalledApps(validApps)
      setLoading(false)
      
      // 只在成功获取到应用时显示提示
      if (validApps.length > 0) {
        message.success(`从设备 ${selectedDevice.model} 获取到 ${validApps.length} 个应用`)
      }
    } catch (error: any) {
      console.error('获取应用列表失败:', error)
      message.error(`获取应用列表失败: ${error.message}`)
      setLoading(false)
    }
  }

  // 获取应用详细信息
  const getAppDetails = async (packageName: string): Promise<AppInfo | null> => {
    try {
      const [pathResult, versionResult] = await Promise.all([
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell pm path ${packageName}`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice!.id} shell dumpsys package ${packageName} | grep versionName`)
      ])

      // 获取应用路径来判断是否为系统应用
      const isSystemApp = !!(pathResult.success && pathResult.data?.includes('/system/'))
      
      // 提取版本信息
      let version = '未知'
      let versionCode = '未知'
      if (versionResult.success && versionResult.data) {
        const versionMatch = versionResult.data.match(/versionName=([^\s]+)/)
        if (versionMatch) {
          version = versionMatch[1]
        }
        const codeMatch = versionResult.data.match(/versionCode=(\d+)/)
        if (codeMatch) {
          versionCode = codeMatch[1]
        }
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
    // 清空现有数据，强制重新加载
    setInstalledApps([])
    await loadInstalledApps()
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
            <Col span={6}>
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
            <Col span={6}>
              <Space direction="vertical" size="small">
                <Text strong>统计信息</Text>
                <Text type="secondary">
                  总计: {installedApps.length} | 显示: {filteredApps.length}
                </Text>
              </Space>
            </Col>
            <Col span={4}>
              <Space direction="vertical" size="small">
                <Text strong>当前设备</Text>
                <Text type="secondary">
                  {selectedDevice ? selectedDevice.model : '未选择'}
                </Text>
              </Space>
            </Col>
          </Row>
        </div>

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