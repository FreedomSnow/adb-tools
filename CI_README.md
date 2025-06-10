# CI/CD 配置说明

## 📋 概述

本项目提供了两种CI/CD配置方案：

1. **Travis CI** (`.travis.yml`)
2. **GitHub Actions** (`.github/workflows/build.yml`) - 推荐

## 🚀 GitHub Actions (推荐)

### 特性
- ✅ 支持多平台构建 (Linux, Windows, macOS)
- ✅ macOS构建完全免费 (公共仓库)
- ✅ 统一使用Node.js 20 LTS版本
- ✅ 使用最新的Actions (upload/download-artifact@v4)
- ✅ 优化的构建流程 (直接构建release版本)
- ✅ 自动构建和发布
- ✅ 构建产物自动上传
- ✅ 与GitHub深度集成
- ✅ macOS仅构建ARM64架构，包大小减少50%

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
- **Linux**: `*.AppImage` (x64)
- **Windows**: `*.exe` (x64)
- **macOS**: `*.dmg` (ARM64 only)

### 架构支持

| 平台 | 支持架构 | 说明 |
|------|----------|------|
| **Windows** | x64 | Intel/AMD 64位处理器 |
| **Linux** | x64 | Intel/AMD 64位处理器 |
| **macOS** | ARM64 | Apple Silicon (M1/M2/M3) |

> 📝 **注意**: macOS不再支持Intel x64架构，仅支持Apple Silicon (ARM64)

## 🔧 Travis CI

### 特性
- ✅ 多平台支持 (Linux, Windows)
- ⚠️ macOS构建已暂时注释 (Travis CI免费计划不支持macOS)
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
npm run build:win     # Windows (x64)
npm run build:mac     # macOS (ARM64 only)
npm run build:linux   # Linux (x64)
```

### 构建要求

- **Node.js**: 20.x LTS (推荐)
- **操作系统**: 
  - Linux: Ubuntu 20.04+
  - macOS: 11.0+ (Apple Silicon)
  - Windows: 10+

## 🍎 macOS构建说明

### 架构变更说明

**重要更新**: 从v1.0.0开始，macOS版本仅支持Apple Silicon (ARM64)架构：

- ✅ **Apple Silicon (M1/M2/M3)**: 完全支持
- ❌ **Intel Mac (x64)**: 不再支持

### 包大小优化

移除Intel架构支持后：
- 📦 **包大小减少**: 约50%
- ⚡ **下载速度**: 提升2倍
- 🔧 **维护成本**: 降低

### GitHub Actions vs Travis CI

| CI服务 | macOS支持 | 费用 | 架构支持 |
|--------|-----------|------|----------|
| **GitHub Actions** | ✅ 完全支持 | 🆓 免费 (公共仓库) | ARM64 only |
| **Travis CI** | ⚠️ 限制支持 | 💰 需要付费 | ARM64 only |

### 本地macOS构建

如果需要在本地构建macOS安装包：

```bash
# 克隆项目
git clone <your-repo-url>
cd adb-tools

# 安装依赖
npm install

# 构建macOS应用 (仅ARM64)
npm run build:mac
```

> ⚠️ **重要**: 需要在Apple Silicon Mac上构建，Intel Mac无法构建ARM64版本

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

4. **macOS架构不兼容**
   ```
   Error: Cannot run on Intel Mac
   ```
   **解决方案**: macOS版本仅支持Apple Silicon，Intel Mac用户请使用其他平台版本

5. **Node.js版本问题**
   ```
   Error: Node.js version mismatch
   ```
   **解决方案**: 统一使用Node.js 20 LTS版本

6. **GitHub Actions artifact错误**
   ```
   Error: This request has been automatically failed because it uses 
   a deprecated version of `actions/upload-artifact: v3`
   ```
   **解决方案**: 已更新到v4版本，确保使用最新的workflow配置

7. **GitHub Token错误**
   ```
   ⨯ GitHub Personal Access Token is not set, neither programmatically, nor using env "GH_TOKEN"
   ```
   **解决方案**: 已在构建步骤中添加`GH_TOKEN`环境变量，并设置`publish: null`防止自动发布

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
- [ ] 确认目标架构支持 (macOS仅ARM64)

## 🔗 相关链接

- [Travis CI文档](https://docs.travis-ci.com/)
- [GitHub Actions文档](https://docs.github.com/en/actions)
- [Electron Builder文档](https://www.electron.build/)
- [Node.js版本支持](https://nodejs.org/en/about/releases/)
- [Apple Silicon支持说明](https://developer.apple.com/documentation/apple-silicon) 