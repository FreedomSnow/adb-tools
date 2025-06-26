import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface Device {
  id: string
  model: string
  status: 'device' | 'offline' | 'unauthorized'
  connection: 'usb' | 'wifi' | 'ethernet'
  androidVersion?: string
  apiLevel?: string
  manufacturer?: string
  serialNumber: string
  device?: string // 新增device字段
}

interface DeviceContextType {
  selectedDevice: Device | null
  setSelectedDevice: (device: Device | null) => void
  devices: Device[]
  setDevices: (devices: Device[]) => void
  hasRefreshedDeviceManager: boolean
  setHasRefreshedDeviceManager: (value: boolean) => void
  lastEnterDeviceManagerTime: number | null
  setLastEnterDeviceManagerTime: (value: number) => void
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

interface DeviceProviderProps {
  children: ReactNode
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({ children }) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [hasRefreshedDeviceManager, setHasRefreshedDeviceManager] = useState(false)
  const [lastEnterDeviceManagerTime, setLastEnterDeviceManagerTime] = useState<number | null>(null)

  return (
    <DeviceContext.Provider value={{
      selectedDevice,
      setSelectedDevice,
      devices,
      setDevices,
      hasRefreshedDeviceManager,
      setHasRefreshedDeviceManager,
      lastEnterDeviceManagerTime,
      setLastEnterDeviceManagerTime
    }}>
      {children}
    </DeviceContext.Provider>
  )
}

export const useDevice = () => {
  const context = useContext(DeviceContext)
  if (context === undefined) {
    throw new Error('useDevice must be used within a DeviceProvider')
  }
  return context
} 