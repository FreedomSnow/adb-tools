import React, { useState, useRef } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Modal,
  Form,
  Input,
  message,
  theme
} from 'antd'
import type { InputRef } from 'antd'
import { 
  PlusOutlined,
  MenuOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CopyOutlined,
  ScissorOutlined,
  FileAddOutlined
} from '@ant-design/icons'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ReactDOMServer from 'react-dom/server'

interface PresetCommand {
  id: string
  label: string
  value: string
  isCustom?: boolean
}

interface PresetCommandsProps {
  presetCommands: PresetCommand[]
  onCommandsChange: (commands: PresetCommand[]) => void
  onCommandSelect: (command: string) => void
  disabled: boolean
}

// 可排序的命令项组件
const SortableCommandItem = ({ 
  command, 
  onEdit, 
  onDelete, 
  onSelect, 
  disabled,
  isEditMode
}: {
  command: PresetCommand
  onEdit?: (command: PresetCommand) => void
  onDelete?: (command: PresetCommand) => void
  onSelect: (value: string) => void
  disabled: boolean
  isEditMode: boolean
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: command.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    backgroundColor: isDragging ? '#fafafa' : 'transparent',
    padding: '4px 0',
    borderRadius: '4px'
  }

  return (
    <div ref={setNodeRef} style={style}>
      {isEditMode && (
        <div {...attributes} {...listeners} style={{ cursor: 'move', padding: '0 8px' }}>
          <MenuOutlined style={{ color: '#999' }} />
        </div>
      )}
      <Button
        type="link"
        size="small"
        onClick={() => onSelect(command.value)}
        style={{ 
          flex: 1,
          textAlign: 'left',
          height: 'auto',
          whiteSpace: 'normal',
          padding: '4px 0'
        }}
        disabled={disabled}
      >
        {command.label}
      </Button>
      {isEditMode && (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => onEdit?.(command)}
          />
          <Button
            type="text"
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => onDelete?.(command)}
            danger
          />
        </Space>
      )}
    </div>
  )
}

const PresetCommands: React.FC<PresetCommandsProps> = ({
  presetCommands,
  onCommandsChange,
  onCommandSelect,
  disabled
}) => {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false)
  const [editingCommand, setEditingCommand] = useState<PresetCommand | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [form] = Form.useForm()
  const labelInputRef = useRef<InputRef>(null)
  const valueInputRef = useRef<InputRef>(null)
  const { token } = theme.useToken()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 复制文本到剪贴板
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    } catch (err) {
      message.error('复制失败')
    }
  }

  // 从剪贴板粘贴文本
  const pasteFromClipboard = async (setValue: (value: string) => void) => {
    try {
      const text = await navigator.clipboard.readText()
      setValue(text)
    } catch (err) {
      message.error('粘贴失败')
    }
  }

  // 处理键盘快捷键
  const handleKeyDown = (e: React.KeyboardEvent, fieldName: 'label' | 'value') => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey
    
    if (isCtrlOrCmd) {
      switch (e.key) {
        case 'c':
          e.preventDefault()
          const input = fieldName === 'label' ? labelInputRef.current : valueInputRef.current
          if (input) {
            input.focus()
            document.execCommand('copy')
          }
          break
        case 'v':
          // 不做任何处理，交给原生粘贴
          break
        case 'x':
          e.preventDefault()
          const cutInput = fieldName === 'label' ? labelInputRef.current : valueInputRef.current
          if (cutInput) {
            cutInput.focus()
            document.execCommand('cut')
          }
          break
        case 'a':
          e.preventDefault()
          // 全选功能由浏览器原生支持
          break
      }
    }
  }

  // 添加或编辑命令
  const handleAddOrEditCommand = async (values: { label: string; value: string }) => {
    const newCommand: PresetCommand = {
      id: editingCommand?.id || Date.now().toString(),
      label: values.label,
      value: values.value,
      isCustom: true
    }

    let newCommands: PresetCommand[]
    if (editingCommand) {
      // 编辑现有命令
      newCommands = presetCommands.map(cmd => 
        cmd.id === editingCommand.id ? newCommand : cmd
      )
    } else {
      // 添加新命令到列表开头
      newCommands = [newCommand, ...presetCommands]
    }

    onCommandsChange(newCommands)
    setIsAddModalVisible(false)
    setEditingCommand(null)
    form.resetFields()
    message.success(editingCommand ? '命令已更新' : '命令已添加')
  }

  // 删除命令
  const handleDeleteCommand = (command: PresetCommand) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除命令"${command.label}"吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        const newCommands = presetCommands.filter(cmd => cmd.id !== command.id)
        onCommandsChange(newCommands)
        message.success('命令已删除')
      }
    })
  }

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = presetCommands.findIndex((cmd) => cmd.id === active.id)
      const newIndex = presetCommands.findIndex((cmd) => cmd.id === over.id)
      
      const newCommands = arrayMove(presetCommands, oldIndex, newIndex)
      onCommandsChange(newCommands)
    }
  }

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent, fieldName: 'label' | 'value') => {
    e.preventDefault()
    
    const menuItems = [
      {
        key: 'copy',
        icon: <CopyOutlined />,
        label: '复制',
        onClick: () => {
          const input = fieldName === 'label' ? labelInputRef.current : valueInputRef.current
          if (input) {
            input.focus()
            document.execCommand('copy')
          }
        }
      },
      {
        key: 'paste',
        icon: <FileAddOutlined />,
        label: '粘贴',
        onClick: () => {
          const input = fieldName === 'label' ? labelInputRef.current : valueInputRef.current
          if (input) {
            input.focus()
            document.execCommand('paste')
          }
        }
      },
      {
        key: 'cut',
        icon: <ScissorOutlined />,
        label: '剪切',
        onClick: () => {
          const input = fieldName === 'label' ? labelInputRef.current : valueInputRef.current
          if (input) {
            input.focus()
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
        <span style="margin-right: 8px;">${item.icon ? ReactDOMServer.renderToString(item.icon) : ''}</span>
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

  return (
    <Card 
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>常用命令</span>
          <Space size="middle">
            <Button
              type="text"
              icon={isEditMode ? <CheckOutlined /> : <EditOutlined />}
              size="small"
              onClick={() => setIsEditMode(!isEditMode)}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                setEditingCommand(null)
                setIsAddModalVisible(true)
              }}
            />
          </Space>
        </div>
      }
      size="small" 
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{
        header: { flexShrink: 0 },
        body: { flexGrow: 1, overflowY: 'auto', padding: '8px 4px' }
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={presetCommands}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ padding: '0px' }}>
            {presetCommands.map(command => (
              <SortableCommandItem
                key={command.id}
                command={command}
                onEdit={isEditMode ? (cmd) => { setEditingCommand(cmd); setIsAddModalVisible(true); } : undefined}
                onDelete={isEditMode ? handleDeleteCommand : undefined}
                onSelect={onCommandSelect}
                disabled={disabled}
                isEditMode={isEditMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      
      <Modal
        title={editingCommand ? '编辑命令' : '添加新命令'}
        open={isAddModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsAddModalVisible(false)
          setEditingCommand(null)
          form.resetFields()
        }}
        okText={editingCommand ? '保存' : '添加'}
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddOrEditCommand}
        >
          <Form.Item
            name="label"
            label="命令名称"
            rules={[{ required: true, message: '请输入命令名称' }]}
          >
            <Input 
              ref={labelInputRef}
              placeholder="例如：查看设备型号"
              onKeyDown={(e) => handleKeyDown(e, 'label')}
              onContextMenu={(e) => handleContextMenu(e, 'label')}
            />
          </Form.Item>
          <Form.Item
            name="value"
            label="命令内容"
            rules={[{ required: true, message: '请输入命令内容' }]}
          >
            <Input.TextArea 
              ref={valueInputRef}
              placeholder="例如：adb shell getprop ro.product.model"
              rows={4}
              style={{ fontFamily: 'monospace' }}
              onKeyDown={(e) => handleKeyDown(e, 'value')}
              onContextMenu={(e) => handleContextMenu(e, 'value')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default PresetCommands 