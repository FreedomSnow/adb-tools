# CI/CD 配置说明

## 📋 概述

本项目提供了两种CI/CD配置方案：

1. **Travis CI** (`.travis.yml`)
2. **GitHub Actions** (`.github/workflows/build.yml`) - 推荐

## 🚀 GitHub Actions (推荐)

### 特性
- ✅ 支持多平台构建 (Linux, macOS, Windows)
- ✅ 支持多Node.js版本 (18, 20)
- ✅ 自动构建和发布
- ✅ 构建产物自动上传
- ✅ 与GitHub深度集成

### 使用方法

1. **启用GitHub Actions**
   - 确保仓库启用了GitHub Actions
   - 工作流文件位于 `.github/workflows/build.yml`

2. **触发构建**
   - 推送到 `main` 或 `develop` 分支
   - 创建Pull Request到 `main` 分支
   - 发布Release

3. **发布流程**
   ```bash
   # 创建并推送标签
   git tag v1.0.0
   git push origin v1.0.0
   
   # 或在GitHub网页上创建Release
   ```

### 构建产物

构建完成后，会在以下位置找到安装包：
- **Linux**: `*.AppImage`
- **macOS**: `*.dmg`
- **Windows**: `*.exe`

## 🔧 Travis CI

### 特性
- ✅ 多平台支持 (Linux, macOS, Windows)
- ✅ 缓存优化
- ✅ 自动发布到GitHub Releases
- ✅ 邮件通知

### 设置步骤

1. **连接Travis CI**
   - 访问 [travis-ci.com](https://travis-ci.com)
   - 使用GitHub账号登录
   - 启用项目的CI/CD

2. **环境变量设置**
   在Travis CI项目设置中添加：
   ```
   GITHUB_TOKEN=your_github_personal_access_token
   ```

3. **GitHub Token创建**
   - 访问GitHub Settings > Developer settings > Personal access tokens
   - 创建新token，勾选 `public_repo` 权限
   - 将token添加到Travis CI环境变量

### 构建流程

1. **提交代码** → 自动触发构建
2. **多平台编译** → 生成安装包
3. **创建标签** → 自动发布Release

## 📦 构建脚本说明

### 本地构建命令

```bash
# 安装依赖
npm install

# 下载ADB工具
npm run download-adb

# 开发模式
npm run dev

# 构建所有平台
npm run build

# 构建特定平台
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```

### 构建要求

- **Node.js**: 18.x 或 20.x
- **操作系统**: 
  - Linux: Ubuntu 20.04+
  - macOS: 10.15+
  - Windows: 10+

## 🔍 故障排除

### 常见问题

1. **ADB下载失败**
   ```bash
   # 手动下载ADB工具
   npm run download-adb
   ```

2. **权限问题 (Linux/macOS)**
   ```bash
   # 确保ADB文件有执行权限
   chmod +x resources/adb/adb
   ```

3. **Windows构建失败**
   - 确保安装了Python 3.8+
   - 确保安装了Visual Studio Build Tools

### 日志查看

- **GitHub Actions**: 在Actions页签查看详细日志
- **Travis CI**: 在travis-ci.com查看构建日志

## 📋 发布检查清单

发布新版本前请确保：

- [ ] 代码已合并到main分支
- [ ] 更新了package.json中的版本号
- [ ] 更新了CHANGELOG.md
- [ ] 所有测试通过
- [ ] 创建了对应的Git标签
- [ ] Release notes已准备好

## 🔗 相关链接

- [Travis CI文档](https://docs.travis-ci.com/)
- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Electron Builder文档](https://www.electron.build/)
- [Node.js版本支持](https://nodejs.org/en/about/releases/) 