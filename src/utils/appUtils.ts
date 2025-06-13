import type { AppInfo } from '../types/app'

/**
 * 应用类型
 */
export type AppType = 'all' | 'system' | 'user'

/**
 * 获取已安装应用列表
 * @param deviceId 设备ID
 * @param type 应用类型，默认为 'all'
 * @returns 应用列表
 */
export const getInstalledApps = async (deviceId: string, type: AppType = 'all'): Promise<AppInfo[]> => {
  try {
    // 根据类型选择不同的 adb 命令
    const command = type === 'system' 
      ? `-s ${deviceId} shell pm list packages -s`  // 系统应用
      : type === 'user'
        ? `-s ${deviceId} shell pm list packages -3`  // 用户应用
        : `-s ${deviceId} shell pm list packages`  // 所有应用

    const result = await window.adbToolsAPI.execAdbCommand(command)
    
    if (!result.success) {
      throw new Error(result.error || '获取应用列表失败')
    }

    // 解析应用列表
    const packages = result.data?.split('\n')
      .filter(line => line.startsWith('package:'))
      .map(line => line.replace('package:', '').trim())
      .filter(pkg => pkg.length > 0)

    if (!packages?.length) {
      return []
    }

    // 获取每个应用的详细信息
    const apps: AppInfo[] = []
    for (const pkg of packages) {
      const appInfo = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell dumpsys package ${pkg}`)
      if (appInfo.success) {
        const info = appInfo.data || ''
        const isSystem = info.includes('pkgFlags=SYSTEM')
        const isRunning = info.includes('running=true')
        const versionMatch = info.match(/versionName=([^\s]+)/)
        const versionCodeMatch = info.match(/versionCode=(\d+)/)
        const installTimeMatch = info.match(/firstInstallTime=([^\s]+)/)
        
        apps.push({
          packageName: pkg,
          appName: pkg, // 暂时使用包名作为应用名
          versionName: versionMatch?.[1] || '',
          versionCode: versionCodeMatch?.[1] || '',
          isSystem,
          isRunning,
          installTime: installTimeMatch?.[1] || ''
        })
      }
    }

    return apps
  } catch (error) {
    console.error('获取应用列表失败:', error)
    throw error
  }
}

/**
 * 获取应用列表总数
 * @param apps 应用列表
 * @param type 应用类型，默认为 'all'
 * @returns 应用总数
 */
export const getAppCount = (apps: AppInfo[], type: AppType = 'all'): number => {
  switch (type) {
    case 'system':
      return apps.filter(app => app.isSystem).length
    case 'user':
      return apps.filter(app => !app.isSystem).length
    case 'all':
    default:
      return apps.length
  }
}

/**
 * 获取分页后的应用列表
 * @param apps 应用列表
 * @param currentPage 当前页码
 * @param pageSize 每页条数
 * @returns 分页后的应用列表
 */
export const getPaginatedApps = (
  apps: AppInfo[],
  currentPage: number,
  pageSize: number
): AppInfo[] => {
  const start = (currentPage - 1) * pageSize
  const end = start + pageSize
  return apps.slice(start, end)
} 