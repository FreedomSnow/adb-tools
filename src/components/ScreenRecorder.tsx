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
      const stopResult = await window.adbToolsAPI.stopScreenRecord(selectedDevice.id, tempFileName)
      if (!stopResult.success) {
        message.error('停止录屏失败：' + stopResult.error)
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
      
      if (pullResult.success 
          || pullResult.data?.includes('1 file pulled')
          || pullResult.error?.includes('1 file pulled')) {
        message.success('录屏文件已保存')
        // 删除设备上的临时文件
        await window.adbToolsAPI.execAdbCommand(
          `-s ${selectedDevice.id} shell rm /sdcard/${tempFileName}`
        )
        return filePath
      } else {
        message.error('保存录屏文件失败：' + pullResult.error)
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