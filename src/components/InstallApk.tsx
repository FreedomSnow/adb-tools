import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Button, 
  Space, 
  Typography,
  Upload,
  message,
  Progress,
  Row,
  Col,
  Checkbox,
  Divider,
  Input,
  List,
  Modal
} from 'antd'
import { 
  UploadOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  ApiOutlined
} from '@ant-design/icons'
import { useDevice } from '../contexts/DeviceContext'
import DeviceSelector from './DeviceSelector'

const { Title, Text } = Typography

interface InstallOptions {
  replace: boolean;
  debug: boolean;
  sdcard: boolean;
  grantPermissions: boolean;
  forwardLock: boolean;
  allowTestApk: boolean;
  useInstallerPackage: boolean;
  installerPackage: string;
}

interface SelectedFile {
  uid: string;
  name: string;
  file: File;
}

// 本地存储的key
const INSTALL_OPTIONS_STORAGE_KEY = 'adb_tools_install_options'

// 默认选项
const DEFAULT_INSTALL_OPTIONS: InstallOptions = {
  replace: false,
  debug: false,
  sdcard: false,
  grantPermissions: false,
  forwardLock: false,
  allowTestApk: false,
  useInstallerPackage: false,
  installerPackage: ''
}

const InstallApk: React.FC = () => {
  const { selectedDevice } = useDevice()
  const [uploadProgress, setUploadProgress] = useState(0)
  const [installing, setInstalling] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [installOptions, setInstallOptions] = useState<InstallOptions>(() => {
    // 从localStorage加载保存的选项
    const savedOptions = localStorage.getItem(INSTALL_OPTIONS_STORAGE_KEY)
    return savedOptions ? JSON.parse(savedOptions) : DEFAULT_INSTALL_OPTIONS
  })

  // 当选项改变时保存到localStorage
  useEffect(() => {
    localStorage.setItem(INSTALL_OPTIONS_STORAGE_KEY, JSON.stringify(installOptions))
  }, [installOptions])

  const installApk = async (file: File) => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return
    }

    setInstalling(true)
    setUploadProgress(0)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      setUploadProgress(20)
      
      // 构建安装参数
      const options = {
        replace: installOptions.replace ? '-r' : '',
        debug: installOptions.debug ? '-d' : '',
        sdcard: installOptions.sdcard ? '-s' : '',
        grantPermissions: installOptions.grantPermissions ? '-g' : '',
        forwardLock: installOptions.forwardLock ? '-l' : '',
        allowTestApk: installOptions.allowTestApk ? '-t' : '',
        installer: installOptions.useInstallerPackage && installOptions.installerPackage ? `-i ${installOptions.installerPackage}` : ''
      }
      
      const installResult = await window.adbToolsAPI.installApk(
        uint8Array, 
        file.name, 
        selectedDevice.id,
        Object.values(options).filter(Boolean).join(' ')
      )
      
      setUploadProgress(90)
      
      if (installResult.success) {
        const resultText = installResult.data || ''
        if (resultText.includes('Success') || resultText.includes('success') || resultText.includes('安装完成')) {
          setUploadProgress(100)
          message.success(`APK ${file.name} 安装到 ${selectedDevice.model} 成功`)
        } else {
          throw new Error(resultText || '安装失败')
        }
      } else {
        throw new Error(installResult.error || '安装失败')
      }
    } catch (error: any) {
      console.error('APK安装失败:', error)
      message.error(`APK安装失败: ${error.message}`)
    } finally {
      setInstalling(false)
      setUploadProgress(0)
    }
  }

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.apk')) {
      message.error('请选择APK文件')
      return false
    }
    
    const newFile: SelectedFile = {
      uid: Math.random().toString(36).substring(2),
      name: file.name,
      file: file
    }
    
    setSelectedFiles(prev => [...prev, newFile])
    return false
  }

  const handleRemoveFile = (uid: string) => {
    setSelectedFiles(prev => prev.filter(file => file.uid !== uid))
  }

  const handleInstall = async () => {
    if (selectedFiles.length === 0) {
      message.error('请先选择APK文件')
      return
    }

    // 检查安装包名
    if (installOptions.useInstallerPackage && !installOptions.installerPackage.trim()) {
      Modal.error({
        title: '安装包名未填写',
        content: '您已选择使用安装包名参数，但未填写具体的包名。请填写安装包名后再继续安装。',
        okText: '确定'
      })
      return
    }

    for (const selectedFile of selectedFiles) {
      await installApk(selectedFile.file)
    }
  }

  const uploadProps = {
    accept: '.apk',
    showUploadList: false,
    beforeUpload: handleFileSelect,
    multiple: true
  }

  const handleOptionChange = (option: keyof InstallOptions) => {
    setInstallOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const handleInstallerPackageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInstallOptions(prev => ({
      ...prev,
      installerPackage: e.target.value
    }))
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Button 
              type="link" 
              icon={<ArrowLeftOutlined />}
              onClick={() => window.history.back()}
            >
              返回
            </Button>
          </Col>
          <Col>
            <Title level={4} style={{ margin: 0 }}>安装APK</Title>
          </Col>
        </Row>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <DeviceSelector />
      </Card>

      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Divider>安装参数</Divider>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox 
              checked={installOptions.replace}
              onChange={() => handleOptionChange('replace')}
            >
              -r: 替换已存在的应用
            </Checkbox>
            <Checkbox 
              checked={installOptions.debug}
              onChange={() => handleOptionChange('debug')}
            >
              -d: 允许调试
            </Checkbox>
            <Checkbox 
              checked={installOptions.sdcard}
              onChange={() => handleOptionChange('sdcard')}
            >
              -s: 安装到SD卡
            </Checkbox>
            <Checkbox 
              checked={installOptions.grantPermissions}
              onChange={() => handleOptionChange('grantPermissions')}
            >
              -g: 自动授予所有权限
            </Checkbox>
            <Checkbox 
              checked={installOptions.forwardLock}
              onChange={() => handleOptionChange('forwardLock')}
            >
              -l: 安装到受保护存储
            </Checkbox>
            <Checkbox 
              checked={installOptions.allowTestApk}
              onChange={() => handleOptionChange('allowTestApk')}
            >
              -t: 允许安装测试APK
            </Checkbox>
            <div style={{ marginTop: 8 }}>
              <Checkbox 
                checked={installOptions.useInstallerPackage}
                onChange={() => handleOptionChange('useInstallerPackage')}
              >
                -i: 指定安装包名
              </Checkbox>
              <Input
                placeholder="输入安装包名"
                value={installOptions.installerPackage}
                onChange={handleInstallerPackageChange}
                style={{ width: 300 }}
                disabled={!installOptions.useInstallerPackage}
              />
            </div>
          </Space>

          <Divider>安装包</Divider>
          
          <Row gutter={16}>
            <Col>
              <Button 
                icon={<ApiOutlined />}
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.apk'
                  input.multiple = true
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      Array.from(files).forEach(file => handleFileSelect(file))
                    }
                  }
                  input.click()
                }}
              >
                选择APK文件
              </Button>
            </Col>
          </Row>

          {selectedFiles.length > 0 && (
            <List
              size="small"
              bordered
              dataSource={selectedFiles}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveFile(item.uid)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <Text>{item.name}</Text>
                </List.Item>
              )}
            />
          )}

          <Divider />

          <Row justify="center" style={{ marginTop: 20 }}>
            <Col>
              <Button 
                type="primary"
                onClick={handleInstall}
                loading={installing}
                disabled={!selectedDevice || selectedDevice.status !== 'device' || selectedFiles.length === 0}
                size="large"
                style={{ width: '400px' }}
              >
                开始安装
              </Button>
            </Col>
          </Row>

          {installing && (
            <div style={{ marginTop: 16 }}>
              <Text>正在安装APK到 {selectedDevice?.model}...</Text>
              <Progress 
                percent={uploadProgress} 
                status={uploadProgress === 100 ? 'success' : 'active'}
              />
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}

export default InstallApk 