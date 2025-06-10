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
  Divider,
  Tooltip,
  Spin
} from 'antd'
import { 
  ReloadOutlined, 
  WifiOutlined, 
  UsbOutlined, 
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { useDevice, Device } from '../contexts/DeviceContext'

const { Title, Text } = Typography
const { Search } = Input

const DeviceManager: React.FC = () => {
  const { devices, setDevices, selectedDevice, setSelectedDevice } = useDevice()
  const [loading, setLoading] = useState(false)
  const [detailDevice, setDetailDevice] = useState<Device | null>(null)
  const [wifiModalVisible, setWifiModalVisible] = useState(false)
  const [ethernetModalVisible, setEthernetModalVisible] = useState(false)
  const [wifiAddress, setWifiAddress] = useState('')
  const [ethernetAddress, setEthernetAddress] = useState('')
  const [restartingAdb, setRestartingAdb] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [enablingWifiDebug, setEnablingWifiDebug] = useState(false)
  const [enablingEthernetDebug, setEnablingEthernetDebug] = useState(false)
  const [hardwareInfoModalVisible, setHardwareInfoModalVisible] = useState(false)
  const [selectedDeviceInfo, setSelectedDeviceInfo] = useState<Record<string, string>>({})
  const [loadingHardwareInfo, setLoadingHardwareInfo] = useState(false)

  useEffect(() => {
    console.log('DeviceManager组件已挂载，开始初始化刷新设备列表...')
    // 延迟一小段时间确保组件完全加载
    const timer = setTimeout(() => {
      refreshDevices()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  const refreshDevices = async () => {
    console.log('开始刷新设备列表...')
    setLoading(true)
    
    try {
      console.log('调用 getDevices API')
      const result = await window.adbToolsAPI.getDevices()
      
      console.log('获取设备列表结果:', result)
      
      if (!result.success) {
        throw new Error(result.error || '获取设备列表失败')
      }

      const devices = parseDeviceList(result.data || '')
      console.log('解析到的设备:', devices)
      
      // 为在线设备获取详细信息，但限制并发避免卡顿
      const devicesWithDetails = []
      for (const device of devices) {
        if (device.status === 'device') {
          try {
            console.log(`获取设备 ${device.id} 的详细信息...`)
            const details = await getDeviceDetails(device.id)
            devicesWithDetails.push({ ...device, ...details })
          } catch (error) {
            console.warn(`获取设备 ${device.id} 详细信息失败:`, error)
            devicesWithDetails.push(device)
          }
        } else {
          devicesWithDetails.push(device)
        }
      }
      
      console.log('设备详细信息获取完成:', devicesWithDetails)
      setDevices(devicesWithDetails)
      
      // 如果没有选中的设备，自动选择第一个在线设备
      if (!selectedDevice) {
        const firstOnlineDevice = devicesWithDetails.find(device => device.status === 'device')
        if (firstOnlineDevice) {
          console.log('自动选择设备:', firstOnlineDevice)
          setSelectedDevice(firstOnlineDevice)
        }
      }
      
      setLoading(false)
      console.log('设备列表刷新完成')
      
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

  // 获取设备详细信息 - 串行执行避免队列阻塞
  const getDeviceDetails = async (deviceId: string): Promise<Partial<Device>> => {
    try {
      console.log(`串行获取设备 ${deviceId} 的详细信息...`)
      
      // 串行执行命令，避免队列阻塞
      const androidVersionResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.build.version.release`)
      await new Promise(resolve => setTimeout(resolve, 50)) // 小延迟
      
      const apiLevelResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.build.version.sdk`)
      await new Promise(resolve => setTimeout(resolve, 50)) // 小延迟
      
      const manufacturerResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell getprop ro.product.manufacturer`)

      console.log(`设备 ${deviceId} 详细信息获取完成`)

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
      // 确保地址包含端口号，如果没有则添加默认端口5555
      let fullAddress = wifiAddress.trim()
      if (!fullAddress.includes(':')) {
        fullAddress = `${fullAddress}:5555`
      }
      
      message.loading('正在连接设备...', 0)
      
      console.log(`尝试连接到: ${fullAddress}`)
      
      // 首先尝试连接到设备
      const connectResult = await window.adbToolsAPI.execAdbCommand(`connect ${fullAddress}`)
      
      console.log('连接结果:', connectResult)
      
      if (!connectResult.success) {
        message.destroy()
        // 提供更详细的错误信息
        let errorMsg = connectResult.error || '连接失败'
        
        if (errorMsg.includes('cannot connect')) {
          errorMsg = `无法连接到 ${fullAddress}。请检查：\n1. 设备和电脑是否在同一WiFi网络\n2. 设备是否已开启WiFi调试\n3. IP地址是否正确`
        } else if (errorMsg.includes('Connection refused')) {
          errorMsg = `连接被拒绝。请确保设备已执行 'adb tcpip 5555' 命令开启WiFi调试`
        }
        
        throw new Error(errorMsg)
      }
      
      message.destroy()
      
      const resultData = connectResult.data?.toLowerCase() || ''
      
      if (resultData.includes('connected') || resultData.includes('already connected')) {
        message.success(`WiFi连接成功: ${fullAddress}`)
        setWifiModalVisible(false)
        setWifiAddress('')
        // 重新获取设备列表
        setTimeout(() => refreshDevices(), 1500)
      } else if (resultData.includes('failed')) {
        throw new Error(`连接失败: ${connectResult.data}`)
      } else {
        // 有时连接成功但消息不明确，尝试检查设备列表
        message.loading('验证连接状态...', 0)
        setTimeout(async () => {
          try {
            await refreshDevices()
            const connectedDevice = devices.find(d => d.id.includes(fullAddress.split(':')[0]))
            message.destroy()
            
            if (connectedDevice) {
              message.success(`WiFi连接成功: ${fullAddress}`)
              setWifiModalVisible(false)
              setWifiAddress('')
            } else {
              message.warning(`连接可能失败，请检查设备列表或重试`)
            }
          } catch (e) {
            message.destroy()
            message.error('连接状态验证失败')
          }
        }, 2000)
      }
      
    } catch (error: any) {
      message.destroy()
      console.error('WiFi连接失败:', error)
      message.error({
        content: `WiFi连接失败: ${error.message}`,
        duration: 6
      })
    }
  }

  const connectEthernet = async () => {
    if (!ethernetAddress) {
      message.error('请输入有效的IP地址')
      return
    }
    
    try {
      // 确保地址包含端口号，如果没有则添加默认端口5555
      let fullAddress = ethernetAddress.trim()
      if (!fullAddress.includes(':')) {
        fullAddress = `${fullAddress}:5555`
      }
      
      message.loading('正在连接设备...', 0)
      
      console.log(`尝试连接到: ${fullAddress}`)
      
      // 首先尝试连接到设备
      const connectResult = await window.adbToolsAPI.execAdbCommand(`connect ${fullAddress}`)
      
      console.log('连接结果:', connectResult)
      
      if (!connectResult.success) {
        message.destroy()
        // 提供更详细的错误信息
        let errorMsg = connectResult.error || '连接失败'
        
        if (errorMsg.includes('cannot connect')) {
          errorMsg = `无法连接到 ${fullAddress}。请检查：\n1. 设备和电脑是否在同一网络\n2. 设备是否已开启网络调试\n3. IP地址是否正确`
        } else if (errorMsg.includes('Connection refused')) {
          errorMsg = `连接被拒绝。请确保设备已执行 'adb tcpip 5555' 命令开启网络调试`
        }
        
        throw new Error(errorMsg)
      }
      
      message.destroy()
      
      const resultData = connectResult.data?.toLowerCase() || ''
      
      if (resultData.includes('connected') || resultData.includes('already connected')) {
        message.success(`以太网连接成功: ${fullAddress}`)
        setEthernetModalVisible(false)
        setEthernetAddress('')
        // 重新获取设备列表
        setTimeout(() => refreshDevices(), 1500)
      } else if (resultData.includes('failed')) {
        throw new Error(`连接失败: ${connectResult.data}`)
      } else {
        // 有时连接成功但消息不明确，尝试检查设备列表
        message.loading('验证连接状态...', 0)
        setTimeout(async () => {
          try {
            await refreshDevices()
            const connectedDevice = devices.find(d => d.id.includes(fullAddress.split(':')[0]))
            message.destroy()
            
            if (connectedDevice) {
              message.success(`以太网连接成功: ${fullAddress}`)
              setEthernetModalVisible(false)
              setEthernetAddress('')
            } else {
              message.warning(`连接可能失败，请检查设备列表或重试`)
            }
          } catch (e) {
            message.destroy()
            message.error('连接状态验证失败')
          }
        }, 2000)
      }
      
    } catch (error: any) {
      message.destroy()
      console.error('以太网连接失败:', error)
      message.error({
        content: `以太网连接失败: ${error.message}`,
        duration: 6
      })
    }
  }

  const selectDevice = (device: Device) => {
    setSelectedDevice(device)
    message.success(`已选择设备: ${device.model}`)
  }

  const restartAdbServer = async () => {
    setRestartingAdb(true)
    try {
      message.loading('正在重启ADB服务器...', 0)
      
      const result = await window.adbToolsAPI.restartAdbServer()
      
      message.destroy()
      
      if (result.success) {
        message.success('ADB服务器重启成功')
        // 重启后自动刷新设备列表
        setTimeout(() => refreshDevices(), 1000)
      } else {
        throw new Error(result.error || 'ADB服务器重启失败')
      }
    } catch (error: any) {
      message.destroy()
      console.error('重启ADB服务器失败:', error)
      message.error(`重启ADB服务器失败: ${error.message}`)
    } finally {
      setRestartingAdb(false)
    }
  }

  const enableWifiDebug = async () => {
    setEnablingWifiDebug(true)
    
    try {
      message.loading('正在启用WiFi调试...', 0)
      
      // 首先检查是否有USB连接的设备
      const deviceListResult = await window.adbToolsAPI.execAdbCommand('devices')
      
      if (!deviceListResult.success) {
        throw new Error('无法获取设备列表')
      }
      
      const deviceLines = deviceListResult.data?.split('\n').filter(line => 
        line.trim() && !line.includes('List of devices') && line.includes('device')
      ) || []
      
      const usbDevices = deviceLines.filter(line => !line.includes(':'))
      
      if (usbDevices.length === 0) {
        message.destroy()
        message.error('未检测到USB连接的设备，请先通过USB连接设备并启用USB调试')
        return
      }
      
      // 如果有多个USB设备，使用第一个
      const deviceId = usbDevices[0].split('\t')[0]
      
      console.log(`对设备 ${deviceId} 启用WiFi调试...`)
      
      // 执行 adb tcpip 5555
      const tcpipResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} tcpip 5555`)
      
      message.destroy()
      
      if (tcpipResult.success) {
        message.success({
          content: (
            <div>
              <div>✅ WiFi调试已成功启用！</div>
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                现在可以断开USB线，然后输入设备IP地址进行WiFi连接
              </div>
            </div>
          ),
          duration: 5
        })
        
        // 刷新设备列表
        setTimeout(() => refreshDevices(), 1000)
      } else {
        throw new Error(tcpipResult.error || 'WiFi调试启用失败')
      }
      
    } catch (error: any) {
      message.destroy()
      console.error('启用WiFi调试失败:', error)
      message.error(`启用WiFi调试失败: ${error.message}`)
    } finally {
      setEnablingWifiDebug(false)
    }
  }

  const enableEthernetDebug = async () => {
    setEnablingEthernetDebug(true)
    
    try {
      message.loading('正在启用网络调试...', 0)
      
      // 首先检查是否有USB连接的设备
      const deviceListResult = await window.adbToolsAPI.execAdbCommand('devices')
      
      if (!deviceListResult.success) {
        throw new Error('无法获取设备列表')
      }
      
      const deviceLines = deviceListResult.data?.split('\n').filter(line => 
        line.trim() && !line.includes('List of devices') && line.includes('device')
      ) || []
      
      const usbDevices = deviceLines.filter(line => !line.includes(':'))
      
      if (usbDevices.length === 0) {
        message.destroy()
        message.error('未检测到USB连接的设备，请先通过USB连接设备并启用USB调试')
        return
      }
      
      // 如果有多个USB设备，使用第一个
      const deviceId = usbDevices[0].split('\t')[0]
      
      console.log(`对设备 ${deviceId} 启用网络调试...`)
      
      // 执行 adb tcpip 5555
      const tcpipResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} tcpip 5555`)
      
      message.destroy()
      
      if (tcpipResult.success) {
        message.success({
          content: (
            <div>
              <div>✅ 网络调试已成功启用！</div>
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                现在可以断开USB线，然后输入设备IP地址进行网络连接
              </div>
            </div>
          ),
          duration: 5
        })
        
        // 刷新设备列表
        setTimeout(() => refreshDevices(), 1000)
      } else {
        throw new Error(tcpipResult.error || '网络调试启用失败')
      }
      
    } catch (error: any) {
      message.destroy()
      console.error('启用网络调试失败:', error)
      message.error(`启用网络调试失败: ${error.message}`)
    } finally {
      setEnablingEthernetDebug(false)
    }
  }

  const diagnoseWifiConnection = async () => {
    if (!wifiAddress) {
      message.error('请先输入IP地址')
      return
    }
    
    setDiagnosing(true)
    const hideMessage = message.loading('正在诊断网络连接...', 0)
    
    try {
      const ip = wifiAddress.trim().split(':')[0]
      const diagnosisResults: string[] = []
      
      // 1. 检查ADB服务器状态
      const serverStatus = await window.adbToolsAPI.execAdbCommand('version')
      if (serverStatus.success) {
        diagnosisResults.push('✅ ADB服务器运行正常')
      } else {
        diagnosisResults.push('❌ ADB服务器异常')
      }
      
      // 2. 尝试ping测试 (通过adb shell，如果有USB连接的设备)
      const deviceList = await window.adbToolsAPI.execAdbCommand('devices')
      const hasUsbDevice = deviceList.success && deviceList.data?.includes('device')
      
      if (hasUsbDevice) {
        diagnosisResults.push('✅ 检测到USB连接的设备，可用于启用WiFi调试')
      } else {
        diagnosisResults.push('⚠️ 未检测到USB连接的设备')
      }
      
      // 3. 检查端口连接
      const portCheck = await window.adbToolsAPI.execAdbCommand(`connect ${ip}:5555`)
      if (portCheck.success) {
        if (portCheck.data?.toLowerCase().includes('connected')) {
          diagnosisResults.push('✅ 端口5555连接成功')
        } else if (portCheck.data?.toLowerCase().includes('refused')) {
          diagnosisResults.push('❌ 端口5555连接被拒绝 - 设备可能未开启WiFi调试')
        } else {
          diagnosisResults.push(`⚠️ 连接状态不明确: ${portCheck.data}`)
        }
      } else {
        diagnosisResults.push(`❌ 无法连接到端口5555: ${portCheck.error}`)
      }
      
      hideMessage()
      
      // 显示诊断结果
      Modal.info({
        title: `网络诊断结果 - ${ip}:5555`,
        content: (
          <div>
            {diagnosisResults.map((result, index) => (
              <div key={index} style={{ marginBottom: 8 }}>
                {result}
              </div>
            ))}
            <Divider />
            <div>
              <Text strong>建议操作：</Text>
              <br />
              {!hasUsbDevice && <Text>1. 首先通过USB连接设备并启用USB调试</Text>}
              <br />
              <Text>2. 执行命令: adb tcpip 5555</Text>
              <br />
              <Text>3. 确认设备IP地址正确</Text>
              <br />
              <Text>4. 检查防火墙是否阻止5555端口</Text>
            </div>
          </div>
        ),
        width: 500
      })
      
    } catch (error: any) {
      hideMessage()
      console.error('网络诊断失败:', error)
      message.error(`网络诊断失败: ${error.message}`)
    } finally {
      setDiagnosing(false)
    }
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
    switch (connection) {
      case 'wifi':
        return <WifiOutlined />
      case 'ethernet':
        return <ApiOutlined />
      default:
        return <UsbOutlined />
    }
  }

  const getDeviceHardwareInfo = async (deviceId: string) => {
    setLoadingHardwareInfo(true)
    try {
      const commands = {
        'Android系统版本': 'shell getprop ro.build.version.release',
        'SDK版本': 'shell getprop ro.build.version.sdk',
        '构建号': 'shell getprop ro.build.id',
        '品牌': 'shell getprop ro.product.brand',
        '型号': 'shell getprop ro.product.model',
        '设备名': 'shell getprop ro.product.device',
        '构架/ABI': 'shell getprop ro.product.cpu.abi',
        'CPU信息': 'shell cat /proc/cpuinfo | grep "Hardware" | cut -d: -f2',
        '内存信息': 'shell cat /proc/meminfo | grep "MemTotal" | cut -d: -f2',
        '屏幕分辨率': 'shell wm size',
        '屏幕密度': 'shell wm density',
        '电池状态': 'shell dumpsys battery | grep "level" | cut -d: -f2'
      }

      const info: Record<string, string> = {}
      
      for (const [key, command] of Object.entries(commands)) {
        const result = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} ${command}`)
        if (result.success) {
          info[key] = result.data?.trim() || '-'
        } else {
          info[key] = '-'
        }
      }

      setSelectedDeviceInfo(info)
    } catch (error) {
      console.error('获取设备硬件信息失败:', error)
      message.error('获取设备硬件信息失败')
    } finally {
      setLoadingHardwareInfo(false)
    }
  }

  const copyToClipboard = (key: string, value: string) => {
    const text = `${key}：${value}`
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板')
    }).catch(() => {
      message.error('复制失败')
    })
  }

  const columns = [
    {
      title: '设备序列号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
      render: (serial: string) => <Text code>{serial}</Text>
    },
    {
      title: '设备名',
      dataIndex: 'model',
      key: 'model'
    },
    {
      title: '连接方式',
      dataIndex: 'connection',
      key: 'connection',
      render: (connection: Device['connection']) => (
        <Space>
          {getConnectionIcon(connection)}
          {connection === 'wifi' ? 'WiFi' : connection === 'ethernet' ? '以太网' : 'USB'}
        </Space>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Device) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            onClick={() => {
              setDetailDevice(record)
            }}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small"
            onClick={async () => {
              await getDeviceHardwareInfo(record.id)
              setHardwareInfoModalVisible(true)
            }}
          >
            软硬件信息
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
          <Button 
            icon={<ApiOutlined />}
            onClick={() => setEthernetModalVisible(true)}
          >
            以太网连接
          </Button>
          <Button 
            icon={<SettingOutlined />}
            loading={restartingAdb}
            onClick={restartAdbServer}
            title="当设备列表加载失败时，可以尝试重启ADB服务器"
          >
            重启ADB服务器
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
        width={600}
        footer={[
          <Button 
            key="enable-wifi" 
            icon={<ThunderboltOutlined />}
            loading={enablingWifiDebug}
            onClick={enableWifiDebug}
            title="对USB连接的设备执行 adb tcpip 5555 启用WiFi调试"
          >
            启用WiFi调试
          </Button>,
          <Button 
            key="diagnose" 
            loading={diagnosing}
            onClick={diagnoseWifiConnection}
          >
            网络诊断
          </Button>,
          <Button 
            key="cancel" 
            onClick={() => {
              setWifiModalVisible(false)
              setWifiAddress('')
            }}
          >
            取消
          </Button>,
          <Button 
            key="connect" 
            type="primary" 
            onClick={connectWifi}
            disabled={!wifiAddress}
          >
            连接
          </Button>
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="WiFi调试连接步骤"
            description={
              <div>
                <Text>1. 确保设备和电脑连接在同一WiFi网络</Text><br/>
                <Text>2. 在设备上打开开发者选项，启用"USB调试"</Text><br/>
                <Text>3. 通过USB连接设备，点击下方"启用WiFi调试"按钮</Text><br/>
                <Text>   <Text type="secondary">(等同于执行命令：adb tcpip 5555)</Text></Text><br/>
                <Text>4. 在设备的设置 → 关于手机 → 状态信息中查看IP地址</Text><br/>
                <Text>5. 输入IP地址进行WiFi连接</Text>
              </div>
            }
            type="info"
            showIcon
          />
          
          <div>
            <Text strong>设备IP地址:</Text>
            <Input
              placeholder="例如: 192.168.1.100 或 172.17.4.111"
              value={wifiAddress}
              onChange={(e: any) => setWifiAddress(e.target.value)}
              onPressEnter={connectWifi}
              style={{ marginTop: 8 }}
              suffix={
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  :5555
                </Text>
              }
            />
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
              如果不包含端口号，将自动添加 :5555
            </Text>
          </div>

          <Alert
            message="常见问题"
            description={
              <div>
                <Text type="secondary">• 连接被拒绝：请确保已执行 adb tcpip 5555</Text><br/>
                <Text type="secondary">• 无法连接：检查防火墙设置和网络连接</Text><br/>
                <Text type="secondary">• IP地址错误：在设备设置中确认正确的IP地址</Text>
              </div>
            }
            type="warning"
            showIcon
          />
        </Space>
      </Modal>

      {/* 以太网连接对话框 */}
      <Modal
        title="以太网连接设备"
        open={ethernetModalVisible}
        onOk={connectEthernet}
        onCancel={() => {
          setEthernetModalVisible(false)
          setEthernetAddress('')
        }}
        okText="连接"
        cancelText="取消"
        width={600}
        footer={[
          <Button 
            key="enable-ethernet" 
            icon={<ThunderboltOutlined />}
            loading={enablingEthernetDebug}
            onClick={enableEthernetDebug}
            title="对USB连接的设备执行 adb tcpip 5555 启用网络调试"
          >
            启用网络调试
          </Button>,
          <Button 
            key="diagnose" 
            loading={diagnosing}
            onClick={diagnoseWifiConnection}
          >
            网络诊断
          </Button>,
          <Button 
            key="cancel" 
            onClick={() => {
              setEthernetModalVisible(false)
              setEthernetAddress('')
            }}
          >
            取消
          </Button>,
          <Button 
            key="connect" 
            type="primary" 
            onClick={connectEthernet}
            disabled={!ethernetAddress}
          >
            连接
          </Button>
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="以太网调试连接步骤"
            description={
              <div>
                <Text>1. 确保设备和电脑连接在同一网络</Text><br/>
                <Text>2. 在设备上打开开发者选项，启用"USB调试"</Text><br/>
                <Text>3. 通过USB连接设备，点击下方"启用网络调试"按钮</Text><br/>
                <Text>   <Text type="secondary">(等同于执行命令：adb tcpip 5555)</Text></Text><br/>
                <Text>4. 在设备的设置 → 关于手机 → 状态信息中查看IP地址</Text><br/>
                <Text>5. 输入IP地址进行网络连接</Text>
              </div>
            }
            type="info"
            showIcon
          />
          
          <div>
            <Text strong>设备IP地址:</Text>
            <Input
              placeholder="例如: 192.168.1.100 或 172.17.4.111"
              value={ethernetAddress}
              onChange={(e: any) => setEthernetAddress(e.target.value)}
              onPressEnter={connectEthernet}
              style={{ marginTop: 8 }}
              suffix={
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  :5555
                </Text>
              }
            />
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
              如果不包含端口号，将自动添加 :5555
            </Text>
          </div>

          <Alert
            message="常见问题"
            description={
              <div>
                <Text type="secondary">• 连接被拒绝：请确保已执行 adb tcpip 5555</Text><br/>
                <Text type="secondary">• 无法连接：检查防火墙设置和网络连接</Text><br/>
                <Text type="secondary">• IP地址错误：在设备设置中确认正确的IP地址</Text>
              </div>
            }
            type="warning"
            showIcon
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
                {detailDevice.connection === 'wifi' ? 'WiFi' : detailDevice.connection === 'ethernet' ? '以太网' : 'USB'}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {getStatusTag(detailDevice.status)}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 软硬件信息对话框 */}
      <Modal
        title="设备软硬件信息"
        open={hardwareInfoModalVisible}
        onCancel={() => setHardwareInfoModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHardwareInfoModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        <Spin spinning={loadingHardwareInfo}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {Object.entries(selectedDeviceInfo).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{key}:</Text>
                <Space>
                  <Text>{value}</Text>
                  <Tooltip title="复制">
                    <Button 
                      type="text" 
                      icon={<CopyOutlined />} 
                      size="small"
                      onClick={() => copyToClipboard(key, value)}
                    />
                  </Tooltip>
                </Space>
              </div>
            ))}
          </Space>
        </Spin>
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