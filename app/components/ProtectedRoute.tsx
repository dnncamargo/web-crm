'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    console.log('[ProtectedRoute] loading:', loading)
    console.log('[ProtectedRoute] user:', user)

    if (!loading) {
      if (user) {
        console.log('[ProtectedRoute] Autenticado')
        setChecked(true)
      } else {
        console.log('[ProtectedRoute] Redirecionando para login...')
        router.replace('/auth-login')
      }
    }
  }, [loading, user, router])

  if (loading || !checked) {
    return <p>Verificando autenticação...</p>
  }

  return <>{children}</>
};