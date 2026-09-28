'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { uid, googleAccessToken, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    console.log('[ProtectedRoute] ⏳ loading:', loading)
    console.log('[ProtectedRoute] 🪪 uid:', uid)
    console.log('[ProtectedRoute] 🪙 token:', googleAccessToken)

    if (loading) return

    if (!googleAccessToken || !uid) {
      console.warn('[ProtectedRoute] ❌ Sessão inválida — redirecionando para login...')
      router.replace('/auth-login')
      return
    }

    console.log('[ProtectedRoute] ✅ Sessão válida com token e uid — prosseguindo')
    setChecked(true)
  }, [loading, uid, googleAccessToken, router])

  if (loading || !checked) {
    return <div className="animate-pulse text-gray-500 m-6">Verificando autenticação...</div>
  }

  return <>{children}</>
}


/* // ProtectedRoute.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, uid, googleAccessToken, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    console.log('[ProtectedRoute] loading:', loading)
    console.log('[ProtectedRoute] uid:', uid)
    console.log('[ProtectedRoute] token:', googleAccessToken)
    console.log('[ProtectedRoute] user:', user)

    if (loading) {
      console.log('[ProtectedRoute] ⏳ Ainda carregando, aguardando...')
      return
    }

    if (!googleAccessToken) {
      console.warn('[ProtectedRoute] 🚫 Token ausente — redirecionando')
      router.replace('/auth-login')
      return
    }

    if (!uid) {
      console.warn('[ProtectedRoute] 🚫 UID ausente — redirecionando')
      router.replace('/auth-login')
      return
    }

    // Aguardamos o user se necessário, mas uid + token são suficientes
    console.log('[ProtectedRoute] ✅ Autenticado com token e uid')
    setChecked(true)
  }, [loading, uid, googleAccessToken, user, router])

  if (loading || !checked) {
    return <div className="animate-pulse text-gray-500 m-6">Verificando autenticação...</div>
  }

  return <>{children}</>
}
 */


/* 'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, uid, googleAccessToken, loading } = useAuth()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    console.log('[ProtectedRoute] ⌛ loading:', loading)
    console.log('[ProtectedRoute] 👤 user:', user)
    console.log('[ProtectedRoute] 🪪 uid:', uid)
    console.log('[ProtectedRoute] 🪙 token:', googleAccessToken)


    if (!loading) {
      if (user && uid && googleAccessToken) {
        console.log('[ProtectedRoute] ✅ Sessão autenticada com token de usuário Google e Firebase')
        setChecked(true)
      } else {
        console.log('[ProtectedRoute] 🔁 Redirecionando para login...')
        router.replace('/auth-login')
      }
    }
  }, [loading, user, router])

  if (loading || !checked) {
    return <div className="animate-pulse text-gray-500 m-6">Verificando autenticação...</div>
  }

  return <>{children}</>
}; */