import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Typography,
  Descriptions,
  Row,
  Col,
  Progress,
  Tag,
  Statistic,
  Alert
} from 'antd'
import { 
  ReloadOutlined,
  MobileOutlined,
  DatabaseOutlined,
  HddOutlined,
  ThunderboltOutlined,
  WifiOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text } = Typography

interface SystemInfo {
  deviceModel: string
  manufacturer: string
  androidVersion: string
  apiLevel: string
  buildNumber: string
  serialNumber: string
  imei?: string
  macAddress?: string
  resolution: string
  density: string
  cpuAbi: string
  ramTotal: string
  ramUsed: string
  storageTotal: string
  storageUsed: string
  batteryLevel: number
  batteryStatus: string
  wifiStatus: string
  rootStatus: boolean
}

const SystemInfo: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedDevice && selectedDevice.status === 'device') {
      loadSystemInfo()
    } else {
      setSystemInfo(null)
    }
  }, [selectedDevice])

  const loadSystemInfo = async () => {
    if (!selectedDevice) {
      return
    }

    setLoading(true)
    try {
      // 并行获取所有系统信息
      const [
        modelResult,
        manufacturerResult,
        androidVersionResult,
        apiLevelResult,
        buildNumberResult,
        resolutionResult,
        densityResult,
        cpuAbiResult,
        memInfoResult,
        storageResult,
        batteryResult
      ] = await Promise.all([
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.product.model`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.product.manufacturer`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.build.version.release`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.build.version.sdk`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.build.display.id`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell wm size`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell wm density`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell getprop ro.product.cpu.abi`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell cat /proc/meminfo`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell df /data`),
        window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell dumpsys battery`)
      ])

      // 解析系统信息
      const parsedSystemInfo: SystemInfo = {
        deviceModel: modelResult.success ? modelResult.data?.trim() || '未知' : '未知',
        manufacturer: manufacturerResult.success ? manufacturerResult.data?.trim() || '未知' : '未知',
        androidVersion: androidVersionResult.success ? androidVersionResult.data?.trim() || '未知' : '未知',
        apiLevel: apiLevelResult.success ? apiLevelResult.data?.trim() || '未知' : '未知',
        buildNumber: buildNumberResult.success ? buildNumberResult.data?.trim() || '未知' : '未知',
        serialNumber: selectedDevice.serialNumber,
        resolution: parseResolution(resolutionResult.data || ''),
        density: parseDensity(densityResult.data || ''),
        cpuAbi: cpuAbiResult.success ? cpuAbiResult.data?.trim() || '未知' : '未知',
        ...parseMemoryInfo(memInfoResult.data || ''),
        ...parseStorageInfo(storageResult.data || ''),
        ...parseBatteryInfo(batteryResult.data || ''),
        wifiStatus: '未知', // 简化处理
        rootStatus: false // 简化处理，后续可以通过检查su命令来判断
      }

      setSystemInfo(parsedSystemInfo)
      setLoading(false)
    } catch (error: any) {
      console.error('获取系统信息失败:', error)
      setLoading(false)
    }
  }

  // 解析分辨率信息
  const parseResolution = (output: string): string => {
    const match = output.match(/Physical size: (\d+x\d+)/)
    return match ? match[1] : '未知'
  }

  // 解析屏幕密度
  const parseDensity = (output: string): string => {
    const match = output.match(/Physical density: (\d+)/)
    return match ? `${match[1]} dpi` : '未知'
  }

  // 解析内存信息
  const parseMemoryInfo = (output: string) => {
    const lines = output.split('\n')
    let memTotal = 0
    let memAvailable = 0

    for (const line of lines) {
      if (line.startsWith('MemTotal:')) {
        const match = line.match(/(\d+)\s*kB/)
        if (match) {
          memTotal = parseInt(match[1]) / 1024 / 1024 // 转换为GB
        }
      } else if (line.startsWith('MemAvailable:')) {
        const match = line.match(/(\d+)\s*kB/)
        if (match) {
          memAvailable = parseInt(match[1]) / 1024 / 1024 // 转换为GB
        }
      }
    }

    const memUsed = memTotal - memAvailable
    
    return {
      ramTotal: `${memTotal.toFixed(1)} GB`,
      ramUsed: `${memUsed.toFixed(1)} GB`
    }
  }

  // 解析存储信息
  const parseStorageInfo = (output: string) => {
    const lines = output.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      return {
        storageTotal: '未知',
        storageUsed: '未知'
      }
    }

    // 解析df输出的第二行
    const dataLine = lines[1]
    const parts = dataLine.split(/\s+/)
    
    if (parts.length >= 4) {
      const total = parseInt(parts[1]) / 1024 / 1024 // 转换为GB
      const used = parseInt(parts[2]) / 1024 / 1024 // 转换为GB
      
      return {
        storageTotal: `${total.toFixed(1)} GB`,
        storageUsed: `${used.toFixed(1)} GB`
      }
    }

    return {
      storageTotal: '未知',
      storageUsed: '未知'
    }
  }

  // 解析电池信息
  const parseBatteryInfo = (output: string) => {
    const lines = output.split('\n')
    let batteryLevel = 0
    let batteryStatus = '未知'

    for (const line of lines) {
      if (line.includes('level:')) {
        const match = line.match(/level:\s*(\d+)/)
        if (match) {
          batteryLevel = parseInt(match[1])
        }
      } else if (line.includes('status:')) {
        const match = line.match(/status:\s*(\d+)/)
        if (match) {
          const statusCode = parseInt(match[1])
          switch (statusCode) {
            case 2:
              batteryStatus = '充电中'
              break
            case 3:
              batteryStatus = '放电中'
              break
            case 4:
              batteryStatus = '未充电'
              break
            case 5:
              batteryStatus = '已充满'
              break
            default:
              batteryStatus = '未知'
          }
        }
      }
    }

    return {
      batteryLevel,
      batteryStatus
    }
  }

  const getRamUsagePercent = () => {
    if (!systemInfo) return 0
    const total = parseFloat(systemInfo.ramTotal)
    const used = parseFloat(systemInfo.ramUsed)
    return Math.round((used / total) * 100)
  }

  const getStorageUsagePercent = () => {
    if (!systemInfo) return 0
    const total = parseFloat(systemInfo.storageTotal)
    const used = parseFloat(systemInfo.storageUsed)
    return Math.round((used / total) * 100)
  }

  const getBatteryColor = (level: number) => {
    if (level > 80) return '#52c41a'
    if (level > 50) return '#faad14'
    if (level > 20) return '#fa8c16'
    return '#f5222d'
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>系统信息</Title>
          </Col>
          <Col>
            <Button 
              type="primary"
              icon={<ReloadOutlined />}
              onClick={loadSystemInfo}
              loading={loading}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              刷新信息
            </Button>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {!selectedDevice && (
        <Alert
          message="请先选择设备"
          description="请在设备管理中选择要查看系统信息的设备"
          type="info"
          showIcon
        />
      )}

      {selectedDevice && selectedDevice.status !== 'device' && (
        <Alert
          message="设备未连接"
          description="所选设备未连接或未授权，无法获取系统信息"
          type="warning"
          showIcon
        />
      )}

      {systemInfo && (
        <Row gutter={16}>
          {/* 设备基本信息 */}
          <Col span={12}>
            <Card title="设备信息" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="设备型号">
                  <Space>
                    <MobileOutlined />
                    {systemInfo.deviceModel}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="制造商">
                  {systemInfo.manufacturer}
                </Descriptions.Item>
                <Descriptions.Item label="Android版本">
                  Android {systemInfo.androidVersion} (API {systemInfo.apiLevel})
                </Descriptions.Item>
                <Descriptions.Item label="Build号">
                  <Text code>{systemInfo.buildNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="序列号">
                  <Text code>{systemInfo.serialNumber}</Text>
                </Descriptions.Item>
                {systemInfo.imei && (
                  <Descriptions.Item label="IMEI">
                    <Text code>{systemInfo.imei}</Text>
                  </Descriptions.Item>
                )}
                {systemInfo.macAddress && (
                  <Descriptions.Item label="MAC地址">
                    <Text code>{systemInfo.macAddress}</Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Root状态">
                  <Tag color={systemInfo.rootStatus ? 'red' : 'green'}>
                    {systemInfo.rootStatus ? '已Root' : '未Root'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* 硬件信息 */}
          <Col span={12}>
            <Card title="硬件信息" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="屏幕分辨率">
                  {systemInfo.resolution}
                </Descriptions.Item>
                <Descriptions.Item label="屏幕密度">
                  {systemInfo.density}
                </Descriptions.Item>
                <Descriptions.Item label="CPU架构">
                  {systemInfo.cpuAbi}
                </Descriptions.Item>
                <Descriptions.Item label="WiFi状态">
                  <Space>
                    <WifiOutlined />
                    <Tag color="green">{systemInfo.wifiStatus}</Tag>
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* 内存使用 */}
          <Col span={8}>
            <Card title="内存使用" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <DatabaseOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                </div>
                <Progress 
                  type="circle" 
                  percent={getRamUsagePercent()} 
                  format={percent => `${percent}%`}
                  strokeColor="#1890ff"
                />
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">
                    {systemInfo.ramUsed} / {systemInfo.ramTotal}
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>

          {/* 存储使用 */}
          <Col span={8}>
            <Card title="存储使用" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <HddOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                </div>
                <Progress 
                  type="circle" 
                  percent={getStorageUsagePercent()} 
                  format={percent => `${percent}%`}
                  strokeColor="#52c41a"
                />
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary">
                    {systemInfo.storageUsed} / {systemInfo.storageTotal}
                  </Text>
                </div>
              </Space>
            </Card>
          </Col>

          {/* 电池状态 */}
          <Col span={8}>
            <Card title="电池状态" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <ThunderboltOutlined 
                    style={{ 
                      fontSize: '24px', 
                      color: getBatteryColor(systemInfo.batteryLevel) 
                    }} 
                  />
                </div>
                <Progress 
                  type="circle" 
                  percent={systemInfo.batteryLevel} 
                  format={percent => `${percent}%`}
                  strokeColor={getBatteryColor(systemInfo.batteryLevel)}
                />
                <div style={{ textAlign: 'center' }}>
                  <Tag color={systemInfo.batteryStatus === '充电中' ? 'green' : 'blue'}>
                    {systemInfo.batteryStatus}
                  </Tag>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}

export default SystemInfo 