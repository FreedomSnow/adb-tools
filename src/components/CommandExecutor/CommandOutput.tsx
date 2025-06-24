import React, { useRef } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Input, 
  message
} from 'antd'
import { 
  ClearOutlined,
  SaveOutlined,
  CopyOutlined
} from '@ant-design/icons'

const { TextArea } = Input

interface CommandOutputProps {
  output: string
  clearOutput: () => void
}

const CommandOutput: React.FC<CommandOutputProps> = ({
  output,
  clearOutput
}) => {
  const outputRef = useRef<HTMLTextAreaElement>(null)

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

  return (
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
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{
        header: { flexShrink: 0 },
        body: {
          flexGrow: 1,
          padding: 0,
          overflow: 'hidden'
        }
      }}
    >
      <TextArea
        ref={outputRef}
        value={output}
        placeholder="命令执行输出将显示在这里..."
        readOnly
        style={{ 
          height: '100%',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          fontSize: '13px',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          border: 'none',
          userSelect: 'text',
          cursor: 'text',
          resize: 'none'
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
  )
}

export default CommandOutput 