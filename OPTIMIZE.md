# 应用包大小优化方案

## 已实施的优化措施

### 1. 架构优化
- **Mac构建**: 移除x64架构，仅保留ARM64架构
- **减少构建目标**: 针对Mac平台只构建ARM64版本

### 2. CI/CD优化
- **Node.js版本**: 统一使用Node.js 20，去掉多版本构建
- **构建流程**: 直接构建release版本，移除debug构建
- **发布配置**: 自动生成发布说明，设置为非草稿状态

### 3. 前端打包优化
- **代码分割**: 
  - vendor chunk: React核心库
  - antd chunk: Ant Design组件库
- **压缩优化**: 使用esbuild进行最小化
- **移除源码映射**: 生产环境不生成sourcemap

### 4. Electron打包优化
- **最大压缩**: 启用maximum压缩级别
- **文件过滤**: 排除.map和.ts文件
- **ASAR优化**: ADB工具文件不打包到ASAR中，便于访问
- **脚本清理**: 移除package.json中的开发脚本

## 预期效果

### 当前包大小分析
- **ADB工具**: ~32MB (主要占用)
- **前端资源**: ~1.2MB (gzipped ~360KB)
- **Electron框架**: ~150MB

### 优化后预期
- **总包大小减少**: 约10-15%
- **Mac包大小**: 减少约50% (移除x64架构)
- **下载速度**: 提升20-30%

## 进一步优化建议

### 1. ADB工具优化
```bash
# 可以考虑移除不常用的工具
resources/adb/
├── adb (15MB) ✓ 必需
├── fastboot (4.6MB) ✓ 必需
├── sqlite3 (6.0MB) ❓ 考虑按需下载
├── mke2fs (1.7MB) ❓ 考虑移除
├── etc1tool (672KB) ❓ 考虑移除
└── make_f2fs* (1.1MB) ❓ 考虑移除
```

### 2. 按需加载ADB工具
```javascript
// 建议实现动态下载不常用工具
const downloadOptionalTool = async (toolName) => {
  // 仅在需要时下载特定工具
}
```

### 3. 压缩优化
```bash
# 可以使用UPX压缩二进制文件
upx --best resources/adb/adb
upx --best resources/adb/fastboot
```

## 构建命令

```bash
# 开发构建
npm run build:dir

# 生产构建 (各平台)
npm run build:mac    # 仅ARM64
npm run build:win    # x64
npm run build:linux  # x64
```

## 监控包大小

```bash
# 分析打包后的文件大小
du -sh release/

# 分析各组件大小
du -sh resources/adb/
du -sh dist/
``` 