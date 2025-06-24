import React, { useState, useMemo, useEffect } from 'react'
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
import UninstallConfirmModal from './UninstallConfirmModal'
import useInstalledApps from './useInstalledApps'
import AppDetailModal from './AppDetailModal'

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
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })
  
  // 使用 useInstalledApps Hook
  const { loading, apps, error, total, fetchApps, loadPageDetails } = useInstalledApps()
  
  // 卸载相关状态
  const [uninstallModalVisible, setUninstallModalVisible] = useState(false)
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null)
  const [uninstallLoading, setUninstallLoading] = useState(false)
  // 详情相关状态
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null)
  const [detailPackageName, setDetailPackageName] = useState<string | null>(null)

  // 使用 useEffect 监听 total 变化，并同步到 pagination
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: total,
    }))
  }, [total])

  // 处理卸载按钮点击
  const handleUninstallClick = (app: AppInfo) => {
    setSelectedPackageName(app.packageName)
    setUninstallModalVisible(true)
  }

  // 处理详情按钮点击
  const handleDetailClick = (app: AppInfo) => {
    setDetailDeviceId(selectedDevice?.id || null)
    setDetailPackageName(app.packageName)
    setDetailModalVisible(true)
  }

  // 使用 useMemo 定义 columns，避免重复创建
  const columns = useMemo(() => [
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
      width: 120,
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
            onClick={() => handleDetailClick(record)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ], [selectedDevice, handleUninstallClick])

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

    // 搜索时，仅重置页码到第一页
    setPagination(prev => ({
      ...prev,
      current: 1
    }))

    await fetchApps(selectedDevice.id, searchType, searchContent)
  }

  // 处理分页变化
  const handleTableChange = async (newPagination: any) => {
    setPagination(newPagination)
    
    // 加载新页面的应用详情
    if (selectedDevice) {
      await loadPageDetails(selectedDevice.id, newPagination.current, newPagination.pageSize)
    }
  }

  // 处理列宽调整
  const handleResize = (index: number) => (e: any, { size }: any) => {
    // 由于使用 useMemo，这里不再修改 columns
    // 如果需要动态调整列宽，需要重新设计状态管理
    console.log('列宽调整:', index, size.width)
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

  // 处理卸载确认
  const handleUninstallConfirm = async () => {
    if (!selectedPackageName || !selectedDevice) {
      message.error('缺少必要信息')
      return
    }

    setUninstallLoading(true)
    try {
      const result = await window.adbToolsAPI.uninstallApp(selectedDevice.id, selectedPackageName)
      if (result.success) {
        message.success(`应用 ${selectedPackageName} 卸载成功`)
        // 重新获取应用列表
        await fetchApps(selectedDevice.id, searchType, searchContent)
        setUninstallModalVisible(false)
        setSelectedPackageName(null)
      } else {
        message.error(result.error || '卸载失败')
      }
    } catch (error) {
      console.error('卸载应用失败:', error)
      message.error('卸载应用失败')
    } finally {
      setUninstallLoading(false)
    }
  }

  // 处理卸载取消
  const handleUninstallCancel = () => {
    setUninstallModalVisible(false)
    setSelectedPackageName(null)
  }

  // 显示错误信息
  React.useEffect(() => {
    if (error) {
      message.error(error)
    }
  }, [error])

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
                  dataSource={apps}
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

          {/* 卸载确认框 */}
          <UninstallConfirmModal
            visible={uninstallModalVisible}
            packageName={selectedPackageName}
            deviceId={selectedDevice?.id || null}
            onCancel={handleUninstallCancel}
            onConfirm={handleUninstallConfirm}
            loading={uninstallLoading}
          />
          {/* 应用详情弹窗 */}
          <AppDetailModal
            visible={detailModalVisible}
            deviceId={detailDeviceId}
            packageName={detailPackageName}
            onCancel={() => setDetailModalVisible(false)}
            onUninstalled={() => {
              if (selectedDevice) fetchApps(selectedDevice.id, searchType, searchContent)
            }}
          />
        </>
      ) : (
        <InstallApk />
      )}
    </div>
  )
}

export default AppManager 