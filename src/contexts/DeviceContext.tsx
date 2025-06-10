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
}

interface DeviceContextType {
  selectedDevice: Device | null
  setSelectedDevice: (device: Device | null) => void
  devices: Device[]
  setDevices: (devices: Device[]) => void
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined)

interface DeviceProviderProps {
  children: ReactNode
}

export const DeviceProvider: React.FC<DeviceProviderProps> = ({ children }) => {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [devices, setDevices] = useState<Device[]>([])

  return (
    <DeviceContext.Provider value={{
      selectedDevice,
      setSelectedDevice,
      devices,
      setDevices
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