import React, { useState, useEffect, useRef } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Select, 
  Input, 
  Typography,
  Switch,
  message,
  Divider,
  Tag,
  Modal,
  Row,
  Col
} from 'antd'
import { 
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClearOutlined,
  SaveOutlined,
  FilterOutlined,
  SearchOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text } = Typography
const { Option } = Select
const { Search } = Input

interface LogEntry {
  timestamp: string
  level: 'V' | 'D' | 'I' | 'W' | 'E' | 'F'
  tag: string
  message: string
  pid: string
  tid: string
}

const LogcatViewer: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [maxLines, setMaxLines] = useState(1000)
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  
  const logContainerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (isRunning && selectedDevice) {
      // 开始真实的logcat监听
      startLogcatCapture()
    } else {
      // 停止logcat监听
      stopLogcatCapture()
    }

    return () => {
      stopLogcatCapture()
    }
  }, [isRunning, selectedDevice, maxLines])

  // 开始logcat捕获
  const startLogcatCapture = () => {
    if (!selectedDevice) return
    
    // 清理现有的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // 使用真实的logcat命令
    intervalRef.current = setInterval(async () => {
      try {
        const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} logcat -v time -t 50`)
        
        if (result.success && result.data) {
          const newLogs = parseLogcatOutput(result.data)
          setLogs(prevLogs => {
            const combinedLogs = [...prevLogs, ...newLogs]
            // 限制日志数量并去重
            const uniqueLogs = combinedLogs.filter((log, index, self) => 
              self.findIndex(l => l.timestamp === log.timestamp && l.message === log.message) === index
            )
            return uniqueLogs.slice(-maxLines)
          })
        }
      } catch (error) {
        console.error('获取logcat失败:', error)
      }
    }, 2000) // 每2秒获取一次新日志
  }

  // 停止logcat捕获
  const stopLogcatCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = undefined
    }
  }

  // 解析logcat输出
  const parseLogcatOutput = (output: string): LogEntry[] => {
    const lines = output.split('\n').filter(line => line.trim())
    const logs: LogEntry[] = []

    for (const line of lines) {
      // 解析logcat格式: 时间戳 级别/标签(PID): 消息
      const match = line.match(/^(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEF])\/(.+?)\(\s*(\d+)\):\s*(.*)$/)
      
      if (match) {
        const [, timestamp, level, tag, pid, message] = match
        
        logs.push({
          timestamp: `2024-${timestamp}`, // 添加年份
          level: level as LogEntry['level'],
          tag: tag.trim(),
          message: message.trim(),
          pid: pid.trim(),
          tid: pid.trim() // 简化使用PID作为TID
        })
      }
    }

    return logs
  }

  useEffect(() => {
    // 过滤日志
    let filtered = logs

    // 按级别过滤
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel)
    }

    // 按标签过滤
    if (selectedTag !== 'all') {
      filtered = filtered.filter(log => log.tag === selectedTag)
    }

    // 按搜索文本过滤
    if (searchText) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchText.toLowerCase()) ||
        log.tag.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    setFilteredLogs(filtered)
  }, [logs, selectedLevel, selectedTag, searchText])

  useEffect(() => {
    // 自动滚动到底部
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [filteredLogs, autoScroll])

  const toggleLogging = () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setIsRunning(!isRunning)
    if (!isRunning) {
      // 开始时添加一些初始日志
      setLogs([])
      message.success(`开始从设备 ${selectedDevice.model} 捕获日志`)
    } else {
      message.success('停止捕获日志')
    }
  }

  const clearLogs = () => {
    setLogs([])
    setFilteredLogs([])
  }

  const saveLogs = () => {
    setSaveModalVisible(true)
  }

  const handleSaveLogs = () => {
    try {
      const logText = filteredLogs.map(log => 
        `${log.timestamp} ${log.level}/${log.tag}(${log.pid}): ${log.message}`
      ).join('\n')

      const blob = new Blob([logText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `logcat_${selectedDevice?.model || 'device'}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      message.success('日志保存成功')
      setSaveModalVisible(false)
    } catch (error) {
      message.error('保存失败')
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'V': return '#8b949e'
      case 'D': return '#58a6ff'
      case 'I': return '#7ee787'
      case 'W': return '#ffa657'
      case 'E': return '#f85149'
      case 'F': return '#da3633'
      default: return '#ffffff'
    }
  }

  const getLevelTag = (level: string) => {
    const colors = {
      'V': 'default',
      'D': 'blue', 
      'I': 'green',
      'W': 'orange',
      'E': 'red',
      'F': 'red'
    }
    return <Tag color={colors[level as keyof typeof colors]}>{level}</Tag>
  }

  useEffect(() => {
    // 从实际日志中提取可用标签
    const tags = Array.from(new Set(logs.map(log => log.tag))).filter(tag => tag)
    setAvailableTags(tags)
  }, [logs])

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>Logcat查看器</Title>
          </Col>
          <Col>
            <Button 
              type={isRunning ? "default" : "primary"}
              icon={isRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={toggleLogging}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              {isRunning ? '停止' : '开始'}
            </Button>
          </Col>
          <Col>
            <Button 
              icon={<ClearOutlined />}
              onClick={clearLogs}
              disabled={logs.length === 0}
            >
              清空
            </Button>
          </Col>
          <Col>
            <Button 
              icon={<SaveOutlined />}
              onClick={saveLogs}
              disabled={filteredLogs.length === 0}
            >
              保存
            </Button>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      <Card size="small">
        {/* 过滤控制面板 */}
        <div style={{ marginBottom: 16, padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
          <Row gutter={16} align="middle">
            <Col span={4}>
              <Text strong>级别:</Text>
              <Select 
                value={selectedLevel} 
                onChange={setSelectedLevel}
                style={{ width: '100%', marginTop: 4 }}
                size="small"
              >
                <Option value="all">全部</Option>
                <Option value="V">Verbose</Option>
                <Option value="D">Debug</Option>
                <Option value="I">Info</Option>
                <Option value="W">Warning</Option>
                <Option value="E">Error</Option>
                <Option value="F">Fatal</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Text strong>标签:</Text>
              <Select 
                value={selectedTag} 
                onChange={setSelectedTag}
                style={{ width: '100%', marginTop: 4 }}
                size="small"
              >
                <Option value="all">全部</Option>
                {availableTags.map(tag => (
                  <Option key={tag} value={tag}>{tag}</Option>
                ))}
              </Select>
            </Col>
            <Col span={8}>
              <Text strong>搜索:</Text>
              <Search
                placeholder="搜索日志内容或标签"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ marginTop: 4 }}
                size="small"
                allowClear
              />
            </Col>
            <Col span={4}>
              <Space direction="vertical" size="small">
                <Text strong>自动滚动</Text>
                <Switch 
                  checked={autoScroll} 
                  onChange={setAutoScroll}
                  size="small"
                />
              </Space>
            </Col>
            <Col span={4}>
              <Space direction="vertical" size="small">
                <Text strong>最大行数</Text>
                <Select 
                  value={maxLines} 
                  onChange={setMaxLines}
                  style={{ width: '100%' }}
                  size="small"
                >
                  <Option value={500}>500</Option>
                  <Option value={1000}>1000</Option>
                  <Option value={2000}>2000</Option>
                  <Option value={5000}>5000</Option>
                </Select>
              </Space>
            </Col>
          </Row>
        </div>

        {/* 日志统计 */}
        <div style={{ marginBottom: 12, padding: '8px 0' }}>
          <Space>
            <Text type="secondary">
              总计: {logs.length} | 显示: {filteredLogs.length}
            </Text>
            {isRunning && <Tag color="green">运行中</Tag>}
            {selectedDevice && (
              <Text type="secondary">来源: {selectedDevice.model}</Text>
            )}
          </Space>
        </div>

        {/* 日志内容区域 */}
        <div 
          ref={logContainerRef}
          className="log-viewer custom-scrollbar"
          style={{ 
            height: '500px',
            overflow: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: '6px'
          }}
        >
          {filteredLogs.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: '#999',
              background: '#1e1e1e'
            }}>
              {!selectedDevice 
                ? '请先选择设备' 
                : logs.length === 0 
                  ? '点击"开始"按钮开始捕获日志' 
                  : '没有匹配的日志'
              }
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div 
                key={index}
                className="log-line"
                style={{ 
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                }}
              >
                <Space size="small">
                  <Text style={{ color: '#666', minWidth: '140px' }}>
                    {log.timestamp}
                  </Text>
                  {getLevelTag(log.level)}
                  <Text 
                    style={{ 
                      color: '#58a6ff', 
                      minWidth: '120px',
                      fontWeight: 'bold'
                    }}
                  >
                    {log.tag}
                  </Text>
                  <Text style={{ color: '#8b949e', minWidth: '60px' }}>
                    ({log.pid})
                  </Text>
                  <Text style={{ color: getLevelColor(log.level) }}>
                    {log.message}
                  </Text>
                </Space>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* 保存对话框 */}
      <Modal
        title="保存日志文件"
        open={saveModalVisible}
        onOk={handleSaveLogs}
        onCancel={() => setSaveModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>将保存当前过滤的日志到本地文件</Text>
          <Text type="secondary">设备: {selectedDevice?.model}</Text>
          <Text type="secondary">文件格式: logcat_设备型号_YYYY-MM-DD-HH-mm-ss.txt</Text>
          <Text type="secondary">日志条数: {filteredLogs.length}</Text>
        </Space>
      </Modal>
    </div>
  )
}

export default LogcatViewer 