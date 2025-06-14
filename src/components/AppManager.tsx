import React, { useState } from 'react'
import { Button, Typography, Row, Col, Select, Input, Space, Divider, Card, Avatar, Tag, Table } from 'antd'
import { AndroidOutlined, ArrowLeftOutlined, DeleteOutlined, InfoCircleOutlined, PlayCircleOutlined, SearchOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import DeviceSelector from './DeviceSelector'
import { useDevice } from '../contexts/DeviceContext'
import { AppInfo } from '@/types/app'

const { Title, Text } = Typography
const { Option } = Select

const AppManager: React.FC = () => {
  const navigate = useNavigate()
  const { selectedDevice } = useDevice()
  const [searchType, setSearchType] = useState<string>('all')
  const [searchContent, setSearchContent] = useState<string>('')
  const [searchResults, setSearchResults] = useState<AppInfo[]>([])
  const [loading, setLoading] = useState(false)

  const columns = [
    {
      title: '应用名称',
      key: 'appName',
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
      title: '版本号',
      dataIndex: 'versionName',
      key: 'versionName',
      render: (version: string) => (
        <Text>{version}</Text>
      )
    },
    {
      title: '类型',
      key: 'type',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isSystem ? 'blue' : 'green'}>
          {record.isSystem ? '系统应用' : '用户应用'}
        </Tag>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: AppInfo) => (
        <Tag color={record.isRunning ? 'green' : 'red'}>
          {record.isRunning ? '运行中' : '已停止'}
        </Tag>
      )
    },
    {
      title: '安装时间',
      key: 'installTime',
      render: (_: any, record: AppInfo) => (
        <Text>{record.installTime}</Text>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AppInfo) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            icon={<InfoCircleOutlined />}
            // onClick={() => showAppDetail(record)}
          >
            详情
          </Button>
          <Button 
            type="link" 
            size="small"
            // icon={runningApps.has(record.packageName) ? <StopOutlined /> : <PlayCircleOutlined />}
            // onClick={() => runningApps.has(record.packageName) 
            //   ? stopApp(record.packageName, record.appName)
            //   : startApp(record.packageName, record.appName)
            // }
            disabled={!selectedDevice || selectedDevice.status !== 'device'}
          >
            {/* {runningApps.has(record.packageName) ? '停止' : '启动'} */}
          </Button>
          
          {!record.isSystem && (
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
              // onClick={() => uninstallApp(record.packageName, record.appName)}
              disabled={!selectedDevice || selectedDevice.status !== 'device'}
            >
              卸载
            </Button>
          )}
        </Space>
      )
    }
  ]

  const handleSearch = () => {
    // TODO: 实现搜索功能
    console.log('搜索类型:', searchType)
    console.log('搜索内容:', searchContent)
  }

  return (
    <div>
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
              onClick={() => navigate('/install-apk')}
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
                  <Option value="all">全部应用</Option>
                  <Option value="system">系统应用</Option>
                  <Option value="third">用户应用</Option>
                  <Option value="enabled">已启用应用</Option>
                  <Option value="disabled">已禁用应用</Option>
                </Select>
              </Col>
              <Col span={14}>
                <Input
                  placeholder="输入应用名称或包名"
                  value={searchContent}
                  onChange={(e) => setSearchContent(e.target.value)}
                  onPressEnter={handleSearch}
                />
              </Col>
              <Col span={4}>
                <Button 
                  type="primary" 
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  style={{ width: '100%' }}
                >
                  搜索
                </Button>
              </Col>
            </Row>

            <Table
              columns={columns}
              dataSource={searchResults}
              rowKey="packageName"
              loading={loading}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`
              }}
            />
          </Space>
        </div>
      )}
    </div>
  )
}

export default AppManager 