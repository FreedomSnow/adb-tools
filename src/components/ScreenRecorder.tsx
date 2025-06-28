import { message } from 'antd'
import { useDevice } from '../contexts/DeviceContext'

// 生成录屏文件名
export const generateScreenRecordFileName = (): string => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')
  return `adbtools-${timestamp}.mp4`
}

export const useScreenRecorder = () => {
  const { selectedDevice } = useDevice()

  const startRecording = async (fileName: string): Promise<boolean> => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return false
    }

    if (selectedDevice.status !== 'device') {
      message.error('设备未连接或未授权')
      return false
    }

    try {
      console.log('startRecording', selectedDevice.id, fileName)
      const result = await window.adbToolsAPI.startScreenRecord(selectedDevice.id, fileName)
      if (result.success) {
        message.success('开始录屏')
        return true
      } else {
        message.error('开始录屏失败：' + result.error)
        return false
      }
    } catch (error: any) {
      message.error('开始录屏失败：' + error.message)
      return false
    }
  }

  const stopRecording = async (tempFileName: string): Promise<string> => {
    if (!selectedDevice) {
      message.error('请先选择设备')
      return ''
    }

    try {
      // 使用进程管理停止录屏
      console.log('stopRecording', selectedDevice.id, tempFileName)
      const stopResult = await window.adbToolsAPI.stopScreenRecord(selectedDevice.id, tempFileName)
      if (!stopResult.success) {
        message.error('停止录屏失败：' + stopResult.error)
        return ''
      }
      
      // 等待一段时间确保文件写入完成
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 先检查设备上的文件是否存在
      const checkFileResult = await window.adbToolsAPI.execAdbCommand(
        `-s ${selectedDevice.id} shell ls -la /sdcard/${tempFileName}`
      )
      
      if (!checkFileResult.success || (checkFileResult.data && checkFileResult.data.includes('No such file'))) {
        message.error('录屏文件不存在，可能录屏时间太短或文件写入失败')
        return ''
      }
      
      // 获取保存路径
      const saveResult = await window.adbToolsAPI.showSaveDialog({
        title: '保存录屏文件',
        defaultPath: await window.adbToolsAPI.joinPath(
          await window.adbToolsAPI.getUserHomeDir(),
          'Downloads',
          tempFileName
        ),
        filters: [{ name: 'Videos', extensions: ['mp4'] }]
      })

      if (saveResult.canceled || !saveResult.filePath) {
        message.info('已取消保存')
        return ''
      }

      const filePath = saveResult.filePath

      // 将文件从设备拉取到本地
      const pullResult = await window.adbToolsAPI.execAdbCommand(
        `-s ${selectedDevice.id} pull /sdcard/${tempFileName} "${saveResult.filePath}"`
      )
      
      console.log('Pull结果:', pullResult)
      
      // 改进成功检测逻辑
      const isSuccess = pullResult.success || 
                       pullResult.data?.includes('1 file pulled') ||
                       pullResult.data?.includes('files pulled') ||
                       pullResult.error?.includes('1 file pulled') ||
                       pullResult.error?.includes('files pulled')
      
      if (isSuccess) {
        message.success('录屏文件已保存')
        // 删除设备上的临时文件
        try {
          await window.adbToolsAPI.execAdbCommand(
            `-s ${selectedDevice.id} shell rm /sdcard/${tempFileName}`
          )
        } catch (cleanupError) {
          console.warn('清理设备临时文件失败:', cleanupError)
        }
        return filePath
      } else {
        // 检查本地文件是否实际存在
        try {
          const fs = require('fs')
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            if (stats.size > 0) {
              message.success('录屏文件已保存（文件存在且非空）')
              // 删除设备上的临时文件
              try {
                await window.adbToolsAPI.execAdbCommand(
                  `-s ${selectedDevice.id} shell rm /sdcard/${tempFileName}`
                )
              } catch (cleanupError) {
                console.warn('清理设备临时文件失败:', cleanupError)
              }
              return filePath
            }
          }
        } catch (fileCheckError) {
          console.warn('检查本地文件失败:', fileCheckError)
        }
        
        message.error('保存录屏文件失败：' + (pullResult.error || '未知错误'))
        return ''
      }
    } catch (error: any) {
      message.error('停止录屏失败：' + error.message)
      return ''
    }
  }

  return {
    startRecording,
    stopRecording
  }
} 