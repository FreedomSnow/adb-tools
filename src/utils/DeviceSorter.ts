import { Device } from '../contexts/DeviceContext'

/**
 * 设备排序器类
 * 用于管理设备的排序逻辑，包括：
 * 1. 连接方式排序（USB > WiFi > 以太网）
 * 2. 在线状态排序（在线 > 离线 > 未授权）
 * 3. 最后连接时间排序（最新的在前）
 */
export class DeviceSorter {
  private deviceLastConnectedTime: Record<string, number> = {}

  /**
   * 更新设备的最后连接时间
   * @param deviceId 设备ID
   */
  updateLastConnectedTime(deviceId: string) {
    this.deviceLastConnectedTime[deviceId] = Date.now()
  }

  /**
   * 获取设备的最后连接时间
   * @param deviceId 设备ID
   * @returns 最后连接时间的时间戳
   */
  getLastConnectedTime(deviceId: string): number {
    return this.deviceLastConnectedTime[deviceId] || 0
  }

  /**
   * 对设备列表进行排序
   * @param devices 设备列表
   * @returns 排序后的设备列表
   */
  sortDevices(devices: Device[]): Device[] {
    return [...devices].sort((a, b) => {
      // 1. 首先按连接方式排序（USB > WiFi > 以太网）
      const connectionOrder = { usb: 0, wifi: 1, ethernet: 2 }
      const connectionDiff = connectionOrder[a.connection] - connectionOrder[b.connection]
      if (connectionDiff !== 0) return connectionDiff

      // 2. 然后按在线状态排序（在线 > 离线 > 未授权）
      const statusOrder = { device: 0, offline: 1, unauthorized: 2 }
      const statusDiff = statusOrder[a.status] - statusOrder[b.status]
      if (statusDiff !== 0) return statusDiff

      // 3. 最后按最后连接时间排序（最新的在前）
      const timeA = this.getLastConnectedTime(a.id)
      const timeB = this.getLastConnectedTime(b.id)
      return timeB - timeA
    })
  }
} 