import React, { useEffect, useState } from 'react';
import { Modal, Tabs, Spin, Typography, Space, Avatar, Tag, Descriptions, List, message, Button, Popconfirm } from 'antd';
import { AndroidOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { AppInfo } from '@/types/app';

const { Title, Text } = Typography;

interface AppDetailModalProps {
  visible: boolean;
  deviceId: string | null;
  packageName: string | null;
  onCancel: () => void;
  onUninstalled?: () => void;
}

const AppDetailModal: React.FC<AppDetailModalProps> = ({ visible, deviceId, packageName, onCancel, onUninstalled }) => {
  const [loading, setLoading] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [stopLoading, setStopLoading] = useState(false);
  const [uninstallLoading, setUninstallLoading] = useState(false);

  // 提取 fetchDetail 到组件作用域
  const fetchDetail = async () => {
    if (!visible || !deviceId || !packageName) return;
    setLoading(true);
    try {
      // adb root
      await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} root`);
      // dumpsys package
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell dumpsys package ${packageName}`);
      if (result.success && result.data) {
        const lines = result.data.split('\n');
        let appName = packageName;
        let versionName = '';
        let versionCode = '';
        let isRunning = false;
        let installTime = '';
        let isSystem = false;
        // 优先取 application-label:，没有则取 application-label-zh-CN: 或 application-label-zh:
        let appLabelLine = lines.find(l => l.includes('application-label:'));
        if (!appLabelLine) appLabelLine = lines.find(l => l.includes('application-label-zh-CN:'));
        if (!appLabelLine) appLabelLine = lines.find(l => l.includes('application-label-zh:'));
        if (appLabelLine) {
          const match = appLabelLine.match(/'([^']+)'/);
          if (match && match[1]) appName = match[1];
        }
        const versionNameLine = lines.find(l => l.trim().startsWith('versionName='));
        if (versionNameLine) {
          const match = versionNameLine.match(/versionName=(.*)/);
          if (match && match[1]) versionName = match[1].trim();
        }
        const versionCodeLine = lines.find(l => l.trim().startsWith('versionCode='));
        if (versionCodeLine) {
          const match = versionCodeLine.match(/versionCode=(.*)/);
          if (match && match[1]) versionCode = match[1].trim();
        }
        const codePathLine = lines.find(l => l.trim().startsWith('codePath='));
        if (codePathLine) {
          const match = codePathLine.match(/codePath=(.*)/);
          if (match && match[1]) isSystem = match[1].includes('/system/');
        }
        // 运行状态
        const runningResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell ps | grep ${packageName}`);
        isRunning = Boolean(runningResult.success && runningResult.data && runningResult.data.includes(packageName));
        // 权限
        const permLines = lines.filter(l => l.trim().startsWith('requested permissions:'));
        let perms: string[] = [];
        if (permLines.length > 0) {
          // 找到 requested permissions: 后的所有以 "    " 开头的行为权限
          const startIdx = lines.findIndex(l => l.trim().startsWith('requested permissions:'));
          for (let i = startIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s{4}[\w\.]+/.test(line)) {
              perms.push(line.trim());
            } else if (!line.trim()) {
              break;
            }
          }
        }
        setPermissions(perms);
        setAppInfo({
          packageName,
          appName,
          versionName,
          versionCode,
          isSystem,
          isRunning,
          installTime,
        });
      } else {
        message.error('获取应用信息失败');
      }
    } catch (e) {
      message.error('获取应用信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchDetail();
    else {
      setAppInfo(null);
      setPermissions([]);
    }
  }, [visible, deviceId, packageName]);

  // 停止应用
  const handleStopApp = async () => {
    if (!deviceId || !packageName) return;
    setStopLoading(true);
    try {
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell am force-stop ${packageName}`);
      if (result.success) {
        message.success('应用已停止');
        // 停止后刷新详情
        await fetchDetail();
      } else {
        message.error('停止应用失败');
      }
    } catch (e) {
      message.error('停止应用失败');
    } finally {
      setStopLoading(false);
    }
  };

  // 卸载应用
  const handleUninstallApp = async () => {
    if (!deviceId || !packageName) return;
    setUninstallLoading(true);
    try {
      const result = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} uninstall ${packageName}`);
      if (result.success && (!result.data || result.data.includes('Success'))) {
        message.success('应用已卸载');
        onCancel(); // 关闭弹窗
        if (onUninstalled) onUninstalled();
      } else {
        message.error('卸载失败');
      }
    } catch (e) {
      message.error('卸载失败');
    } finally {
      setUninstallLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      title={<span>应用详情</span>}
      width={600}
      footer={null}
      centered
    >
      <Spin spinning={loading} tip="加载中...">
        <Tabs
          defaultActiveKey="detail"
          items={[
            {
              key: 'detail',
              label: '详情',
              children: appInfo ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Space size="middle">
                    <Avatar size={64} icon={<AndroidOutlined />} style={{ backgroundColor: appInfo.isSystem ? '#1890ff' : '#52c41a' }} />
                    <div>
                      <Title level={4} style={{ margin: 0, marginBottom: 8 }}>{appInfo.appName}</Title>
                      <Text type="secondary" style={{ fontSize: '14px' }}>{appInfo.packageName}</Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color={appInfo.isSystem ? 'blue' : 'green'}>{appInfo.isSystem ? '系统应用' : '用户应用'}</Tag>
                      </div>
                    </div>
                  </Space>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="版本名称">{appInfo.versionName || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="版本代码">{appInfo.versionCode || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="运行状态">
                      <Tag color={appInfo.isRunning ? 'green' : 'default'}>{appInfo.isRunning ? '运行中' : '未运行'}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="安装时间">{appInfo.installTime || '未知'}</Descriptions.Item>
                  </Descriptions>
                  {/* 按钮区 */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 52, marginTop: 24 }}>
                    <Popconfirm
                      title="确定要卸载该应用吗？"
                      onConfirm={handleUninstallApp}
                      okText=" 确定 "
                      cancelText=" 取消 "
                      disabled={appInfo.isSystem}
                    >
                      <Button
                        danger
                        type="primary"
                        disabled={appInfo.isSystem}
                        loading={uninstallLoading}
                        style={{ minWidth: 90 }}
                      >
                        卸载
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title="确定要停止该应用吗？"
                      onConfirm={handleStopApp}
                      okText=" 确定 "
                      cancelText=" 取消 "
                    >
                      <Button
                        type="default"
                        disabled={appInfo.isSystem || !appInfo.isRunning}
                        loading={stopLoading}
                        style={{ minWidth: 90 }}
                      >
                        停止应用
                      </Button>
                    </Popconfirm>
                  </div>
                </Space>
              ) : <Text type="secondary">暂无数据</Text>
            },
            {
              key: 'permissions',
              label: '权限',
              children: (
                <List
                  size="small"
                  bordered
                  dataSource={permissions}
                  locale={{ emptyText: '无权限信息' }}
                  renderItem={item => <List.Item>{item}</List.Item>}
                />
              )
            }
          ]}
        />
      </Spin>
    </Modal>
  );
};

export default AppDetailModal; 