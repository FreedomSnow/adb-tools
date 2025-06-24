import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Typography,
  message,
  Row,
  Col,
  Alert
} from 'antd'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'
import CommandInput from './CommandExecutor/CommandInput'
import CommandOutput from './CommandExecutor/CommandOutput'
import PresetCommands from './CommandExecutor/PresetCommands'

const { Title } = Typography

interface CommandHistory {
  command: string
  timestamp: string
  output: string
  status: 'success' | 'error'
}

interface PresetCommand {
  id: string
  label: string
  value: string
  isCustom?: boolean
}

const defaultPresetCommands: PresetCommand[] = [
  { id: '1', label: '获取设备信息', value: 'adb shell getprop' },
  { id: '2', label: '查看已安装应用', value: 'adb shell pm list packages' },
  { id: '3', label: '查看设备型号', value: 'adb shell getprop ro.product.model' },
  { id: '4', label: '查看Android版本', value: 'adb shell getprop ro.build.version.release' },
  { id: '5', label: '查看屏幕分辨率', value: 'adb shell wm size' },
  { id: '6', label: '查看屏幕密度', value: 'adb shell wm density' },
  { id: '7', label: '查看电池信息', value: 'adb shell dumpsys battery' },
  { id: '8', label: '查看内存信息', value: 'adb shell cat /proc/meminfo' },
  { id: '9', label: '查看CPU信息', value: 'adb shell cat /proc/cpuinfo' },
  { id: '10', label: '重启设备', value: 'adb reboot' },
  { id: '11', label: '进入恢复模式', value: 'adb reboot recovery' },
  { id: '12', label: '进入下载模式', value: 'adb reboot download' }
]

const CommandExecutor: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState('')
  const [executing, setExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [presetCommands, setPresetCommands] = useState<PresetCommand[]>([])

  // 从文件加载预设命令
  useEffect(() => {
    loadPresetCommands()
  }, [])

  const loadPresetCommands = async () => {
    try {
      const commands = await window.adbToolsAPI.getPresetCommands()
      setPresetCommands(commands)
    } catch (error) {
      console.error('加载预设命令失败:', error)
      message.error('加载预设命令失败')
    }
  }

  // 保存预设命令到文件
  const savePresetCommands = async (commands: PresetCommand[]) => {
    try {
      await window.adbToolsAPI.savePresetCommands(commands)
      setPresetCommands(commands)
    } catch (error) {
      console.error('保存预设命令失败:', error)
      message.error('保存预设命令失败')
    }
  }

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
      setCommandHistory(prev => {
        const filteredHistory = prev.filter(h => h.command !== command)
        return [historyEntry, ...filteredHistory].slice(0, 50)
      })

      setExecuting(false)
      
      // 自动滚动到底部
      setTimeout(() => {
        const outputElement = document.querySelector('textarea')
        if (outputElement) {
          outputElement.scrollTop = outputElement.scrollHeight
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
      setCommandHistory(prev => {
        const filteredHistory = prev.filter(h => h.command !== command)
        return [historyEntry, ...filteredHistory].slice(0, 50)
      })
      
      setExecuting(false)
    }
  }

  const clearOutput = () => {
    setOutput('')
  }

  const handleHistorySelect = (cmd: string) => {
    setCommand(cmd)
    setShowHistory(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>命令执行</Title>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      <Row gutter={16} justify="space-between">
        {/* 命令输入区域 */}
        <Col span={16} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 240px)' }}>
          <CommandInput
            command={command}
            setCommand={setCommand}
            executeCommand={executeCommand}
            executing={executing}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            commandHistory={commandHistory}
            onHistorySelect={handleHistorySelect}
          />

          {/* 输出区域 */}
          <div style={{ flexGrow: 1, marginTop: 16, overflow: 'hidden' }}>
            <CommandOutput
              output={output}
              clearOutput={clearOutput}
            />
          </div>
        </Col>

        {/* 预设命令 */}
        <Col span={8} style={{ height: 'calc(100vh - 240px)' }}>
          <PresetCommands
            presetCommands={presetCommands}
            onCommandsChange={savePresetCommands}
            onCommandSelect={setCommand}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          />
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