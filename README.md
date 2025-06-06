# ADB Tools - Android调试工具集成平台 (Qt版本)

一个基于Python + PySide6开发的跨平台Android调试工具集成平台，提供设备管理、日志查看、应用管理、文件管理等功能。

## ✨ 主要功能

### 🔌 设备连接管理
- **USB设备检测**：自动检测USB连接的Android设备
- **WiFi无线连接**：支持通过IP地址连接网络设备
- **实时设备监控**：自动监控设备连接状态变化
- **设备信息显示**：显示设备型号、Android版本、电池电量等信息

### 📱 设备管理
- **设备信息查看**：详细的设备硬件和系统信息
- **设备状态监控**：实时显示设备连接状态和基本信息
- **多设备支持**：同时管理多个连接的设备

### 📋 日志查看 (Logcat)
- **实时日志流**：实时显示设备系统日志
- **多级别过滤**：支持按日志级别(V/D/I/W/E/F)过滤
- **标签过滤**：根据应用标签过滤日志
- **内容搜索**：快速搜索特定日志内容
- **彩色显示**：不同级别日志采用不同颜色显示
- **日志保存**：支持将日志保存为文本文件
- **自动滚动**：可选的自动滚动到最新日志

### 📦 应用管理
- **APK安装**：支持拖拽或选择APK文件进行安装
- **应用列表**：查看已安装的用户应用和系统应用
- **应用操作**：启动、停止、卸载应用
- **应用信息**：查看应用详细信息和权限
- **安装进度**：显示APK安装进度

### 📁 文件管理
- **文件浏览**：浏览设备文件系统
- **文件操作**：创建、删除、重命名文件和文件夹
- **文件传输**：上传文件到设备或从设备下载文件
- **批量操作**：支持多文件选择和批量操作
- **路径导航**：面包屑导航和快捷路径

### 📸 屏幕截图
- **实时截图**：获取设备当前屏幕截图
- **截图保存**：支持多种格式保存截图
- **截图预览**：内置图片预览功能

### 💻 命令终端
- **ADB命令执行**：直接执行ADB命令
- **命令历史**：保存和回溯命令历史
- **输出显示**：格式化显示命令输出结果
- **常用命令**：预设常用ADB命令快捷按钮

## 🚀 快速开始

### 环境要求

- **Python 3.8+**
- **PySide6 6.5+**
- **Android SDK Platform Tools** (包含ADB)

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-username/adb-tools.git
cd adb-tools

# 安装Python依赖
pip install -r requirements.txt
```

### 运行应用

```bash
# 启动应用
python main.py
```

### 首次使用设置

1. **ADB环境检查**：
   - 应用启动时会自动检查ADB是否可用
   - 如果未找到ADB，请安装Android SDK Platform Tools
   - 或将ADB路径添加到系统环境变量

2. **连接设备**：
   - 通过USB连接Android设备
   - 在设备上启用"USB调试"模式
   - 在应用中选择检测到的设备

3. **WiFi连接设置**：
   - 首先通过USB连接设备
   - 执行 `adb tcpip 5555` 启用WiFi调试
   - 在应用中使用"WiFi连接"功能连接

## 🏗️ 技术架构

### 架构设计

```
├── main.py                 # 应用入口
├── src/
│   ├── main_window.py      # 主窗口
│   ├── core/               # 核心模块
│   │   └── adb_manager.py  # ADB管理器
│   ├── widgets/            # UI组件
│   │   ├── device_manager.py
│   │   ├── logcat_viewer.py
│   │   ├── app_manager.py
│   │   ├── file_manager.py
│   │   ├── screenshot_tool.py
│   │   └── command_terminal.py
│   ├── dialogs/            # 对话框
│   │   ├── wifi_connect_dialog.py
│   │   └── settings_dialog.py
│   └── utils/              # 工具模块
│       ├── config.py       # 配置管理
│       └── logger.py       # 日志系统
├── resources/              # 资源文件
│   ├── icons/             # 图标
│   └── adb/               # ADB工具
└── requirements.txt        # Python依赖
```

### 核心特性

- **模块化设计**：各功能模块独立，易于维护和扩展
- **跨平台支持**：基于Qt，支持Windows、macOS、Linux
- **信号槽机制**：使用Qt信号槽实现组件间通信
- **多线程支持**：后台执行ADB命令，UI响应流畅
- **配置管理**：持久化保存用户配置和窗口状态
- **错误处理**：完善的错误处理和用户反馈机制

### 依赖说明

| 依赖包 | 版本要求 | 用途 |
|--------|----------|------|
| PySide6 | ≥6.5.0 | Qt6 Python绑定，UI框架 |
| requests | ≥2.31.0 | HTTP请求，用于下载ADB等 |
| psutil | ≥5.9.0 | 系统信息获取 |
| pillow | ≥10.0.0 | 图像处理 |
| python-dotenv | ≥1.0.0 | 环境变量管理 |

## 🛠️ 开发指南

### 开发环境设置

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装开发依赖
pip install -r requirements.txt
```

### 代码规范

- 遵循 PEP 8 Python代码规范
- 使用 UTF-8 编码
- 函数和类添加详细的文档字符串
- 重要功能添加日志记录

### 添加新功能

1. 在 `src/widgets/` 中创建新的组件类
2. 继承 `QWidget` 并实现必要的接口方法：
   - `set_current_device(device_id)`: 设置当前设备
   - `cleanup()`: 清理资源
3. 在 `src/main_window.py` 中注册新组件

### 构建和分发

```bash
# 使用PyInstaller打包
pip install pyinstaller

# 打包应用
pyinstaller --windowed --onefile main.py
```

## 📝 使用说明

### 设备连接

1. **USB连接**：
   - 用USB线连接Android设备到电脑
   - 在设备上启用"开发者选项"和"USB调试"
   - 在应用中点击"刷新设备"，选择检测到的设备

2. **WiFi连接**：
   - 首先确保设备已通过USB连接
   - 点击"WiFi连接"按钮
   - 输入设备IP地址（可在设备设置中查看）
   - 点击连接

### 日志查看

1. 选择目标设备
2. 切换到"日志查看"标签页
3. 点击"开始"按钮开始监控日志
4. 使用过滤器筛选关注的日志：
   - **级别过滤**：选择最低显示级别
   - **标签过滤**：输入应用包名或标签
   - **内容搜索**：搜索特定关键词
5. 点击"保存日志"导出日志文件

### 应用管理

1. 选择目标设备
2. 切换到"应用管理"标签页
3. 查看已安装应用列表
4. 进行应用操作：
   - **安装APK**：拖拽APK文件或点击安装按钮选择文件
   - **启动应用**：点击应用列表中的启动按钮
   - **停止应用**：强制停止正在运行的应用
   - **卸载应用**：删除已安装的应用

### 文件管理

1. 选择目标设备
2. 切换到"文件管理"标签页
3. 浏览设备文件系统
4. 文件操作：
   - **下载文件**：选择文件，点击下载按钮
   - **上传文件**：点击上传按钮选择本地文件
   - **创建文件夹**：在空白处右键选择创建文件夹
   - **删除文件**：选择文件，点击删除按钮

## 🔧 故障排除

### 常见问题

**Q: 应用启动时提示"ADB不可用"？**
A: 
- 确保已安装Android SDK Platform Tools
- 将ADB路径添加到系统环境变量PATH中
- 在终端中运行 `adb version` 验证ADB是否可用

**Q: 设备连接后无法执行命令？**
A: 
- 检查设备是否启用了USB调试
- 在设备上确认调试授权对话框
- 尝试重新连接设备

**Q: 日志显示乱码？**
A: 
- 检查系统编码设置
- 确保使用UTF-8编码
- 重启应用再试

**Q: 文件传输失败？**
A: 
- 检查设备存储空间是否充足
- 确认文件路径权限
- 对于系统目录，可能需要Root权限

### 日志文件位置

应用日志保存在：
- **Windows**: `%USERPROFILE%\.adb-tools\logs\`
- **macOS**: `~/.adb-tools/logs/`
- **Linux**: `~/.adb-tools/logs/`

## 🤝 贡献指南

我们欢迎社区贡献！请遵循以下流程：

1. Fork 项目到你的GitHub账户
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 贡献类型

- 🐛 Bug修复
- ✨ 新功能开发
- 📚 文档改进
- 🎨 UI/UX优化
- 🚀 性能优化
- 🧪 测试覆盖

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Qt Project](https://www.qt.io/) - 优秀的跨平台应用框架
- [PySide6](https://doc.qt.io/qtforpython/) - Qt的Python绑定
- [Android SDK](https://developer.android.com/studio) - ADB工具和Android开发支持

## 📞 联系我们

- 项目地址: [GitHub](https://github.com/your-username/adb-tools)
- 问题反馈: [Issues](https://github.com/your-username/adb-tools/issues)
- 功能建议: [Discussions](https://github.com/your-username/adb-tools/discussions)

---

**ADB Tools** - 让Android调试更简单、更高效！ 🚀