import React, { useState, useRef } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Input, 
  Typography,
  message,
  Row,
  Col,
  Select,
  Tag,
  Alert,
  AutoComplete
} from 'antd'
import { 
  PlayCircleOutlined,
  ClearOutlined,
  SaveOutlined,
  HistoryOutlined,
  CodeOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

interface CommandHistory {
  command: string
  timestamp: string
  output: string
  status: 'success' | 'error'
}

const CommandExecutor: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])
  const [selectedHistoryCommand, setSelectedHistoryCommand] = useState<string>('')
  
  const outputRef = useRef<HTMLTextAreaElement>(null)

  // 预设常用命令
  const presetCommands = [
    { label: '获取设备信息', value: 'adb shell getprop' },
    { label: '查看已安装应用', value: 'adb shell pm list packages' },
    { label: '查看设备型号', value: 'adb shell getprop ro.product.model' },
    { label: '查看Android版本', value: 'adb shell getprop ro.build.version.release' },
    { label: '查看屏幕分辨率', value: 'adb shell wm size' },
    { label: '查看屏幕密度', value: 'adb shell wm density' },
    { label: '查看电池信息', value: 'adb shell dumpsys battery' },
    { label: '查看内存信息', value: 'adb shell cat /proc/meminfo' },
    { label: '查看CPU信息', value: 'adb shell cat /proc/cpuinfo' },
    { label: '截取屏幕', value: 'adb shell screencap /sdcard/screenshot.png' },
    { label: '重启设备', value: 'adb reboot' },
    { label: '进入恢复模式', value: 'adb reboot recovery' },
    { label: '进入下载模式', value: 'adb reboot download' }
  ]

  const executeCommand = async () => {
    if (!command.trim()) {
      message.error('请输入命令')
      return
    }

    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setExecuting(true)
    const startTime = new Date().toISOString()

    try {
      // 处理命令：为命令自动添加设备选择参数
      let processedCommand = command.trim()
      
      // 如果命令以 "adb" 开头，去掉 "adb" 前缀
      if (processedCommand.startsWith('adb ')) {
        processedCommand = processedCommand.substring(4)
      } else if (processedCommand === 'adb') {
        processedCommand = ''
      }
      
      // 如果命令不包含设备选择参数，自动添加
      let finalCommand = ''
      if (processedCommand && !processedCommand.includes('-s ')) {
        finalCommand = `-s ${selectedDevice.id} ${processedCommand}`
      } else if (processedCommand) {
        finalCommand = processedCommand
      } else {
        finalCommand = `-s ${selectedDevice.id}`
      }

      // 执行真实的ADB命令
      const result = await window.adbToolsAPI.execAdbCommand(finalCommand)
      
      let status: 'success' | 'error' = 'success'
      let commandOutput = ''

      if (result.success) {
        commandOutput = result.data || '命令执行成功，无输出'
      } else {
        status = 'error'
        commandOutput = result.error || '命令执行失败'
      }

      // 显示输出（显示用户输入的原始命令）
      setOutput(prev => {
        const newOutput = prev + `$ ${command}\n${commandOutput}\n\n`
        return newOutput
      })

      // 添加到历史记录（保存用户输入的原始命令）
      const historyEntry: CommandHistory = {
        command,
        timestamp: startTime,
        output: commandOutput,
        status
      }
      setCommandHistory(prev => [historyEntry, ...prev.slice(0, 49)]) // 保留最近50条

      setExecuting(false)
      
      // 自动滚动到底部
      setTimeout(() => {
        if (outputRef.current) {
          outputRef.current.scrollTop = outputRef.current.scrollHeight
        }
      }, 100)

    } catch (error: any) {
      const errorOutput = `Error: ${error.message}`
      setOutput(prev => prev + `$ ${command}\n${errorOutput}\n\n`)
      
      const historyEntry: CommandHistory = {
        command,
        timestamp: startTime,
        output: errorOutput,
        status: 'error'
      }
      setCommandHistory(prev => [historyEntry, ...prev.slice(0, 49)])
      
      setExecuting(false)
    }
  }

  const clearOutput = () => {
    setOutput('')
  }

  const copyOutput = async () => {
    if (!output) {
      message.error('没有输出可复制')
      return
    }

    try {
      await navigator.clipboard.writeText(output)
      message.success('输出内容已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      // 降级方案：使用选中和复制
      try {
        if (outputRef.current) {
          outputRef.current.select()
          document.execCommand('copy')
          message.success('输出内容已复制到剪贴板')
        }
      } catch (fallbackError) {
        message.error('复制失败，请手动选择文本复制')
      }
    }
  }

  const saveOutput = () => {
    if (!output) {
      message.error('没有输出可保存')
      return
    }

    try {
      const blob = new Blob([output], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `adb_output_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      message.success('输出保存成功')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const loadPresetCommand = (cmd: string) => {
    setCommand(cmd)
  }

  const loadHistoryCommand = (cmd: string) => {
    setCommand(cmd)
    setSelectedHistoryCommand('')
  }

  const copyHistoryOutput = async (historyEntry: CommandHistory) => {
    try {
      const textToCopy = `$ ${historyEntry.command}\n${historyEntry.output}`
      await navigator.clipboard.writeText(textToCopy)
      message.success('历史命令输出已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      message.error('复制失败')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      executeCommand()
    }
  }

  // 获取历史命令选项
  const getHistoryOptions = () => {
    return commandHistory.map((hist, index) => ({
      value: hist.command,
      label: (
        <Space>
          <Tag color={hist.status === 'success' ? 'green' : 'red'}>
            {hist.status === 'success' ? '✓' : '✗'}
          </Tag>
          <span>{hist.command}</span>
        </Space>
      )
    }))
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>命令执行器</Title>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      <Row gutter={16} justify="space-between">
        {/* 命令输入区域 */}
        <Col span={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>命令输入</span>
                <Space size={40}>
                  <Button
                    type="default"
                    icon={<ClearOutlined />}
                    onClick={() => setCommand('')}
                    disabled={!command}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #d9d9d9'
                    }}
                  />
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={executeCommand}
                    loading={executing}
                    disabled={!selectedDevice || selectedDevice.status !== 'device' || !command.trim()}
                    style={{ 
                      padding: '4px 8px'
                    }}
                  />
                </Space>
              </div>
            } 
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">
                <CodeOutlined /> 输入ADB命令 (自动使用选定设备)
              </Text>
              <AutoComplete
                value={command}
                onChange={setCommand}
                options={getHistoryOptions()}
                style={{ width: '100%' }}
                onSelect={(value) => setCommand(value)}
                disabled={!selectedDevice || selectedDevice.status !== 'device'}
                size="large"
                dropdownMatchSelectWidth={false}
                open={command ? undefined : false}
              >
                <Input
                  placeholder="例如: adb shell getprop ro.product.model"
                  onKeyPress={handleKeyPress}
                />
              </AutoComplete>
            </Space>
          </Card>

          {/* 输出区域 */}
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>执行输出</span>
                <Space size={40}>
                  <Button
                    type="default"
                    icon={<ClearOutlined />}
                    onClick={clearOutput}
                    disabled={!output}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #d9d9d9'
                    }}
                  />
                  <Button
                    type="default"
                    icon={<SaveOutlined />}
                    onClick={saveOutput}
                    disabled={!output}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #d9d9d9'
                    }}
                  />
                  <Button
                    type="default"
                    icon={<CopyOutlined />}
                    onClick={copyOutput}
                    disabled={!output}
                    style={{ 
                      padding: '4px 8px',
                      backgroundColor: '#f5f5f5',
                      border: '1px solid #d9d9d9'
                    }}
                  />
                </Space>
              </div>
            }
          >
            <TextArea
              ref={outputRef}
              value={output}
              placeholder="命令执行输出将显示在这里..."
              rows={20}
              readOnly
              style={{ 
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                backgroundColor: '#1e1e1e',
                color: '#d4d4d4',
                border: 'none',
                userSelect: 'text',
                cursor: 'text'
              }}
              onDoubleClick={(e) => {
                // 双击时选择当前行
                const target = e.target as HTMLTextAreaElement
                const lines = target.value.split('\n')
                const cursorPos = target.selectionStart
                let lineStart = 0
                let lineEnd = 0
                let currentPos = 0
                
                for (let i = 0; i < lines.length; i++) {
                  const lineLength = lines[i].length + 1 // +1 for \n
                  if (currentPos + lineLength > cursorPos) {
                    lineStart = currentPos
                    lineEnd = currentPos + lines[i].length
                    break
                  }
                  currentPos += lineLength
                }
                
                target.setSelectionRange(lineStart, lineEnd)
              }}
            />
          </Card>
        </Col>

        {/* 预设命令和历史 */}
        <Col span={8}>
          {/* 预设命令 */}
          <Card title="常用命令" size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {presetCommands.map((cmd, index) => (
                <Button
                  key={index}
                  type="link"
                  size="small"
                  onClick={() => loadPresetCommand(cmd.value)}
                  style={{ 
                    textAlign: 'left', 
                    width: '100%', 
                    height: 'auto',
                    whiteSpace: 'normal',
                    padding: '4px 0'
                  }}
                  disabled={!selectedDevice || selectedDevice.status !== 'device'}
                >
                  {cmd.label}
                </Button>
              ))}
            </Space>
          </Card>

          {/* 历史命令 */}
          <Card title="历史命令" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {commandHistory.length === 0 ? (
                <Text type="secondary">暂无历史命令</Text>
              ) : (
                <>
                  <Select
                    placeholder="选择历史命令"
                    style={{ width: '100%' }}
                    value={selectedHistoryCommand}
                    onChange={setSelectedHistoryCommand}
                    size="small"
                  >
                    {commandHistory.map((hist, index) => (
                      <Option key={index} value={hist.command}>
                        <Space>
                          <Tag color={hist.status === 'success' ? 'green' : 'red'}>
                            {hist.status === 'success' ? '✓' : '✗'}
                          </Tag>
                          <Text 
                            style={{ 
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {hist.command}
                          </Text>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                  {selectedHistoryCommand && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Button
                        type="primary"
                        size="small"
                        block
                        onClick={() => loadHistoryCommand(selectedHistoryCommand)}
                      >
                        使用此命令
                      </Button>
                      <Button
                        size="small"
                        block
                        icon={<CopyOutlined />}
                        onClick={() => {
                          const historyEntry = commandHistory.find(h => h.command === selectedHistoryCommand)
                          if (historyEntry) {
                            copyHistoryOutput(historyEntry)
                          }
                        }}
                      >
                        复制此命令输出
                      </Button>
                    </Space>
                  )}
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {!selectedDevice && (
        <Alert
          message="请先选择设备"
          description="请在设备管理中选择要执行命令的设备"
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  )
}

export default CommandExecutor 