import React, { useState } from 'react'
import { Typography, Card, Button, Row, Col, message } from 'antd'
import { CameraOutlined, VideoCameraOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'
import { captureScreen } from '../utils/ScreenShot'

const { Title } = Typography

const ScreenCapture: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string>('')

  const handleScreenshot = async () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      const savedPath = await captureScreen(selectedDevice)
      setLastScreenshotPath(savedPath)
      message.success('截图已保存')
    } catch (error) {
      console.error('截屏失败:', error)
      message.error(error instanceof Error ? error.message : '截屏失败')
    }
  }

  const handleScreenRecord = () => {
    // TODO: 实现录屏功能
    console.log('录屏功能待实现')
  }

  const buttonStyle = {
    width: '100px',
    height: '50px',
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'left',
    alignItems: 'left',
    gap: '12px'
  }

  return (
    <div style={{ padding: '0 0 16px 0' }}>
      <Title level={4} style={{ margin: 0, marginBottom: 16 }}>屏幕截图</Title>
      
      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {/* 功能按钮 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button 
            type="primary" 
            icon={<CameraOutlined style={{ fontSize: '26px' }} />} 
            size="large"
            onClick={handleScreenshot}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
            style={{ 
              ...buttonStyle,
              backgroundColor: '#1890ff',
              borderColor: '#1890ff'
            }}
          >
            截屏
          </Button>
          {lastScreenshotPath && (
            <Button
              type="link"
              style={{ 
                padding: '0 12px',
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              已保存： {lastScreenshotPath}
              <FolderOpenOutlined />
            </Button>
          )}
        </div>
        <Button 
          type="primary" 
          icon={<VideoCameraOutlined style={{ fontSize: '26px' }} />} 
          size="large"
          onClick={handleScreenRecord}
          disabled={!selectedDevice || selectedDevice.status !== 'device'}
          style={{ 
            ...buttonStyle,
            backgroundColor: '#52c41a',
            borderColor: '#52c41a'
          }}
        >
          录屏
        </Button>
      </div>
    </div>
  )
}

export default ScreenCapture 