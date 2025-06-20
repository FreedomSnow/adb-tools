import React, { useRef, useState } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Input, 
  Typography,
  message,
  theme
} from 'antd'
import type { InputRef } from 'antd'
import { 
  PlayCircleOutlined,
  ClearOutlined,
  CopyOutlined,
  UpOutlined,
  DownOutlined,
  ScissorOutlined,
  FileAddOutlined
} from '@ant-design/icons'

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
  const { token } = theme.useToken()

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

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    
    const menuItems = [
      {
        key: 'copy',
        icon: <CopyOutlined />,
        label: '复制',
        onClick: copyCommand
      },
      {
        key: 'paste',
        icon: <FileAddOutlined />,
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
        key: 'cut',
        icon: <ScissorOutlined />,
        label: '剪切',
        onClick: () => {
          const inputElement = commandInputRef.current?.input
          if (inputElement) {
            inputElement.focus()
            document.execCommand('cut')
          }
        }
      }
    ]

    // 创建自定义右键菜单
    const menu = document.createElement('div')
    menu.style.cssText = `
      position: fixed;
      top: ${e.clientY}px;
      left: ${e.clientX}px;
      background: ${token.colorBgElevated};
      border: 1px solid ${token.colorBorder};
      border-radius: ${token.borderRadiusLG}px;
      box-shadow: ${token.boxShadowSecondary};
      padding: 4px;
      z-index: 1000;
      min-width: 120px;
    `

    menuItems.forEach(item => {
      const button = document.createElement('button')
      button.style.cssText = `
        display: flex;
        align-items: center;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        color: ${token.colorText};
        text-align: left;
        border-radius: ${token.borderRadiusSM}px;
      `
      button.innerHTML = `
        <span style="margin-right: 8px;">${item.icon ? item.icon.props.children.type.render() : ''}</span>
        ${item.label}
      `
      button.onmouseenter = () => {
        button.style.background = token.colorBgTextHover
      }
      button.onmouseleave = () => {
        button.style.background = 'transparent'
      }
      button.onclick = () => {
        item.onClick()
        document.body.removeChild(menu)
      }
      menu.appendChild(button)
    })

    // 点击其他地方关闭菜单
    const closeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu)
      }
      document.removeEventListener('click', closeMenu)
    }
    
    document.addEventListener('click', closeMenu)
    document.body.appendChild(menu)
  }

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
          <Input
            ref={commandInputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="例如: adb shell getprop ro.product.model"
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
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