import { useState, useEffect } from 'react'

type DeviceType = 'mobile' | 'tablet' | 'desktop'

/**
 * Detecta o tipo de dispositivo com base na largura da janela.
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function useDeviceType(): DeviceType {
  const getDeviceType = () => {
    if (typeof window === 'undefined') return 'mobile'
    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  const [deviceType, setDeviceType] = useState<DeviceType>(getDeviceType)

  useEffect(() => {
    const handleResize = () => {
      setDeviceType(getDeviceType())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return deviceType
}
