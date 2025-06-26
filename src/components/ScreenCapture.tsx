import React, { useState, useEffect } from 'react'
import { Typography, Card, Button, Row, Col, message } from 'antd'
import { CameraOutlined, VideoCameraOutlined, VideoCameraFilled, FolderOpenOutlined, LoadingOutlined } from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'
import { captureScreen } from './ScreenShot'
import { useScreenRecorder, generateScreenRecordFileName } from './ScreenRecorder'

const { Title } = Typography

const ScreenCapture: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [lastScreenshotPath, setLastScreenshotPath] = useState<string>('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isScreenshotSaving, setIsScreenshotSaving] = useState(false)
  const [tempFileName, setTempFileName] = useState<string>('')
  const [lastRecordPath, setLastRecordPath] = useState<string>('')
  const { startRecording, stopRecording } = useScreenRecorder()

  // 页面加载时同步录屏状态
  useEffect(() => {
    const syncRecordingStatus = async () => {
      try {
        const status = await window.adbToolsAPI.getScreenRecordStatus()
        if (status.isRecording && status.deviceId) {
          // 如果主进程显示正在录屏，但本地状态不是，则同步状态
          if (!isRecording) {
            setIsRecording(true)
            // 生成一个临时文件名（因为主进程可能没有保存文件名）
            if (!tempFileName) {
              setTempFileName(generateScreenRecordFileName())
            }
          }
        } else {
          // 如果主进程显示没有录屏，但本地状态是，则同步状态
          if (isRecording) {
            setIsRecording(false)
            setIsSaving(false)
          }
        }
      } catch (error) {
        console.error('同步录屏状态失败:', error)
      }
    }

    syncRecordingStatus()
  }, [isRecording, tempFileName, setIsRecording, setTempFileName, setIsSaving])

  const handleScreenshot = async () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    setIsScreenshotSaving(true)
    try {
      const savedPath = await captureScreen(selectedDevice)
      setLastScreenshotPath(savedPath)
      message.success('截图已保存')
    } catch (error) {
      console.error('截屏失败:', error)
      message.error(error instanceof Error ? error.message : '截屏失败')
    } finally {
      setIsScreenshotSaving(false)
    }
  }

  const handleOpenScreenshotFolder = async () => {
    if (!lastScreenshotPath) return
    try {
      await window.adbToolsAPI.showItemInFolder(lastScreenshotPath)
    } catch (error) {
      console.error('打开文件夹失败:', error)
      message.error('打开文件夹失败')
    }
  }

  const handleOpenRecordFolder = async () => {
    if (!lastRecordPath) return
    try {
      await window.adbToolsAPI.showItemInFolder(lastRecordPath)
    } catch (error) {
      console.error('打开文件夹失败:', error)
      message.error('打开文件夹失败')
    }
  }

  const handleScreenRecord = async () => {
    if (!isRecording) {
      const fileName = generateScreenRecordFileName()
      setTempFileName(fileName)
      setIsRecording(true)
      
      // 异步执行录屏，不阻塞 UI
      startRecording(fileName).then(success => {
        if (!success) {
          setIsRecording(false)
          message.error('开始录屏失败')
        }
      }).catch(error => {
        console.error('录屏操作失败:', error)
        message.error('录屏操作失败')
        setIsRecording(false)
      })
    } else {
      setIsRecording(false)
      setIsSaving(true)
      
      // 异步执行停止录屏，不阻塞 UI
      stopRecording(tempFileName).then(savedPath => {
        setIsSaving(false)
        if (savedPath && savedPath.length > 0) {
          setLastRecordPath(savedPath)
        }
      }).catch(error => {
        console.error('停止录屏失败:', error)
        message.error('停止录屏失败')
        setIsSaving(false)
      })
    }
  }

  return (
    <div style={{ padding: '0 0 16px 0' }}>
      <Title level={4} style={{ margin: 0, marginBottom: 16 }}>屏幕截图</Title>
      
      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {/* 功能按钮 */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle" style={{ marginTop: 30 }}>
          <Col>
            <Button 
              type="primary" 
              icon={isScreenshotSaving ? <LoadingOutlined /> : <CameraOutlined />} 
              onClick={handleScreenshot}
              disabled={!selectedDevice || selectedDevice.status !== 'device' || isScreenshotSaving}
              style={{ 
                backgroundColor: isScreenshotSaving ? '#1890ff' : '#1890ff',
                borderColor: isScreenshotSaving ? '#1890ff' : '#1890ff'
              }}
            >
              {isScreenshotSaving ? '保存中...' : '截屏'}
            </Button>
          </Col>
          {lastScreenshotPath && (
            <Col>
              <Button
                type="link"
                onClick={handleOpenScreenshotFolder}
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
            </Col>
          )}
        </Row>
        <Row gutter={16} align="middle" style={{ marginTop: 26 }}>
          <Col>
            <Button 
              type="primary" 
              icon={isRecording ? <VideoCameraFilled /> : isSaving ? <LoadingOutlined /> : <VideoCameraOutlined />}  
              onClick={handleScreenRecord}
              disabled={!selectedDevice || selectedDevice.status !== 'device' || isSaving}
              style={{ 
                backgroundColor: isRecording ? '#ff4d4f' : isSaving ? '#1890ff' : '#52c41a',
                borderColor: isRecording ? '#ff4d4f' : isSaving ? '#1890ff' : '#52c41a',
                paddingLeft: '24px',
                paddingRight: '24px'
              }}
            >
              {isRecording ? '录屏中...' : isSaving ? '保存中...' : '录屏'}
            </Button>
          </Col>
          {lastRecordPath && (
            <Col>
              <Button
                type="link"
                onClick={handleOpenRecordFolder}
                style={{ 
                  padding: '0 12px',
                  height: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                已保存： {lastRecordPath}
                <FolderOpenOutlined />
              </Button>
            </Col>
          )}
        </Row>
      </div>
    </div>
  )
}

export default ScreenCapture 