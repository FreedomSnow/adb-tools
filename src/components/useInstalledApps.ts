import { useState, useCallback } from 'react'
import { AppInfo } from '@/types/app'

// 只包含包名，用于初始列表
interface PackageInfo {
  packageName: string
}

// 包含应用详情
interface AppDetail {
  appName: string
  versionName: string
  versionCode: string
  isRunning: boolean
  installTime: string
  isSystem: boolean
}

interface UseInstalledAppsResult {
  loading: boolean
  apps: AppInfo[]
  error: string | null
  total: number
  fetchApps: (deviceId: string, searchType?: 'all' | 'system' | 'user', searchContent?: string) => Promise<void>
  loadPageDetails: (deviceId: string, page: number, pageSize: number, packageList?: PackageInfo[]) => Promise<void>
}

interface AppDetailCache {
  [packageName: string]: {
    detail: AppDetail
    timestamp: number
  }
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000 // 5分钟

export default function useInstalledApps(): UseInstalledAppsResult {
  const [loading, setLoading] = useState(false)
  const [apps, setApps] = useState<AppInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  
  const [allPackages, setAllPackages] = useState<PackageInfo[]>([])
  const [detailCache, setDetailCache] = useState<AppDetailCache>({})
  const [loadedPackages, setLoadedPackages] = useState<Set<string>>(new Set())

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const getAppDetail = useCallback(async (deviceId: string, packageName: string): Promise<AppDetail> => {
    const cached = detailCache[packageName]
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRE_TIME) {
      return cached.detail
    }

    try {
      // 先执行 adb root
      await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} root`)
      // 再执行 dumpsys package
      const command = `-s ${deviceId} shell dumpsys package ${packageName}`
      const result = await window.adbToolsAPI.execAdbCommand(command)
      
      if (result.success && result.data) {
        const lines = result.data.split('\n')
        let appName = packageName
        let versionName = ''
        let versionCode = ''
        let isRunning = false
        let installTime = ''
        let isSystem = false

        // 优先取 application-label:，没有则取 application-label-zh-CN: 或 application-label-zh:
        let appLabelLine = lines.find(l => l.includes('application-label:'))
        if (!appLabelLine) {
          appLabelLine = lines.find(l => l.includes('application-label-zh-CN:'))
        }
        if (!appLabelLine) {
          appLabelLine = lines.find(l => l.includes('application-label-zh:'))
        }
        if (appLabelLine) {
          const match = appLabelLine.match(/'([^']+)'/)
          if (match && match[1]) appName = match[1]
        }

        const versionNameLine = lines.find(l => l.trim().startsWith('versionName='))
        if (versionNameLine) {
          const match = versionNameLine.match(/versionName=(.*)/)
          if (match && match[1]) versionName = match[1].trim()
        }

        const versionCodeLine = lines.find(l => l.trim().startsWith('versionCode='))
        if (versionCodeLine) {
          const match = versionCodeLine.match(/versionCode=(.*)/)
          if (match && match[1]) versionCode = match[1].trim()
        }

        const codePathLine = lines.find(l => l.trim().startsWith('codePath='))
        if (codePathLine) {
          const match = codePathLine.match(/codePath=(.*)/)
          if (match && match[1]) isSystem = match[1].includes('/system/')
        }

        const runningResult = await window.adbToolsAPI.execAdbCommand(`-s ${deviceId} shell ps | grep ${packageName}`)
        isRunning = Boolean(runningResult.success && runningResult.data && runningResult.data.includes(packageName))

        const detail: AppDetail = { appName, versionName, versionCode, isRunning, installTime, isSystem }

        setDetailCache(prev => ({ ...prev, [packageName]: { detail, timestamp: Date.now() } }))
        return detail
      } else {
        throw new Error(`获取应用详情失败: ${result.error}`)
      }
    } catch (error) {
      console.error(`获取应用 ${packageName} 详情失败:`, error)
      return { appName: packageName, versionName: 'N/A', versionCode: 'N/A', isRunning: false, installTime: '', isSystem: false }
    }
  }, [detailCache])

  const loadPageDetails = useCallback(async (deviceId: string, page: number, pageSize: number, packageList?: PackageInfo[]) => {
    const packagesToUse = packageList || allPackages
    if (!packagesToUse.length) {
        setApps([])
        return
    }

    setCurrentPage(page)
    setPageSize(pageSize)

    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const pagePackages = packagesToUse.slice(startIndex, endIndex)

    const placeholderApps: AppInfo[] = pagePackages.map(pkg => {
        const cached = detailCache[pkg.packageName]
        if (cached && loadedPackages.has(pkg.packageName)) {
            return { ...pkg, ...cached.detail }
        }
        return {
            packageName: pkg.packageName,
            appName: pkg.packageName,
            versionName: '加载中...',
            versionCode: '',
            isSystem: false,
            isRunning: false,
            installTime: '',
        }
    })
    setApps(placeholderApps)

    const packagesToLoad = pagePackages.filter(pkg => !loadedPackages.has(pkg.packageName))

    if (packagesToLoad.length > 0) {
        const detailPromises = packagesToLoad.map(pkg => getAppDetail(deviceId, pkg.packageName))
        const details = await Promise.all(detailPromises)
        const detailMap = new Map<string, AppDetail>()
        details.forEach((detail, index) => {
            detailMap.set(packagesToLoad[index].packageName, detail)
        })

        setApps(currentApps =>
            currentApps.map(app => {
                const detail = detailMap.get(app.packageName)
                return detail ? { ...app, ...detail } : app
            })
        )
        
        setLoadedPackages(prev => {
            const newSet = new Set(prev)
            packagesToLoad.forEach(pkg => newSet.add(pkg.packageName))
            return newSet
        })
    }
}, [allPackages, detailCache, getAppDetail, loadedPackages])

  const fetchApps = useCallback(async (
    deviceId: string,
    searchType: 'all' | 'system' | 'user' = 'all',
    searchContent: string = ''
  ) => {
    setLoading(true)
    setError(null)
    setApps([])

    try {
        let command = `-s ${deviceId} shell pm list packages`;
        if (searchType === 'system') {
            command = `-s ${deviceId} shell pm list packages -s`;
        } else if (searchType === 'user') {
            command = `-s ${deviceId} shell pm list packages -3`;
        }

        const result = await window.adbToolsAPI.execAdbCommand(command)

        if (!result.success || !result.data) {
            throw new Error(result.error || '获取应用列表失败')
        }

        console.log('result.data', result.data)
        let packages = result.data.split('\n')
            .map(line => {
                const match = line.match(/package:(.*)/)
                return match ? { packageName: match[1].trim() } : null
            })
            .filter((p): p is PackageInfo => p !== null)

        if (searchContent) {
            const searchLower = searchContent.toLowerCase()
            packages = packages.filter(pkg =>
                pkg.packageName.toLowerCase().includes(searchLower)
            )
        }
        
        setAllPackages(packages)
        setTotal(packages.length)
        setLoadedPackages(new Set())
        
        await loadPageDetails(deviceId, 1, 10, packages)

    } catch (e: any) {
        console.error('获取应用列表失败:', e)
        setError(e.message || '获取应用列表失败')
        setApps([])
        setTotal(0)
    } finally {
        setLoading(false)
    }
  }, [getAppDetail, loadPageDetails])
  
  return { 
    loading, 
    apps, 
    error, 
    total,
    fetchApps, 
    loadPageDetails 
  }
} 