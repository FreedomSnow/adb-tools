# ADB Tools - Android调试工具集成平台

一个基于 Electron 的图形化 Android 调试工具，集成了多种实用功能，提升开发效率。

## 功能特性

### 核心功能 (V1.0)
- ✅ **设备连接管理** - 支持 USB、WiFi 连接，自动识别设备状态
- 🔄 **Logcat 实时查看** - 实时过滤、颜色高亮、支持保存
- 📱 **应用管理** - 安装/卸载APK、查看应用信息
- 📁 **文件系统浏览** - 文件传输、权限查看
- 🖥️ **系统信息监控** - 电池、内存、CPU状态
- ⚡ **命令执行器** - 图形化封装常用ADB命令
- 📸 **屏幕截图** - 一键截图到剪贴板
- 🎯 **快捷操作面板** - 自定义常用操作

### 计划功能
- 📱 **投屏功能** (集成 scrcpy)
- 🎥 **录屏功能**
- 🌐 **网络调试** (抓包、代理配置)
- 📊 **诊断日志生成**

## 技术栈

- **前端**: Electron + React + TypeScript + Ant Design
- **构建**: Vite + electron-builder
- **ADB集成**: 自动下载和配置 Android Platform Tools

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

安装过程中会自动下载对应平台的 ADB 工具。

### 开发模式
```bash
npm run electron:dev
```

### 构建应用

#### 构建当前平台
```bash
npm run build
```

#### 构建特定平台
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建完成后，安装包将在 `release` 目录中。

## 项目结构

```
adb-tools/
├── electron/                 # Electron 主进程和预加载脚本
│   ├── main/index.ts         # 主进程入口
│   └── preload/index.ts      # 预加载脚本
├── src/                      # React 前端代码
│   ├── components/           # 功能组件
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # React 入口
├── resources/                # 资源文件
│   ├── adb/                 # ADB 工具 (自动下载)
│   └── download-adb.js      # ADB 下载脚本
├── public/                   # 静态资源
└── dist/                     # 构建输出
```

## 使用说明

1. **设备连接**
   - USB连接：确保开启USB调试
   - WiFi连接：在设备管理中输入设备IP地址

2. **查看日志**
   - 选择设备后可实时查看 Logcat
   - 支持按级别过滤和关键词搜索
   - 可保存日志到本地

3. **应用管理**
   - 安装/卸载 APK 文件
   - 查看应用详细信息
   - 管理应用权限

4. **文件操作**
   - 浏览设备文件系统
   - 上传/下载文件
   - 查看文件权限

## 常见问题

### Q: ADB 工具下载失败？
A: 检查网络连接，或手动运行 `npm run download-adb`

### Q: 设备无法识别？
A: 确保：
- 已开启USB调试
- 已安装设备驱动
- 已授权调试权限

### Q: WiFi连接失败？
A: 确保：
- 设备和电脑在同一网络
- 设备已开启WiFi调试
- 防火墙允许ADB端口(5555)

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始发布
- 实现基础设备管理功能
- 集成 ADB 自动下载