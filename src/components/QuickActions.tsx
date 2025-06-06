import React, { useState } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Typography,
  message,
  Row,
  Col,
  Modal,
  Input,
  Descriptions,
  Tag,
  Alert
} from 'antd'
import {
  MobileOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  WifiOutlined,
  CameraOutlined,
  FolderOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  MonitorOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ClearOutlined,
  PhoneOutlined,
  GlobalOutlined,
  BugOutlined,
  ToolOutlined,
  RocketOutlined,
  SafetyOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  category: string
  action: () => void
  color?: string
}

const QuickActions: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [loading, setLoading] = useState<string | null>(null)
  const [resultModalVisible, setResultModalVisible] = useState(false)
  const [commandResult, setCommandResult] = useState<{ title: string; content: string; success: boolean } | null>(null)

  const executeCommand = async (title: string, command: string, successMessage?: string) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setLoading(title)
    try {
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} ${command}`)
      
      if (result.success) {
        setCommandResult({
          title: `${title} - 执行成功`,
          content: result.data || successMessage || '操作完成',
          success: true
        })
        setResultModalVisible(true)
        message.success(successMessage || `${title} 执行成功`)
      } else {
        throw new Error(result.error || '执行失败')
      }
    } catch (error: any) {
      setCommandResult({
        title: `${title} - 执行失败`,
        content: error.message,
        success: false
      })
      setResultModalVisible(true)
      message.error(`${title} 失败: ${error.message}`)
    } finally {
      setLoading(null)
    }
  }

  const showConfirmDialog = (title: string, content: string, onConfirm: () => void) => {
    Modal.confirm({
      title,
      content,
      okText: '确认',
      okType: 'danger',
      cancelText: '取消',
      onOk: onConfirm
    })
  }

  const quickActions: QuickAction[] = [
    // 设备管理
    {
      id: 'reboot',
      title: '重启设备',
      description: '重新启动Android设备',
      icon: <PoweroffOutlined />,
      category: '设备管理',
      color: '#ff4d4f',
      action: () => showConfirmDialog(
        '确认重启设备',
        `确定要重启设备 "${selectedDevice?.model}" 吗？`,
        () => executeCommand('重启设备', 'reboot', '设备正在重启...')
      )
    },
    {
      id: 'reboot-bootloader',
      title: '进入Bootloader',
      description: '重启到Bootloader模式',
      icon: <ToolOutlined />,
      category: '设备管理',
      color: '#fa8c16',
      action: () => showConfirmDialog(
        '确认进入Bootloader',
        '设备将重启到Bootloader模式，请确认操作',
        () => executeCommand('进入Bootloader', 'reboot bootloader', '设备正在进入Bootloader模式...')
      )
    },
    {
      id: 'reboot-recovery',
      title: '进入Recovery',
      description: '重启到Recovery模式',
      icon: <SafetyOutlined />,
      category: '设备管理',
      color: '#fa541c',
      action: () => showConfirmDialog(
        '确认进入Recovery',
        '设备将重启到Recovery模式，请确认操作',
        () => executeCommand('进入Recovery', 'reboot recovery', '设备正在进入Recovery模式...')
      )
    },

    // 屏幕管理
    {
      id: 'screenshot',
      title: '截取屏幕',
      description: '保存当前屏幕截图到设备',
      icon: <CameraOutlined />,
      category: '屏幕管理',
      color: '#1890ff',
      action: () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        executeCommand('截取屏幕', `shell screencap /sdcard/screenshot_${timestamp}.png`, '屏幕截图已保存到 /sdcard/')
      }
    },
    {
      id: 'screen-on',
      title: '唤醒屏幕',
      description: '点亮设备屏幕',
      icon: <EyeOutlined />,
      category: '屏幕管理',
      color: '#52c41a',
      action: () => executeCommand('唤醒屏幕', 'shell input keyevent KEYCODE_WAKEUP', '屏幕已唤醒')
    },
    {
      id: 'screen-off',
      title: '关闭屏幕',
      description: '关闭设备屏幕',
      icon: <PoweroffOutlined />,
      category: '屏幕管理',
      color: '#8c8c8c',
      action: () => executeCommand('关闭屏幕', 'shell input keyevent KEYCODE_POWER', '屏幕已关闭')
    },

    // 系统操作
    {
      id: 'clear-cache',
      title: '清理缓存',
      description: '清理系统缓存分区',
      icon: <ClearOutlined />,
      category: '系统操作',
      color: '#722ed1',
      action: () => showConfirmDialog(
        '确认清理缓存',
        '将清理系统缓存，可能需要一些时间',
        () => executeCommand('清理缓存', 'shell pm trim-caches 1000000000', '缓存清理完成')
      )
    },
    {
      id: 'kill-server',
      title: '重启ADB服务',
      description: '重启ADB服务',
      icon: <ReloadOutlined />,
      category: '系统操作',
      color: '#13c2c2',
      action: () => executeCommand('重启ADB服务', 'kill-server && start-server', 'ADB服务已重启')
    },
    {
      id: 'enable-usb-debug',
      title: '启用USB调试',
      description: '启用开发者选项中的USB调试',
      icon: <BugOutlined />,
      category: '系统操作',
      color: '#eb2f96',
      action: () => executeCommand('启用USB调试', 'shell settings put global adb_enabled 1', 'USB调试已启用')
    },

    // 网络工具
    {
      id: 'wifi-info',
      title: '查看WiFi信息',
      description: '获取当前WiFi连接信息',
      icon: <WifiOutlined />,
      category: '网络工具',
      color: '#1890ff',
      action: () => executeCommand('WiFi信息', 'shell dumpsys wifi | grep "mWifiInfo"')
    },
    {
      id: 'ip-info',
      title: '查看IP地址',
      description: '获取设备IP地址信息',
      icon: <GlobalOutlined />,
      category: '网络工具',
      color: '#52c41a',
      action: () => executeCommand('IP地址', 'shell ip addr show wlan0')
    },
    {
      id: 'network-stats',
      title: '网络统计',
      description: '查看网络使用统计',
      icon: <MonitorOutlined />,
      category: '网络工具',
      color: '#fa8c16',
      action: () => executeCommand('网络统计', 'shell cat /proc/net/dev')
    },

    // 文件操作
    {
      id: 'list-sdcard',
      title: '浏览存储卡',
      description: '列出SD卡根目录内容',
      icon: <FolderOutlined />,
      category: '文件操作',
      color: '#1890ff',
      action: () => executeCommand('存储卡内容', 'shell ls -la /sdcard/')
    },
    {
      id: 'storage-info',
      title: '存储空间',
      description: '查看存储空间使用情况',
      icon: <DatabaseOutlined />,
      category: '文件操作',
      color: '#52c41a',
      action: () => executeCommand('存储空间', 'shell df -h')
    },
    {
      id: 'temp-files',
      title: '清理临时文件',
      description: '清理/tmp目录下的临时文件',
      icon: <ClearOutlined />,
      category: '文件操作',
      color: '#fa541c',
      action: () => showConfirmDialog(
        '确认清理临时文件',
        '将清理/tmp目录下的文件',
        () => executeCommand('清理临时文件', 'shell rm -rf /tmp/*', '临时文件清理完成')
      )
    },

    // 应用管理
    {
      id: 'running-apps',
      title: '运行中应用',
      description: '查看当前运行的应用',
      icon: <AppstoreOutlined />,
      category: '应用管理',
      color: '#1890ff',
      action: () => executeCommand('运行中应用', 'shell ps | grep u0_a')
    },
    {
      id: 'force-stop-all',
      title: '停止所有应用',
      description: '强制停止所有用户应用',
      icon: <PoweroffOutlined />,
      category: '应用管理',
      color: '#ff4d4f',
      action: () => showConfirmDialog(
        '确认停止所有应用',
        '将强制停止所有用户应用，可能影响正在使用的应用',
        () => executeCommand('停止所有应用', 'shell am kill-all', '所有应用已停止')
      )
    },

    // 系统信息
    {
      id: 'cpu-info',
      title: 'CPU信息',
      description: '查看处理器详细信息',
      icon: <ThunderboltOutlined />,
      category: '系统信息',
      color: '#fa8c16',
      action: () => executeCommand('CPU信息', 'shell cat /proc/cpuinfo')
    },
    {
      id: 'memory-info',
      title: '内存信息',
      description: '查看内存使用情况',
      icon: <MonitorOutlined />,
      category: '系统信息',
      color: '#52c41a',
      action: () => executeCommand('内存信息', 'shell cat /proc/meminfo')
    },
    {
      id: 'battery-info',
      title: '电池信息',
      description: '查看电池状态和电量',
      icon: <ThunderboltOutlined />,
      category: '系统信息',
      color: '#13c2c2',
      action: () => executeCommand('电池信息', 'shell dumpsys battery')
    }
  ]

  const categories = ['设备管理', '屏幕管理', '系统操作', '网络工具', '文件操作', '应用管理', '系统信息']

  const renderActionCard = (action: QuickAction) => (
    <Card
      key={action.id}
      size="small"
      hoverable
      style={{ 
        height: '100%',
        borderColor: action.color,
        cursor: !selectedDevice || selectedDevice.status !== 'device' ? 'not-allowed' : 'pointer'
      }}
      bodyStyle={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between',
        height: '120px',
        opacity: !selectedDevice || selectedDevice.status !== 'device' ? 0.5 : 1
      }}
      onClick={() => {
        if (selectedDevice && selectedDevice.status === 'device') {
          action.action()
        } else {
          message.error('请先选择可用设备')
        }
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', color: action.color, marginBottom: '8px' }}>
          {action.icon}
        </div>
        <Text strong style={{ fontSize: '14px' }}>{action.title}</Text>
      </div>
      <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center' }}>
        {action.description}
      </Text>
      {loading === action.title && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(255,255,255,0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          <Text type="secondary">执行中...</Text>
        </div>
      )}
    </Card>
  )

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>快捷操作</Title>
        <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
          常用的Android设备管理和调试操作，点击即可快速执行
        </Paragraph>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {!selectedDevice && (
        <Alert
          message="请先选择设备"
          description="快捷操作需要选择一个已连接的设备才能使用"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 快捷操作按分类展示 */}
      {categories.map(category => {
        const categoryActions = quickActions.filter(action => action.category === category)
        
        return (
          <Card
            key={category}
            title={
              <Space>
                <SettingOutlined />
                <span>{category}</span>
                <Tag color="blue">{categoryActions.length}</Tag>
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[12, 12]}>
              {categoryActions.map(action => (
                <Col key={action.id} xs={24} sm={12} md={8} lg={6} xl={4}>
                  {renderActionCard(action)}
                </Col>
              ))}
            </Row>
          </Card>
        )
      })}

      {/* 操作结果对话框 */}
      <Modal
        title={commandResult?.title}
        open={resultModalVisible}
        onCancel={() => {
          setResultModalVisible(false)
          setCommandResult(null)
        }}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {commandResult && (
          <div>
            <Alert
              type={commandResult.success ? 'success' : 'error'}
              message={commandResult.success ? '执行成功' : '执行失败'}
              style={{ marginBottom: 16 }}
            />
            <TextArea
              value={commandResult.content}
              readOnly
              rows={15}
              style={{ 
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '12px'
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default QuickActions 