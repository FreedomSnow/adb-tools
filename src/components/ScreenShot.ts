import { Device } from '../contexts/DeviceContext'

/**
 * 生成截屏文件名
 * @returns 格式为 "adbtools-yyyyMMddHHmmss.png" 的文件名
 */
export const generateScreenshotFileName = (): string => {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')
  return `adbtools-${timestamp}.png`
}

/**
 * 截取设备屏幕
 * @param device 目标设备
 * @returns 保存的文件路径
 */
export const captureScreen = async (device: Device): Promise<string> => {
  const fileName = generateScreenshotFileName()

  // 打开文件保存对话框
  const saveResult = await window.adbToolsAPI.showSaveDialog({
    title: '保存截图',
    defaultPath: await window.adbToolsAPI.joinPath(
      await window.adbToolsAPI.getUserHomeDir(),
      'Downloads',
      fileName
    ),
    filters: [
      { name: 'PNG图片', extensions: ['png'] }
    ]
  })

  if (saveResult.canceled || !saveResult.filePath) {
    throw new Error('已取消保存')
  }

  // 截取屏幕
  const screenshotResult = await window.adbToolsAPI.execAdbCommand(
    `-s ${device.id} shell screencap -p /sdcard/${fileName}`
  )

  if (!screenshotResult.success) {
    throw new Error(screenshotResult.error || '截屏失败')
  }

  // 将截图从设备拉取到用户选择的路径
  const pullResult = await window.adbToolsAPI.execAdbCommand(
    `-s ${device.id} pull /sdcard/${fileName} "${saveResult.filePath}"`
  )
  console.log(pullResult)

  // 检查 pull 命令的输出是否包含成功信息
  if (!pullResult.data?.includes('1 file pulled') && !pullResult.error?.includes('1 file pulled')) {
    throw new Error(pullResult.error || '保存截图失败')
  }

  // 删除设备上的临时文件
  await window.adbToolsAPI.execAdbCommand(
    `-s ${device.id} shell rm /sdcard/${fileName}`
  )

  return saveResult.filePath
} 