import React, { useState } from 'react'
import { Button, Typography, Row, Col, Select, Input, Space, Divider, Card, Avatar, Tag, Table, message } from 'antd'
import { AndroidOutlined, ArrowLeftOutlined, DeleteOutlined, InfoCircleOutlined, PlayCircleOutlined, SearchOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'
import DeviceSelector from './DeviceSelector'
import { useDevice } from '../contexts/DeviceContext'
import { usePage } from '../contexts/PageContext'
import { AppInfo } from '@/types/app'
import InstallApk from './InstallApk'

const { Title, Text } = Typography
const { Option } = Select

// 定义搜索类型
type SearchType = 'all' | 'system' | 'user'

// 可调整宽度的表头组件
const ResizableTitle = (props: any) => {
  const { onResize, width, fixed, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '5px',
            cursor: 'col-resize',
            zIndex: 1
          }}
          onClick={e => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ position: 'relative', ...(fixed === 'left' ? { position: 'sticky', left: 0, zIndex: 2 } : {}) }} />
    </Resizable>
  )
}

// 添加自定义样式
const styles = `
  .react-resizable {
    position: relative;
  }
  .react-resizable-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 5px;
    cursor: col-resize;
    z-index: 1;
  }
  .react-resizable-handle:hover {
    background-color: #1890ff;
  }
  .ant-table-cell-fix-left {
    position: sticky !important;
    left: 0;
    z-index: 2;
  }
  .ant-table-cell-fix-left-first {
    position: sticky !important;
    left: 0;
    z-index: 2;
  }
  .ant-table-cell-fix-left-last {
    position: sticky !important;
    left: 0;
    z-index: 2;
  }
`

const AppManager: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectedDevice } = useDevice()
  const { navigateToPage } = usePage()
  const [searchType, setSearchType] = useState<SearchType>('all')
  const [searchContent, setSearchContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<AppInfo[]>([])
  const [searchResults, setSearchResults] = useState<AppInfo[]>([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })
  const [columns, setColumns] = useState([
    {
      title: '应用名称',
      key: 'appName',
      width: 300,
      fixed: 'left' as const,
      render: (_: any, record: AppInfo) => (
        <Space>
          <Avatar 
            size="large" 
            icon={<AndroidOutlined />}
            style={{ backgroundColor: record.isSystem ? '#1890ff' : '#52c41a' }}
          />
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.appName}</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.packageName}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: '类型',
      key: 'type',
      width: 100,
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isSystem ? 'blue' : 'green'}>
          {record.isSystem ? '系统应用' : '用户应用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: AppInfo) => (
        <Space>
          <Button 
            type="primary" 
            icon={<InfoCircleOutlined />}
          >
            详情
          </Button>
          
          {!record.isSystem && (
            <Button 
              style={{ marginLeft: 20 }}
              type="primary" 
              danger
              icon={<DeleteOutlined />}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              卸载
            </Button>
          )}
        </Space>
      )
    }
  ])

  // 搜索类型选项
  const searchTypeOptions = [
    { label: '全部应用', value: 'all' },
    { label: '系统应用', value: 'system' },
    { label: '用户应用', value: 'user' }
  ]

  // 处理搜索
  const handleSearch = async () => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    setLoading(true)
    try {
      const result = await window.adbToolsAPI.getInstalledApps(selectedDevice.id)
      if (result.success && result.data) {
        let filteredApps = result.data

        // 根据搜索类型过滤
        if (searchType === 'system') {
          filteredApps = filteredApps.filter(app => app.path.includes('/system/'))
        } else if (searchType === 'user') {
          filteredApps = filteredApps.filter(app => !app.path.includes('/system/'))
        }
        
        // 根据搜索内容过滤
        if (searchContent) {
          const searchLower = searchContent.toLowerCase()
          filteredApps = filteredApps.filter(app => 
            app.packageName.toLowerCase().includes(searchLower)
          )
        }

        // 转换为 AppInfo 类型
        const apps: AppInfo[] = filteredApps.map(app => ({
          packageName: app.packageName,
          appName: app.packageName, // 暂时使用包名作为应用名
          versionName: '', // 需要额外获取
          versionCode: '', // 需要额外获取
          isSystem: app.path.includes('/system/'),
          isRunning: false, // 需要额外获取
          installTime: '', // 需要额外获取
        }))

        setApps(apps)
        setSearchResults(apps)
        setPagination(prev => ({
          ...prev,
          current: 1,
          total: apps.length
        }))
      } else {
        message.error(result.error || '获取应用列表失败')
      }
    } catch (error) {
      console.error('获取应用列表失败:', error)
      message.error('获取应用列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 处理分页变化
  const handleTableChange = (newPagination: any) => {
    setPagination(newPagination)
  }

  // 处理列宽调整
  const handleResize = (index: number) => (e: any, { size }: any) => {
    const newColumns = [...columns]
    newColumns[index] = {
      ...newColumns[index],
      width: size.width,
    }
    setColumns(newColumns)
  }

  // 合并列配置
  const mergedColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column: any) => ({
      width: column.width,
      onResize: handleResize(index),
      fixed: column.fixed
    }),
  }))

  // 检查是否在安装 APK 页面
  const isInstallApkPage = location.pathname.includes('/apps/install-apk')

  return (
    <div>
      <style>{styles}</style>
      {!isInstallApkPage ? (
        <>
          <div style={{ marginBottom: 16 }}>
            <Row gutter={16} align="middle">
              <Col>
                <Title level={4} style={{ margin: 0 }}>应用管理</Title>
              </Col>
            </Row>
            <Row gutter={16} align="middle" style={{ marginTop: 16 }}>
              <Col>
                <Button 
                  type="primary" 
                  icon={<UploadOutlined />}
                  onClick={() => navigateToPage('apps', ['install-apk'])}
                  disabled={!selectedDevice || selectedDevice.status !== 'device'}
                >
                  安装APK
                </Button>
              </Col>
            </Row>
          </div>

          <Card size="small" style={{ marginBottom: 40 }}>
            <DeviceSelector />
          </Card>

          {selectedDevice && (
            <div>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={16}>
                  <Col span={6}>
                    <Select
                      style={{ width: '100%' }}
                      value={searchType}
                      onChange={setSearchType}
                      placeholder="选择搜索类型"
                    >
                      {searchTypeOptions.map(option => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Input.Search
                      placeholder="输入搜索内容"
                      value={searchContent}
                      onChange={e => setSearchContent(e.target.value)}
                      onSearch={handleSearch}
                      enterButton={<SearchOutlined />}
                      loading={loading}
                    />
                  </Col>
                </Row>

                <Table
                  components={{
                    header: {
                      cell: ResizableTitle,
                    },
                  }}
                  columns={mergedColumns}
                  dataSource={searchResults}
                  rowKey="packageName"
                  loading={loading}
                  pagination={{
                    ...pagination,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 个应用`,
                    style: { marginTop: '30px' }
                  }}
                  onChange={handleTableChange}
                  scroll={{ 
                    x: 'max-content', 
                    y: 'calc(100vh - 450px)',
                    scrollToFirstRowOnChange: true
                  }}
                  size="middle"
                  bordered
                  style={{ marginBottom: '30px' }}
                />
              </Space>
            </div>
          )}
        </>
      ) : (
        <InstallApk />
      )}
    </div>
  )
}

export default AppManager 