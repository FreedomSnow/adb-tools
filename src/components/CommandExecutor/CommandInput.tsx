import React, { useRef, useState } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Input, 
  Typography,
  message,
  Dropdown
} from 'antd'
import type { InputRef } from 'antd'
import { 
  PlayCircleOutlined,
  ClearOutlined,
  CopyOutlined,
  UpOutlined,
  DownOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Text } = Typography

interface CommandInputProps {
  command: string
  setCommand: (command: string) => void
  executeCommand: () => void
  executing: boolean
  disabled: boolean
  showHistory: boolean
  setShowHistory: (show: boolean) => void
  commandHistory: Array<{
    command: string
    timestamp: string
    output: string
    status: 'success' | 'error'
  }>
  onHistorySelect: (command: string) => void
}

const CommandInput: React.FC<CommandInputProps> = ({
  command,
  setCommand,
  executeCommand,
  executing,
  disabled,
  showHistory,
  setShowHistory,
  commandHistory,
  onHistorySelect
}) => {
  const inputRef = useRef<HTMLDivElement>(null)
  const commandInputRef = useRef<InputRef>(null)

  // 复制命令到剪贴板
  const copyCommand = async () => {
    if (!command) {
      message.error('没有命令可复制')
      return
    }

    try {
      await navigator.clipboard.writeText(command)
      message.success('命令已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      message.error('复制失败，请手动选择文本复制')
    }
  }

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 回车执行命令
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      executeCommand()
      return
    }

    // Ctrl+C 或 Cmd+C 复制
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const selectedText = window.getSelection()?.toString()
      if (!selectedText) {
        e.preventDefault()
        copyCommand()
      }
      return
    }

    // Ctrl+V 或 Cmd+V 粘贴
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault() // 阻止默认粘贴行为
      navigator.clipboard.readText().then(text => {
        const inputElement = commandInputRef.current?.input
        if (inputElement) {
          const start = inputElement.selectionStart || 0
          const end = inputElement.selectionEnd || 0
          const newValue = command.substring(0, start) + text + command.substring(end)
          setCommand(newValue)
          // 设置光标位置到粘贴内容的末尾
          setTimeout(() => {
            const newCursorPos = start + text.length
            inputElement.setSelectionRange(newCursorPos, newCursorPos)
          }, 0)
        } else {
          // 如果无法获取到具体的选择范围，就直接追加到末尾
          setCommand(command + text)
        }
      }).catch(error => {
        console.error('粘贴失败:', error)
        message.error('粘贴失败')
      })
      return
    }

    // Ctrl+A 或 Cmd+A 全选
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (commandInputRef.current) {
        commandInputRef.current.select()
      }
      return
    }
  }

  // 右键菜单项
  const menuItems: MenuProps['items'] = [
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: copyCommand
    },
    {
      key: 'paste',
      label: '粘贴',
      onClick: async () => {
        try {
          const text = await navigator.clipboard.readText()
          setCommand(text)
        } catch (error) {
          message.error('粘贴失败')
        }
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'selectAll',
      label: '全选',
      onClick: () => {
        if (commandInputRef.current) {
          commandInputRef.current.select()
        }
      }
    }
  ]

  // 添加点击页面其他区域时隐藏历史记录的功能
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowHistory(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [setShowHistory])

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>命令输入</span>
          <Space size={40}>
            <Button
              type="default"
              icon={<CopyOutlined />}
              onClick={copyCommand}
              disabled={!command}
              style={{ 
                padding: '4px 8px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #d9d9d9'
              }}
            />
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
              disabled={disabled || !command.trim()}
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
          输入ADB命令 (自动使用选定设备)
        </Text>
        <div ref={inputRef} style={{ position: 'relative' }}>
          <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
            <Input
              ref={commandInputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="例如: adb shell getprop ro.product.model"
              onKeyDown={handleKeyDown}
              size="large"
              disabled={disabled}
              onClick={() => setShowHistory(false)}
              suffix={
                <Button
                  type="text"
                  icon={showHistory ? <DownOutlined /> : <UpOutlined />}
                  style={{ 
                    padding: '0 4px',
                    marginRight: -8,
                    color: 'rgba(0, 0, 0, 0.45)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowHistory(!showHistory)
                  }}
                />
              }
            />
          </Dropdown>
          {showHistory && commandHistory.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '2px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              {commandHistory.map((hist, index) => (
                <div
                  key={index}
                  onClick={() => onHistorySelect(hist.command)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.3s',
                    borderBottom: index < commandHistory.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Space>
                    <span>{hist.command}</span>
                  </Space>
                </div>
              ))}
            </div>
          )}
        </div>
      </Space>
    </Card>
  )
}

export default CommandInput 