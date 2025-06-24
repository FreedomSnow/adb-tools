import React, { useState, useEffect } from 'react'
import { Modal, Typography, Space, Avatar, Tag, Button, message, Spin } from 'antd'
import { AndroidOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { AppInfo } from '@/types/app'

const { Title, Text } = Typography

interface UninstallConfirmModalProps {
  visible: boolean
  packageName: string | null
  deviceId: string | null
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}

const UninstallConfirmModal: React.FC<UninstallConfirmModalProps> = ({
  visible,
  packageName,
  deviceId,
  onCancel,
  onConfirm,
  loading
}) => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [appLoading, setAppLoading] = useState(false)

  // 根据packageName查询app详情
  const fetchAppInfo = async () => {
    if (!packageName || !deviceId) return

    setAppLoading(true)
    try {
      // 获取应用详细信息
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell dumpsys package ${packageName}`)
      if (result.success && result.data) {
        const dumpData = result.data
        
        // 解析应用信息
        const appInfo: AppInfo = {
          packageName,
          appName: packageName, // 默认使用包名
          versionName: '',
          versionCode: '',
          isSystem: false,
          isRunning: false,
          installTime: ''
        }

        // 解析版本信息
        const versionMatch = dumpData.match(/versionName=([^\s]+)/)
        if (versionMatch) {
          appInfo.versionName = versionMatch[1]
        }

        const versionCodeMatch = dumpData.match(/versionCode=(\d+)/)
        if (versionCodeMatch) {
          appInfo.versionCode = versionCodeMatch[1]
        }

        // 解析安装时间
        const firstInstallTimeMatch = dumpData.match(/firstInstallTime=(\d+)/)
        if (firstInstallTimeMatch) {
          const timestamp = parseInt(firstInstallTimeMatch[1])
          appInfo.installTime = new Date(timestamp).toLocaleString('zh-CN')
        }

        // 检查是否为系统应用
        const pathMatch = dumpData.match(/codePath=([^\s]+)/)
        if (pathMatch) {
          appInfo.isSystem = pathMatch[1].includes('/system/')
        }

        // 检查应用是否正在运行
        const runningMatch = dumpData.match(/running=true/)
        appInfo.isRunning = !!runningMatch

        // 尝试获取应用名称
        try {
          // 使用pm list packages -f命令获取应用路径信息
          const listResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell pm list packages -f ${packageName}`)
          if (listResult.success && listResult.data) {
            const line = listResult.data.trim()
            if (line) {
              // 尝试从路径中提取应用名称
              const pathMatch = line.match(/package:(.*?)=${packageName}/)
              if (pathMatch) {
                const path = pathMatch[1]
                // 如果是系统应用，尝试从路径中提取名称
                if (path.includes('/system/')) {
                  const nameMatch = path.match(/\/([^\/]+)\.apk$/)
                  if (nameMatch) {
                    appInfo.appName = nameMatch[1]
                  }
                }
              }
            }
          }
        } catch (error) {
          console.log('获取应用名称失败，使用包名:', error)
        }

        setAppInfo(appInfo)
      } else {
        message.error('获取应用信息失败')
      }
    } catch (error) {
      console.error('获取应用信息失败:', error)
      message.error('获取应用信息失败')
    } finally {
      setAppLoading(false)
    }
  }

  // 当modal打开且packageName变化时，获取应用信息
  useEffect(() => {
    if (visible && packageName && deviceId) {
      fetchAppInfo()
    } else if (!visible) {
      setAppInfo(null)
    }
  }, [visible, packageName, deviceId])

  if (!packageName) return null

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>确认卸载应用</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={loading}>
          取消
        </Button>,
        <Button 
          key="confirm" 
          type="primary" 
          danger 
          onClick={onConfirm}
          loading={loading}
        >
          确认卸载
        </Button>
      ]}
      width={500}
      centered
    >
      <div style={{ padding: '20px 0' }}>
        {appLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>正在获取应用信息...</Text>
            </div>
          </div>
        ) : appInfo ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 应用基本信息 */}
            <div>
              <Space size="middle">
                <Avatar 
                  size={64} 
                  icon={<AndroidOutlined />}
                  style={{ backgroundColor: appInfo.isSystem ? '#1890ff' : '#52c41a' }}
                />
                <div>
                  <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
                    {appInfo.appName}
                  </Title>
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    {appInfo.packageName}
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={appInfo.isSystem ? 'blue' : 'green'}>
                      {appInfo.isSystem ? '系统应用' : '用户应用'}
                    </Tag>
                  </div>
                </div>
              </Space>
            </div>

            {/* 应用详细信息 */}
            <div>
              <Title level={5} style={{ marginBottom: 16 }}>应用信息</Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Text strong>版本名称：</Text>
                  <Text>{appInfo.versionName || '未知'}</Text>
                </div>
                <div>
                  <Text strong>版本代码：</Text>
                  <Text>{appInfo.versionCode || '未知'}</Text>
                </div>
                <div>
                  <Text strong>安装时间：</Text>
                  <Text>{appInfo.installTime || '未知'}</Text>
                </div>
                <div>
                  <Text strong>运行状态：</Text>
                  <Tag color={appInfo.isRunning ? 'green' : 'default'}>
                    {appInfo.isRunning ? '运行中' : '未运行'}
                  </Tag>
                </div>
              </Space>
            </div>

            {/* 警告信息 */}
            <div style={{ 
              backgroundColor: '#fff7e6', 
              border: '1px solid #ffd591', 
              borderRadius: '6px', 
              padding: '12px',
              marginTop: 16
            }}>
              <Space>
                <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                <Text style={{ color: '#d48806' }}>
                  卸载后应用数据将被删除，此操作不可恢复。请确认您要卸载此应用。
                </Text>
              </Space>
            </div>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">应用信息获取失败</Text>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default UninstallConfirmModal 