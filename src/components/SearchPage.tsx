import React, { useState } from 'react'
import { Button, Typography, Row, Col, Select, Input, Space, Divider, Card } from 'antd'
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import DeviceSelector from './DeviceSelector'
import { useDevice } from '../contexts/DeviceContext'

const { Title } = Typography
const { Option } = Select

const SearchPage: React.FC = () => {
  const navigate = useNavigate()
  const { selectedDevice } = useDevice()
  const [searchType, setSearchType] = useState<string>('all')
  const [searchContent, setSearchContent] = useState<string>('')

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
          </Space>
        </div>
      )}
    </div>
  )
}

export default SearchPage 