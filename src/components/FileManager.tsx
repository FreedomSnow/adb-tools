import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Table, 
  Typography,
  message,
  Modal,
  Input,
  Upload,
  Progress,
  Row,
  Col,
  Breadcrumb,
  Tag
} from 'antd'
import { 
  FolderOutlined,
  FileOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text } = Typography
const { Search } = Input

interface FileItem {
  name: string
  type: 'file' | 'directory'
  size: string
  permissions: string
  owner: string
  group: string
  modifyTime: string
  path: string
}

const FileManager: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [currentPath, setCurrentPath] = useState('/sdcard')
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [newFolderModalVisible, setNewFolderModalVisible] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    if (selectedDevice && selectedDevice.status === 'device') {
      loadFiles()
    } else {
      setFiles([])
    }
  }, [selectedDevice, currentPath])

  useEffect(() => {
    let filtered = files
    if (searchText) {
      filtered = files.filter(file => 
        file.name.toLowerCase().includes(searchText.toLowerCase())
      )
    }
    
    // 默认排序：文件夹在前，文件在后，然后按名称排序
    filtered = filtered.sort((a, b) => {
      // 如果类型相同，按名称排序
      if (a.type === b.type) {
        return a.name.localeCompare(b.name)
      }
      // 文件夹排在前面
      return a.type === 'directory' ? -1 : 1
    })
    
    setFilteredFiles(filtered)
  }, [files, searchText])

  const loadFiles = async () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setLoading(true)
    console.log(`开始加载目录: ${currentPath}`)
    
    try {
      // 使用ls -la命令获取文件列表，-1确保每行一个文件，-A显示所有文件但不包括.和..
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell ls -la "${currentPath}"`)
      
      console.log('ADB命令执行结果:', result)
      
      if (!result.success) {
        // 如果当前路径无法访问，尝试回退到/sdcard
        if (currentPath !== '/sdcard') {
          console.log('当前路径无法访问，回退到/sdcard:', currentPath)
          message.warning('无法访问当前目录，已返回到存储根目录')
          setCurrentPath('/sdcard')
          setLoading(false)
          return
        }
        throw new Error(result.error || '获取文件列表失败')
      }

      const fileList = parseFileList(result.data || '')
      setFiles(fileList)
      setLoading(false)
      
      // 显示加载结果
      console.log(`成功获取 ${currentPath} 目录下的 ${fileList.length} 个项目`)
      if (fileList.length === 0) {
        message.info(`目录 ${currentPath} 为空`)
      } else {
        const dirs = fileList.filter(f => f.type === 'directory').length
        const files = fileList.filter(f => f.type === 'file').length
        console.log(`包含 ${dirs} 个文件夹，${files} 个文件`)
      }
    } catch (error: any) {
      console.error('获取文件列表失败:', error)
      
      // 如果是权限错误，尝试回退到/sdcard
      if (error.message.includes('Permission denied') || error.message.includes('No such file')) {
        if (currentPath !== '/sdcard') {
          message.warning('目录无访问权限，已返回到存储根目录')
          setCurrentPath('/sdcard')
          setLoading(false)
          return
        }
      }
      
      message.error(`获取文件列表失败: ${error.message}`)
      setLoading(false)
    }
  }

  // 解析ls -la输出
  const parseFileList = (output: string): FileItem[] => {
    console.log('原始ls输出:', output)
    const lines = output.split('\n').filter(line => line.trim())
    const files: FileItem[] = []

    console.log(`共解析 ${lines.length} 行数据`)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // 跳过总计行和当前目录、父目录
      if (line.startsWith('total') || line.endsWith(' .') || line.endsWith(' ..')) {
        console.log(`跳过行 ${i+1}: ${line}`)
        continue
      }

      // 解析ls -la输出格式: 权限 链接数 所有者 组 大小 修改时间 文件名
      const parts = line.trim().split(/\s+/)
      
      if (parts.length < 8) {
        console.log(`跳过格式不正确的行 ${i+1}: ${line} (部分数量: ${parts.length})`)
        continue
      }

      const permissions = parts[0]
      const linkCount = parts[1] || '1'
      const owner = parts[2] || 'unknown'
      const group = parts[3] || 'unknown'
      const size = parts[4] || '0'
      
      // 文件名是从第8个部分开始的所有内容（可能包含空格）
      const fileName = parts.slice(8).join(' ').trim()
      
      // 如果文件名为空，跳过这一行
      if (!fileName) {
        console.log(`跳过空文件名行 ${i+1}: ${line}`)
        continue
      }

      // 跳过软链接指向的 .. 目录
      if (fileName.includes(' -> ') && fileName.includes('..')) {
        console.log(`跳过父目录软链接: ${fileName}`)
        continue
      }
      
      // 修改时间格式化：只显示月-日 时:分，去掉年份和秒数
      let modifyTime = ''
      if (parts.length >= 8) {
        // ls -la 输出格式通常是：月 日 时:分 或 月 日 年
        if (parts[7] && parts[7].includes(':')) {
          // 如果第7个部分包含冒号，说明是 时:分 格式（当年文件）
          modifyTime = `${parts[5]} ${parts[6]} ${parts[7]}`
        } else if (parts[6]) {
          // 否则是年份格式（非当年文件）
          modifyTime = `${parts[5]} ${parts[6]} ${parts[7] || ''}`
        }
      }
      
      // 判断文件类型
      const type: 'file' | 'directory' = permissions.startsWith('d') ? 'directory' : 'file'
      
      // 格式化大小
      let formattedSize = size
      if (type === 'file') {
        const sizeNum = parseInt(size)
        if (!isNaN(sizeNum)) {
          if (sizeNum > 1024 * 1024 * 1024) {
            formattedSize = `${(sizeNum / (1024 * 1024 * 1024)).toFixed(1)}GB`
          } else if (sizeNum > 1024 * 1024) {
            formattedSize = `${(sizeNum / (1024 * 1024)).toFixed(1)}MB`
          } else if (sizeNum > 1024) {
            formattedSize = `${(sizeNum / 1024).toFixed(1)}KB`
          } else {
            formattedSize = `${sizeNum}B`
          }
        }
      } else {
        formattedSize = '-'
      }

      // 构建完整路径
      const fullPath = currentPath.endsWith('/') 
        ? `${currentPath}${fileName}` 
        : `${currentPath}/${fileName}`

      const fileItem: FileItem = {
        name: fileName,
        type,
        size: formattedSize,
        permissions,
        owner,
        group,
        modifyTime: modifyTime.trim(),
        path: fullPath
      }

      files.push(fileItem)
      console.log(`解析文件 ${i+1}: ${fileName} (${type})`)
    }

    console.log(`成功解析 ${files.length} 个文件/文件夹`)
    return files
  }

  const navigateToPath = (path: string) => {
    setCurrentPath(path)
    setSearchText('')
  }

  const goBack = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/sdcard'
    // 防止返回到无权限的根目录
    if (parentPath === '' || parentPath === '/') {
      navigateToPath('/sdcard')
    } else {
      navigateToPath(parentPath)
    }
  }

  const goHome = () => {
    navigateToPath('/sdcard')
  }

  const openDirectory = (dirPath: string) => {
    navigateToPath(dirPath)
  }

  // 生成面包屑路径
  const renderBreadcrumb = () => {
    const pathParts = currentPath.split('/').filter(part => part !== '')
    
    return (
      <Breadcrumb style={{ fontSize: '13px' }}>
        <Breadcrumb.Item>
          <Button 
            type="link" 
            size="small" 
            icon={<HomeOutlined />}
            onClick={() => navigateToPath('/sdcard')}
            style={{ padding: '0 4px', height: '20px', fontSize: '12px' }}
          >
            存储根目录
          </Button>
        </Breadcrumb.Item>
        {pathParts.map((part, index) => {
          const isLast = index === pathParts.length - 1
          const fullPath = '/' + pathParts.slice(0, index + 1).join('/')
          
          // 防止导航到无权限的根目录
          const safePath = fullPath === '/' ? '/sdcard' : fullPath
          
          return (
            <Breadcrumb.Item key={fullPath}>
              {isLast ? (
                <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{part}</span>
              ) : (
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => navigateToPath(safePath)}
                  style={{ padding: '0 4px', height: '20px', fontSize: '12px' }}
                >
                  {part}
                </Button>
              )}
            </Breadcrumb.Item>
          )
        })}
      </Breadcrumb>
    )
  }

  const downloadFile = async (file: FileItem) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      message.loading('正在下载文件...', 0)
      
      // 使用adb pull命令下载文件
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} pull "${file.path}" .`)
      
      message.destroy()
      
      if (result.success) {
        message.success(`文件 ${file.name} 下载成功`)
      } else {
        throw new Error(result.error || '下载失败')
      }
    } catch (error: any) {
      message.destroy()
      message.error(`下载文件失败: ${error.message}`)
    }
  }

  const deleteFile = async (file: FileItem) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 "${file.name}" 吗？`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          message.loading('正在删除...', 0)
          
          // 使用rm命令删除文件或文件夹
          const command = file.type === 'directory' 
            ? `rm -rf "${file.path}"` 
            : `rm "${file.path}"`
          
          const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell ${command}`)
          
          message.destroy()
          
          if (result.success) {
            message.success('删除成功')
            setFiles(prev => prev.filter(f => f.path !== file.path))
          } else {
            throw new Error(result.error || '删除失败')
          }
        } catch (error: any) {
          message.destroy()
          message.error(`删除失败: ${error.message}`)
        }
      }
    })
  }

  const uploadFile = async (file: File) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // 这里需要实现文件上传到设备的逻辑
      // 由于文件上传涉及复杂的二进制数据处理，暂时使用模拟
      setTimeout(async () => {
        clearInterval(progressInterval)
        setUploadProgress(95)
        
        try {
          // 使用adb push命令上传文件
          const remotePath = `${currentPath}/${file.name}`.replace('//', '/')
          const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} push "${file.name}" "${remotePath}"`)
          
          setUploadProgress(100)
          
          if (result.success) {
            message.success(`文件 ${file.name} 上传成功`)
            loadFiles() // 重新加载文件列表
          } else {
            throw new Error(result.error || '上传失败')
          }
        } catch (error: any) {
          message.error(`上传文件失败: ${error.message}`)
        } finally {
          setUploading(false)
          setUploadProgress(0)
        }
      }, 3000)

    } catch (error: any) {
      message.error(`上传文件失败: ${error.message}`)
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const createNewFolder = async () => {
    if (!newFolderName.trim()) {
      message.error('请输入文件夹名称')
      return
    }

    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    try {
      const folderPath = `${currentPath}/${newFolderName}`.replace('//', '/')
      
      // 使用mkdir命令创建文件夹
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${selectedDevice.id} shell mkdir -p "${folderPath}"`)
      
      if (result.success) {
        message.success(`文件夹 "${newFolderName}" 创建成功`)
        setNewFolderModalVisible(false)
        setNewFolderName('')
        loadFiles() // 重新加载文件列表
      } else {
        throw new Error(result.error || '创建文件夹失败')
      }
    } catch (error: any) {
      message.error(`创建文件夹失败: ${error.message}`)
    }
  }

  const uploadProps = {
    showUploadList: false,
    beforeUpload: (file: File) => {
      uploadFile(file)
      return false
    }
  }

  const columns = [
    {
      title: '名称',
      key: 'name',
      sorter: (a: FileItem, b: FileItem) => a.name.localeCompare(b.name),
      render: (_: any, record: FileItem) => (
        <Space>
          {record.type === 'directory' ? 
            <FolderOutlined style={{ color: '#1890ff' }} /> : 
            <FileOutlined style={{ color: '#52c41a' }} />
          }
          <span 
            style={{ 
              cursor: record.type === 'directory' ? 'pointer' : 'default',
              color: record.type === 'directory' ? '#1890ff' : 'inherit',
              fontWeight: record.type === 'directory' ? 'bold' : 'normal',
              textDecoration: record.type === 'directory' ? 'none' : 'none',
              userSelect: 'none'
            }}
            onClick={() => {
              if (record.type === 'directory') {
                console.log('点击文件夹:', record.name, '路径:', record.path)
                openDirectory(record.path)
              }
            }}
            onMouseEnter={(e) => {
              if (record.type === 'directory') {
                (e.target as HTMLElement).style.textDecoration = 'underline'
              }
            }}
            onMouseLeave={(e) => {
              if (record.type === 'directory') {
                (e.target as HTMLElement).style.textDecoration = 'none'
              }
            }}
            title={record.type === 'directory' ? `点击进入文件夹: ${record.name}` : record.name}
          >
            {record.name}
          </span>
        </Space>
      )
    },
    {
      title: '类型',
      key: 'type',
      width: 100,
      sorter: (a: FileItem, b: FileItem) => a.type.localeCompare(b.type),
      render: (_: any, record: FileItem) => (
        <Tag color={record.type === 'directory' ? 'blue' : 'green'}>
          {record.type === 'directory' ? '文件夹' : '文件'}
        </Tag>
      )
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      sorter: (a: FileItem, b: FileItem) => {
        // 自定义大小排序逻辑
        const getSizeInBytes = (sizeStr: string): number => {
          if (sizeStr === '-') return 0
          const match = sizeStr.match(/^([\d.]+)(B|KB|MB|GB)?$/)
          if (!match) return 0
          
          const size = parseFloat(match[1])
          const unit = match[2] || 'B'
          
          switch (unit) {
            case 'GB': return size * 1024 * 1024 * 1024
            case 'MB': return size * 1024 * 1024
            case 'KB': return size * 1024
            default: return size
          }
        }
        
        return getSizeInBytes(a.size) - getSizeInBytes(b.size)
      }
    },
    {
      title: '修改时间',
      dataIndex: 'modifyTime',
      key: 'modifyTime',
      width: 120,
      sorter: (a: FileItem, b: FileItem) => a.modifyTime.localeCompare(b.modifyTime)
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: FileItem) => (
        <Space>
          {record.type === 'file' && (
            <Button 
              type="link" 
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => downloadFile(record)}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              下载
            </Button>
          )}
          <Button 
            type="link" 
            size="small" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteFile(record)}
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Title level={4} style={{ margin: 0 }}>文件管理</Title>
          </Col>
          <Col>
            <Upload {...uploadProps}>
              <Button 
                type="primary" 
                icon={<UploadOutlined />}
                loading={uploading}
                disabled={!selectedDevice || selectedDevice.status !== 'device'}
              >
                上传文件
              </Button>
            </Upload>
          </Col>
          <Col>
            <Button 
              icon={<PlusOutlined />}
              onClick={() => setNewFolderModalVisible(true)}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              新建文件夹
            </Button>
          </Col>
          <Col>
            <Button 
              icon={<ReloadOutlined />}
              onClick={loadFiles}
              loading={loading}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </div>

      {/* 设备选择器 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      {uploading && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>正在上传文件到 {selectedDevice?.model}...</Text>
            <Progress 
              percent={uploadProgress} 
              status={uploadProgress === 100 ? 'success' : 'active'}
            />
          </Space>
        </Card>
      )}

      <Card>
        {/* 路径导航 */}
        <div style={{ marginBottom: 16, padding: '16px', background: '#fafafa', borderRadius: '6px' }}>
          {/* 第一行：导航按钮和搜索 */}
          <Row gutter={16} align="middle" style={{ marginBottom: 12 }}>
            <Col flex="none">
              <Space>
                <Button 
                  icon={<ArrowLeftOutlined />} 
                  size="small"
                  onClick={goBack}
                  disabled={currentPath === '/sdcard' || currentPath === '/' || !selectedDevice}
                >
                  返回
                </Button>
                <Button 
                  icon={<HomeOutlined />} 
                  size="small"
                  onClick={goHome}
                  disabled={!selectedDevice}
                >
                  主目录
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button 
                  size="small"
                  onClick={() => navigateToPath('/storage/emulated/0')}
                  disabled={!selectedDevice}
                >
                  内部存储
                </Button>
                <Button 
                  size="small"
                  onClick={() => navigateToPath('/storage/emulated/0/Download')}
                  disabled={!selectedDevice}
                >
                  下载目录
                </Button>
                <Button 
                  size="small"
                  onClick={() => navigateToPath('/storage/emulated/0/DCIM')}
                  disabled={!selectedDevice}
                >
                  相册目录
                </Button>
              </Space>
            </Col>
            <Col flex="auto" />
            <Col flex="none">
              <Space>
                <Text strong style={{ fontSize: '12px', color: '#666' }}>文件搜索:</Text>
                <Search
                  placeholder="搜索文件或文件夹"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  size="small"
                  style={{ width: 250 }}
                />
              </Space>
            </Col>
          </Row>
          
          {/* 第二行：当前路径 */}
          <Row>
            <Col span={24}>
              <div>
                <Text strong style={{ fontSize: '12px', color: '#666' }}>当前路径:</Text>
                <div style={{ marginTop: 4 }}>
                  {renderBreadcrumb()}
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 文件统计 */}
        <div style={{ marginBottom: 12 }}>
          <Space>
            <Text type="secondary">
              总计: {files.length} | 显示: {filteredFiles.length}
            </Text>
            <Tag color="blue">
              文件夹: {filteredFiles.filter(f => f.type === 'directory').length}
            </Tag>
            <Tag color="green">
              文件: {filteredFiles.filter(f => f.type === 'file').length}
            </Tag>
            {selectedDevice && (
              <Text type="secondary">设备: {selectedDevice.model}</Text>
            )}
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={filteredFiles}
          rowKey="path"
          loading={loading}
          pagination={false}
          scroll={{ y: 500 }}
          size="small"
          showSorterTooltip={true}
        />
      </Card>

      {/* 新建文件夹对话框 */}
      <Modal
        title="新建文件夹"
        open={newFolderModalVisible}
        onOk={createNewFolder}
        onCancel={() => {
          setNewFolderModalVisible(false)
          setNewFolderName('')
        }}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">在 {currentPath} 中创建新文件夹</Text>
          <Input
            placeholder="请输入文件夹名称"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onPressEnter={createNewFolder}
          />
        </Space>
      </Modal>
    </div>
  )
}

export default FileManager 