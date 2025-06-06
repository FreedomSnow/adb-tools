import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Table, 
  Tag, 
  Typography, 
  Alert, 
  Input,
  Modal,
  message,
  Descriptions,
  Divider
} from 'antd'
import { 
  ReloadOutlined, 
  WifiOutlined, 
  UsbOutlined, 
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import { useDevice, Device } from '../contexts/DeviceContext'

const { Title, Text } = Typography
const { Search } = Input

const DeviceManager: React.FC = () => {
  const { devices, setDevices, selectedDevice, setSelectedDevice } = useDevice()
  const [loading, setLoading] = useState(false)
  const [detailDevice, setDetailDevice] = useState<Device | null>(null)
  const [wifiModalVisible, setWifiModalVisible] = useState(false)
  const [wifiAddress, setWifiAddress] = useState('')

  useEffect(() => {
    refreshDevices()
  }, [])

  const refreshDevices = async () => {
    setLoading(true)
    try {
      const result = await window.adbToolsAPI.execAdbCommand('devices -l')
      
      if (!result.success) {
        throw new Error(result.error || '获取设备列表失败')
      }

      const devices = parseDeviceList(result.data || '')
      
      // 为在线设备获取详细信息
      const devicesWithDetails = await Promise.all(
        devices.map(async (device) => {
          if (device.status === 'device') {
            const details = await getDeviceDetails(device.id)
            return { ...device, ...details }
          }
          return device
        })
      )
      
      setDevices(devicesWithDetails)
      
      // 如果没有选中的设备，自动选择第一个在线设备
      if (!selectedDevice) {
        const firstOnlineDevice = devicesWithDetails.find(device => device.status === 'device')
        if (firstOnlineDevice) {
          setSelectedDevice(firstOnlineDevice)
        }
      }
      
      setLoading(false)
    } catch (error: any) {
      console.error('获取设备列表失败:', error)
      message.error(`获取设备列表失败: ${error.message}`)
      setLoading(false)
    }
  }

  // 解析ADB设备列表输出
  const parseDeviceList = (output: string): Device[] => {
    const lines = output.split('\n').filter(line => line.trim() && !line.includes('List of devices'))
    const devices: Device[] = []

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 2) continue

      const deviceId = parts[0]
      const status = parts[1] as Device['status']
      
      // 解析设备信息
      let model = '未知设备'
      let manufacturer = '未知'
      const connection = deviceId.includes(':') ? 'wifi' : 'usb'

      // 从详细信息中提取设备信息
      const detailInfo = parts.slice(2).join(' ')
      if (detailInfo.includes('model:')) {
        const modelMatch = detailInfo.match(/model:([^\s]+)/)
        if (modelMatch) {
          model = modelMatch[1].replace(/_/g, ' ')
        }
      }

      if (detailInfo.includes('device:')) {
        const deviceMatch = detailInfo.match(/device:([^\s]+)/)
        if (deviceMatch) {
          manufacturer = deviceMatch[1]
        }
      }

      devices.push({
        id: deviceId,
        model,
        status,
        connection,
        manufacturer,
        serialNumber: deviceId
      })
    }

    return devices
  }

  // 获取设备详细信息
  const getDeviceDetails = async (deviceId: string): Promise<Partial<Device>> => {
    try {
      const [androidVersionResult, apiLevelResult, manufacturerResult] = await Promise.all([
        window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.build.version.release`),
        window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.build.version.sdk`),
        window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.product.manufacturer`)
      ])

      return {
        androidVersion: androidVersionResult.success ? androidVersionResult.data?.trim() : undefined,
        apiLevel: apiLevelResult.success ? apiLevelResult.data?.trim() : undefined,
        manufacturer: manufacturerResult.success ? manufacturerResult.data?.trim() : undefined
      }
    } catch (error) {
      console.error('获取设备详细信息失败:', error)
      return {}
    }
  }

  const connectWifi = async () => {
    if (!wifiAddress) {
      message.error('请输入有效的IP地址')
      return
    }
    
    try {
      message.loading('正在连接...', 0)
      
      // 首先连接到设备
      const connectResult = await window.adbToolsAPI.execAdbCommand(`connect ${wifiAddress}`)
      
      if (!connectResult.success) {
        throw new Error(connectResult.error || '连接失败')
      }
      
      message.destroy()
      
      if (connectResult.data?.includes('connected') || connectResult.data?.includes('already connected')) {
        message.success(`WiFi连接成功: ${wifiAddress}`)
        setWifiModalVisible(false)
        setWifiAddress('')
        // 重新获取设备列表
        setTimeout(() => refreshDevices(), 1000)
      } else {
        throw new Error(connectResult.data || '连接失败')
      }
      
    } catch (error: any) {
      message.destroy()
      console.error('WiFi连接失败:', error)
      message.error(`WiFi连接失败: ${error.message}`)
    }
  }

  const selectDevice = (device: Device) => {
    setSelectedDevice(device)
    message.success(`已选择设备: ${device.model}`)
  }

  const getStatusTag = (status: Device['status']) => {
    switch (status) {
      case 'device':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已连接</Tag>
      case 'offline':
        return <Tag color="error" icon={<CloseCircleOutlined />}>离线</Tag>
      case 'unauthorized':
        return <Tag color="warning" icon={<WarningOutlined />}>未授权</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  const getConnectionIcon = (connection: Device['connection']) => {
    return connection === 'wifi' ? <WifiOutlined /> : <UsbOutlined />
  }

  const columns = [
    {
      title: '设备ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string, record: Device) => (
        <Space>
          {getConnectionIcon(record.connection)}
          <Text code>{id}</Text>
          {selectedDevice?.id === record.id && (
            <Tag color="blue">当前选中</Tag>
          )}
        </Space>
      )
    },
    {
      title: '设备型号',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer'
    },
    {
      title: 'Android版本',
      dataIndex: 'androidVersion',
      key: 'androidVersion',
      render: (version: string, record: Device) => 
        version ? `Android ${version} (API ${record.apiLevel})` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: Device['status']) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Device) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            onClick={() => setDetailDevice(record)}
          >
            详情
          </Button>
          {record.status === 'device' && (
            <Button 
              type={selectedDevice?.id === record.id ? "default" : "primary"}
              size="small"
              onClick={() => selectDevice(record)}
              disabled={selectedDevice?.id === record.id}
            >
              {selectedDevice?.id === record.id ? '已选中' : '选择'}
            </Button>
          )}
          {record.status === 'unauthorized' && (
            <Button type="link" size="small" danger>
              重新授权
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space size="middle">
          <Title level={4} style={{ margin: 0 }}>设备管理</Title>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            loading={loading}
            onClick={refreshDevices}
          >
            刷新设备
          </Button>
          <Button 
            icon={<WifiOutlined />}
            onClick={() => setWifiModalVisible(true)}
          >
            WiFi连接
          </Button>
        </Space>
      </div>

      {/* 当前选中设备信息 */}
      {selectedDevice && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6f8fa' }}>
          <Space>
            <Text strong>当前选中设备:</Text>
            {getConnectionIcon(selectedDevice.connection)}
            <Text>{selectedDevice.model}</Text>
            <Text code>{selectedDevice.id}</Text>
            {getStatusTag(selectedDevice.status)}
            {selectedDevice.androidVersion && (
              <Text type="secondary">Android {selectedDevice.androidVersion}</Text>
            )}
          </Space>
        </Card>
      )}

      {devices.length === 0 && !loading && (
        <Alert
          message="未发现设备"
          description="请确保已启用USB调试并连接设备，或通过WiFi连接设备"
          type="warning"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          rowClassName={(record) => 
            selectedDevice?.id === record.id ? 'selected-device-row' : ''
          }
        />
      </Card>

      {/* WiFi连接对话框 */}
      <Modal
        title="WiFi连接设备"
        open={wifiModalVisible}
        onOk={connectWifi}
        onCancel={() => {
          setWifiModalVisible(false)
          setWifiAddress('')
        }}
        okText="连接"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            请确保设备已启用WiFi调试，并输入设备的IP地址
          </Text>
          <Input
            placeholder="例如: 192.168.1.100"
            value={wifiAddress}
            onChange={(e: any) => setWifiAddress(e.target.value)}
            onPressEnter={connectWifi}
          />
        </Space>
      </Modal>

      {/* 设备详情对话框 */}
      <Modal
        title="设备详情"
        open={!!detailDevice}
        onCancel={() => setDetailDevice(null)}
        footer={[
          <Button key="close" onClick={() => setDetailDevice(null)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {detailDevice && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="设备ID" span={2}>
              <Text code>{detailDevice.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="设备型号">
              {detailDevice.model}
            </Descriptions.Item>
            <Descriptions.Item label="制造商">
              {detailDevice.manufacturer}
            </Descriptions.Item>
            <Descriptions.Item label="Android版本">
              {detailDevice.androidVersion ? 
                `Android ${detailDevice.androidVersion}` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="API级别">
              {detailDevice.apiLevel || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="连接方式">
              <Space>
                {getConnectionIcon(detailDevice.connection)}
                {detailDevice.connection === 'wifi' ? 'WiFi' : 'USB'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(detailDevice.status)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <style>{`
        .selected-device-row {
          background-color: #e6f7ff !important;
        }
        .selected-device-row:hover {
          background-color: #bae7ff !important;
        }
      `}</style>
    </div>
  )
}

export default DeviceManager 