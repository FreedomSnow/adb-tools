import React from 'react'
import { Select, Space, Tag, Typography, Alert } from 'antd'
import { 
  MobileOutlined, 
  WifiOutlined, 
  UsbOutlined, 
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'

const { Option } = Select
const { Text } = Typography

interface DeviceSelectorProps {
  style?: React.CSSProperties
  placeholder?: string
  showStatus?: boolean
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ 
  style, 
  placeholder = "请选择设备",
  showStatus = true 
}) => {
  const { selectedDevice, setSelectedDevice, devices } = useDevice()

  const getConnectionIcon = (connection: 'usb' | 'wifi' | 'ethernet') => {
    switch (connection) {
      case 'wifi':
        return <WifiOutlined />
      case 'ethernet':
        return <ApiOutlined />
      default:
        return <UsbOutlined />
    }
  }

  const getStatusTag = (status: 'device' | 'offline' | 'unauthorized') => {
    switch (status) {
      case 'device':
        return <Tag color="success" icon={<CheckCircleOutlined />}>在线</Tag>
      case 'offline':
        return <Tag color="error" icon={<CloseCircleOutlined />}>离线</Tag>
      case 'unauthorized':
        return <Tag color="warning" icon={<WarningOutlined />}>未授权</Tag>
      default:
        return <Tag>未知</Tag>
    }
  }

  const handleDeviceChange = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId)
    setSelectedDevice(device || null)
  }

  if (devices.length === 0) {
    return (
      <Alert
        message="未发现设备"
        description="请先在设备管理中连接设备"
        type="warning"
        showIcon
        style={style}
      />
    )
  }

  return (
    <div style={style}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>当前设备:</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            placeholder={placeholder}
            value={selectedDevice?.id}
            onChange={handleDeviceChange}
            optionLabelProp="label"
          >
            {devices.map(device => (
              <Option 
                key={device.id} 
                value={device.id}
                label={device.model}
                disabled={device.status !== 'device'}
              >
                <Space>
                  {getConnectionIcon(device.connection)}
                  <MobileOutlined />
                  <span>{device.model}</span>
                  {getStatusTag(device.status)}
                </Space>
              </Option>
            ))}
          </Select>
        </div>
        
        {showStatus && selectedDevice && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#f6f8fa', 
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <Space>
              <Text type="secondary">设备ID:</Text>
              <Text code>{selectedDevice.id}</Text>
              {getStatusTag(selectedDevice.status)}
              <Text type="secondary">
                {selectedDevice.androidVersion && `Android ${selectedDevice.androidVersion}`}
              </Text>
            </Space>
          </div>
        )}
        
        {!selectedDevice && devices.length > 0 && (
          <Alert
            message="请选择要操作的设备"
            type="info"
            showIcon
          />
        )}
      </Space>
    </div>
  )
}

export default DeviceSelector 