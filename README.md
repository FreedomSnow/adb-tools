# ADB Tools - Android调试工具集成平台

一个基于 Electron 的现代化图形界面 Android 调试工具，集成了多种实用功能，提升 Android 开发和调试效率。

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-v1.0.0-green)

## 🚀 功能特性

### ✅ 已实现核心功能 (V1.0)

#### 📱 **设备连接管理**
- USB 和 WiFi 双模式连接支持
- 实时设备状态监控
- 自动设备识别和连接
- 设备信息详细展示（型号、版本、电量等）

#### 🔍 **Logcat 实时日志查看**
- 实时日志流显示，自动滚动
- 多级别过滤（Verbose、Debug、Info、Warn、Error）
- 标签(Tag)和内容搜索
- 日志保存到本地文件
- 彩色高亮显示不同级别日志
- 行数限制和性能优化

#### 📦 **应用管理器**
- APK 安装，支持进度显示
- 应用列表查看（系统/用户应用分类）
- 应用启动、停止、卸载操作
- 应用详细信息查看（版本、权限、大小等）
- 应用搜索和过滤功能

#### 📁 **文件管理器**
- 完整的文件系统浏览体验
- 文件夹点击导航，面包屑路径
- 文件上传和下载功能
- 文件/文件夹创建和删除
- 智能排序（名称、类型、大小、时间）
- 常用目录快捷访问（内部存储、下载、相册）
- 无分页设计，一次显示所有内容

#### 🎯 **设备选择器**
- 全局设备状态管理
- 各功能模块统一的设备选择体验
- 实时设备连接状态更新

### 🔄 计划功能 (V2.0)
- 📱 **投屏功能** (集成 scrcpy)
- 🎥 **录屏功能**
- 🖥️ **系统信息监控** (CPU、内存、电池详情)
- ⚡ **命令执行器** (图形化ADB命令)
- 📸 **屏幕截图工具**
- 🌐 **网络调试** (抓包、代理配置)
- 📊 **诊断日志生成**

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件库**: Ant Design 5.x
- **桌面应用**: Electron
- **构建工具**: Vite + electron-builder
- **状态管理**: React Context API
- **ADB集成**: 自动下载和配置 Android Platform Tools
- **跨平台支持**: Windows、macOS、Linux

## 🎯 快速开始

### 环境要求
- Node.js 18+ 
- npm 或 yarn
- (可选) Android 设备已开启USB调试

### 📦 安装依赖
```bash
npm install
```

> 🔄 安装过程中会自动下载对应平台的 ADB 工具

### 🚀 开发模式
```bash
npm run dev
```

应用将在开发模式下启动，支持热重载。

### 📋 可用脚本

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 构建特定平台
npm run build:win    # Windows
npm run build:mac    # macOS 
npm run build:linux  # Linux

# 手动下载ADB工具
npm run download-adb

# 清理构建文件
npm run clean
```

## 📂 项目结构

```
adb-tools/
├── electron/                 # Electron 主进程
│   ├── main/
│   │   └── index.ts         # 主进程入口，ADB命令处理
│   └── preload/
│       └── index.ts         # 预加载脚本，API桥接
├── src/                      # React 前端代码
│   ├── components/           # 功能组件
│   │   ├── DeviceManager.tsx    # 设备连接管理
│   │   ├── LogcatViewer.tsx     # 日志查看器
│   │   ├── AppManager.tsx       # 应用管理器
│   │   ├── FileManager.tsx      # 文件管理器
│   │   └── DeviceSelector.tsx   # 设备选择器
│   ├── contexts/
│   │   └── DeviceContext.tsx    # 设备状态管理
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # React 入口
├── resources/                # 资源文件
│   ├── adb/                 # ADB 工具 (自动下载)
│   └── download-adb.js      # ADB 下载脚本
├── public/                   # 静态资源
│   └── logo.png             # 应用图标
├── dist/                     # 构建输出
└── release/                  # 打包应用输出
```

## 📖 使用指南

### 1. 🔌 设备连接

#### USB 连接
1. 在Android设备上开启"开发者选项"
2. 启用"USB调试"
3. 使用USB线连接设备到电脑
4. 在应用中选择设备

#### WiFi 连接
1. 确保设备和电脑在同一WiFi网络
2. 在设备管理中点击"WiFi连接"
3. 输入设备IP地址（通常在设置-关于手机-状态中查看）
4. 点击连接

### 2. 📋 查看日志 (Logcat)
1. 在设备选择器中选择目标设备
2. 进入"日志查看"功能
3. 实时查看应用日志输出
4. 使用过滤器按级别或标签筛选
5. 支持搜索关键词
6. 可保存日志到本地文件

### 3. 📱 应用管理
1. 选择已连接的设备
2. 查看已安装应用列表
3. 点击"安装APK"上传并安装应用
4. 使用启动/停止/卸载功能管理应用
5. 查看应用详细信息和权限

### 4. 📁 文件操作
1. 在文件管理中浏览设备文件系统
2. 点击文件夹名称进入子目录
3. 使用快捷按钮访问常用目录
4. 上传文件到设备或下载到本地
5. 创建新文件夹或删除文件
6. 点击列标题进行排序

## 🔧 高级配置

### ADB 路径配置
应用会自动下载和配置ADB工具，无需手动设置。如需使用自定义ADB：

1. 将ADB工具放在 `resources/adb/` 目录
2. 确保文件名为 `adb` (Linux/macOS) 或 `adb.exe` (Windows)
3. 重启应用

### 构建配置
修改 `electron-builder` 配置可自定义打包选项：

```json
// package.json
{
  "build": {
    "appId": "com.adbtools.app",
    "productName": "ADB Tools",
    "directories": {
      "output": "release"
    }
  }
}
```

## ❓ 常见问题

### Q: ADB 工具下载失败？
**A:** 
- 检查网络连接
- 手动运行 `npm run download-adb`
- 使用VPN或镜像源

### Q: 设备无法识别？
**A:** 确保：
- ✅ 已开启USB调试
- ✅ 已安装设备驱动程序  
- ✅ 已在设备上授权调试权限
- ✅ USB线支持数据传输

### Q: WiFi连接失败？
**A:** 确保：
- ✅ 设备和电脑在同一网络
- ✅ 设备已开启WiFi调试 (`adb tcpip 5555`)
- ✅ 防火墙允许ADB端口(5555)
- ✅ IP地址正确无误

### Q: 文件管理无法访问某些目录？
**A:**
- 某些系统目录需要root权限
- 应用会自动回退到可访问的目录
- 推荐使用内部存储等用户目录

### Q: 应用性能问题？
**A:**
- 调整日志行数限制
- 定期清理日志缓存
- 关闭不必要的实时监控

## 🤝 贡献指南

我们欢迎各种形式的贡献！

### 如何贡献
1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 报告问题
使用 GitHub Issues 报告bug或请求新功能。请提供：
- 详细的问题描述
- 复现步骤
- 系统环境信息
- 相关日志截图

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 📈 更新日志

### v1.0.0 (当前版本)
- ✨ 初始发布
- ✅ 完整的设备管理功能
- ✅ 实时Logcat查看器
- ✅ 应用管理器（安装/卸载/信息查看）
- ✅ 文件管理器（浏览/上传/下载/排序）
- ✅ 自动ADB工具下载和配置
- ✅ 跨平台支持（Windows/macOS/Linux）
- ✅ 现代化UI设计
- ✅ 设备状态全局管理

### 计划中的更新
- v1.1.0 - 系统信息监控
- v1.2.0 - 屏幕截图功能
- v2.0.0 - 投屏和录屏功能

---

**⭐ 如果这个项目对你有帮助，请给我们一个星标！**

📧 问题反馈: [GitHub Issues](https://github.com/your-username/adb-tools/issues)