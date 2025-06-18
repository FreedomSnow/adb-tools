import React, { useState } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Modal,
  Form,
  Input,
  message
} from 'antd'
import { 
  PlusOutlined,
  MenuOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
      style={{ marginBottom: 16 }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={presetCommands.map(cmd => cmd.id)}
          strategy={verticalListSortingStrategy}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {presetCommands.map((cmd) => (
              <SortableCommandItem
                key={cmd.id}
                command={cmd}
                onEdit={(cmd) => {
                  setEditingCommand(cmd)
                  form.setFieldsValue(cmd)
                  setIsAddModalVisible(true)
                }}
                onDelete={handleDeleteCommand}
                onSelect={onCommandSelect}
                disabled={disabled}
                isEditMode={isEditMode}
              />
            ))}
          </Space>
        </SortableContext>
      </DndContext>

      {/* 添加/编辑命令的模态框 */}
      <Modal
        title={editingCommand ? '编辑命令' : '添加命令'}
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
            <Input placeholder="例如：查看设备型号" />
          </Form.Item>
          <Form.Item
            name="value"
            label="命令内容"
            rules={[{ required: true, message: '请输入命令内容' }]}
          >
            <Input placeholder="例如：adb shell getprop ro.product.model" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default PresetCommands 