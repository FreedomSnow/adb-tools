const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ADB 下载链接（Google官方）
const ADB_DOWNLOADS = {
  win32: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
  darwin: 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
  linux: 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip'
}

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    
    https.get(url, (response) => {
      if (response.statusCode === 302) {
        // 处理重定向
        return downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject)
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`))
        return
      }
      
      response.pipe(file)
      
      file.on('finish', () => {
        file.close()
        resolve()
      })
      
      file.on('error', (err) => {
        fs.unlink(dest, () => {}) // 删除损坏的文件
        reject(err)
      })
    }).on('error', reject)
  })
}

const extractZip = (zipPath, extractPath) => {
  const platform = process.platform
  
  try {
    if (platform === 'win32') {
      // Windows使用PowerShell解压
      execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`)
    } else {
      // macOS和Linux使用unzip
      execSync(`unzip -o "${zipPath}" -d "${extractPath}"`)
    }
  } catch (error) {
    throw new Error(`解压失败: ${error.message}`)
  }
}

const downloadAdb = async () => {
  const platform = process.platform
  const adbUrl = ADB_DOWNLOADS[platform]
  
  if (!adbUrl) {
    throw new Error(`不支持的平台: ${platform}`)
  }
  
  const resourcesDir = path.join(__dirname)
  const adbDir = path.join(resourcesDir, 'adb')
  const zipPath = path.join(resourcesDir, 'platform-tools.zip')
  
  console.log('正在下载ADB工具...')
  console.log(`平台: ${platform}`)
  console.log(`下载链接: ${adbUrl}`)
  
  try {
    // 创建目录
    if (!fs.existsSync(adbDir)) {
      fs.mkdirSync(adbDir, { recursive: true })
    }
    
    // 下载压缩包
    await downloadFile(adbUrl, zipPath)
    console.log('下载完成，正在解压...')
    
    // 解压到临时目录
    const tempDir = path.join(resourcesDir, 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    
    extractZip(zipPath, tempDir)
    
    // 移动platform-tools内容到adb目录
    const platformToolsDir = path.join(tempDir, 'platform-tools')
    if (fs.existsSync(platformToolsDir)) {
      const files = fs.readdirSync(platformToolsDir)
      files.forEach(file => {
        const srcPath = path.join(platformToolsDir, file)
        const destPath = path.join(adbDir, file)
        fs.renameSync(srcPath, destPath)
      })
    }
    
    // 清理临时文件
    fs.unlinkSync(zipPath)
    fs.rmSync(tempDir, { recursive: true, force: true })
    
    // 设置执行权限（macOS和Linux）
    if (platform !== 'win32') {
      const adbPath = path.join(adbDir, 'adb')
      if (fs.existsSync(adbPath)) {
        fs.chmodSync(adbPath, '755')
      }
    }
    
    console.log('ADB工具安装完成！')
    console.log(`安装目录: ${adbDir}`)
    
  } catch (error) {
    console.error('下载ADB失败:', error.message)
    process.exit(1)
  }
}

// 检查是否已经存在ADB
const checkAdbExists = () => {
  const platform = process.platform
  const adbDir = path.join(__dirname, 'adb')
  const adbPath = path.join(adbDir, platform === 'win32' ? 'adb.exe' : 'adb')
  
  return fs.existsSync(adbPath)
}

if (require.main === module) {
  if (checkAdbExists()) {
    console.log('ADB工具已存在，跳过下载')
  } else {
    downloadAdb()
  }
}

module.exports = { downloadAdb, checkAdbExists } 