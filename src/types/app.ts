/**
 * 应用信息接口
 */
export interface AppInfo {
  packageName: string
  appName: string
  versionName: string
  versionCode: string
  isSystem: boolean
  isRunning: boolean
  installTime: string
  permissions?: string[]
  targetSdk?: string
  minSdk?: string
  size?: string
  updateTime?: string
  isEnabled?: boolean
  icon?: string
} 