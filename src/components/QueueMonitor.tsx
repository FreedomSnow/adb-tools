import React, { useState, useEffect } from 'react'
import { Badge, Tooltip, Space, Button } from 'antd'
import { CloudServerOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons'

const QueueMonitor: React.FC = () => {
  const [visible, setVisible] = useState(false)
  const [queueStatus, setQueueStatus] = useState<any>(null)

  useEffect(() => {
    if (!visible) return

    // 定时更新队列状态
    const interval = setInterval(async () => {
      try {
        const status = await window.adbToolsAPI.getQueueStatus()
        setQueueStatus(status)
      } catch (error) {
        console.error('获取队列状态失败:', error)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [visible])

  if (!visible) {
    return (
      <Button
        size="small"
        type="text"
        icon={<EyeOutlined />}
        onClick={() => setVisible(true)}
        title="显示队列监控"
      >
        队列
      </Button>
    )
  }

  return (
    <Space>
      <Button
        size="small"
        type="text"
        icon={<EyeInvisibleOutlined />}
        onClick={() => setVisible(false)}
        title="隐藏队列监控"
      />
      
      {queueStatus && (
        <Space size="small">
          <Tooltip title={`快速队列: ${queueStatus.fast.concurrency}/${queueStatus.fast.maxConcurrency} 运行中, ${queueStatus.fast.queueLength} 等待中`}>
            <Badge 
              count={queueStatus.fast.queueLength} 
              color={queueStatus.fast.concurrency > 0 ? 'processing' : 'default'}
              showZero
            >
              <CloudServerOutlined style={{ color: '#52c41a' }} />
            </Badge>
          </Tooltip>
          
          <Tooltip title={`普通队列: ${queueStatus.normal.concurrency}/${queueStatus.normal.maxConcurrency} 运行中, ${queueStatus.normal.queueLength} 等待中`}>
            <Badge 
              count={queueStatus.normal.queueLength} 
              color={queueStatus.normal.concurrency > 0 ? 'processing' : 'default'}
              showZero
            >
              <CloudServerOutlined style={{ color: '#1890ff' }} />
            </Badge>
          </Tooltip>
          
          <Tooltip title={`批量队列: ${queueStatus.bulk.concurrency}/${queueStatus.bulk.maxConcurrency} 运行中, ${queueStatus.bulk.queueLength} 等待中`}>
            <Badge 
              count={queueStatus.bulk.queueLength} 
              color={queueStatus.bulk.concurrency > 0 ? 'processing' : 'default'}
              showZero
            >
              <CloudServerOutlined style={{ color: '#f5222d' }} />
            </Badge>
          </Tooltip>
        </Space>
      )}
    </Space>
  )
}

export default QueueMonitor 