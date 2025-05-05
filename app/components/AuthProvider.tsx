'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface User {
  name: string
  email: string
  photoUrl: string
}

interface AuthContextType {
  user: User | null
  uid: string | null
  loading: boolean
  googleAccessToken: string | null
  setGoogleAccessToken: (token: string | null) => void
  setUid: (uid: string | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  uid: null,
  loading: true,
  googleAccessToken: null,
  setGoogleAccessToken: () => {},
  setUid: () => {}
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)


  // Carrega token do localStorage na inicialização
  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken')
    const savedUid = localStorage.getItem('firebaseUid')
    if (!token || !savedUid) {
      setLoading(false)
      return
    }
  
    const fetchUserInfo = async () => {
      try {
        setGoogleAccessToken(token) // importante manter isso para consistência
        setUid(savedUid) // recupera o uid do Firebase
  
        const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
  
        if (!res.ok) throw new Error('Erro ao buscar dados do usuário')
  
        const data = await res.json()
  
        const name = data.names?.[0]?.displayName || ''
        const email = data.emailAddresses?.[0]?.value || ''
        const photoUrl = data.photos?.[0]?.url || ''
  
        const userData: User = { name, email, photoUrl }
        setUser(userData)
        localStorage.setItem('userInfo', JSON.stringify(userData))

        console.log('[AuthProvider] Usuário restaurado via localStorage:', { userData, savedUid })

      } catch (error) {
        console.error('[AuthProvider] Erro ao restaurar sessão:', error)
        setUser(null)
        setGoogleAccessToken(null)
        setUid(null)
        localStorage.removeItem('googleAccessToken')
        localStorage.removeItem('firebaseUid')
      } finally {
        setLoading(false)
      }
    }
  
    fetchUserInfo()
  }, []) 

  // Quando o token mudar, busca os dados do usuário
  useEffect(() => {
    if (!googleAccessToken) {
      setUser(null)
      setUid(null)
      return
    }

    const fetchUserInfo = async () => {
      try {
        const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos', {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
          },
        })

        if (!res.ok) {
          throw new Error('Erro ao buscar dados do usuário')
        }

        const data = await res.json()

        const name = data.names?.[0]?.displayName || ''
        const email = data.emailAddresses?.[0]?.value || ''
        const photoUrl = data.photos?.[0]?.url || ''

        const userData: User = { name, email, photoUrl }
        setUser(userData)
        localStorage.setItem('userInfo', JSON.stringify(userData))
        console.log('[AuthProvider] Usuário autenticado:', userData)
      } catch (error) {
        console.error('[AuthProvider] Erro ao obter perfil do usuário:', error)
        setUser(null)
        setGoogleAccessToken(null)
        localStorage.removeItem('googleAccessToken')
      }
    }

    fetchUserInfo()
  }, [googleAccessToken])

  return (
    <AuthContext.Provider
  value={{
    user,
    uid: uid,
    loading,
    googleAccessToken,
    setGoogleAccessToken,
    setUid: setUid
  }}
>
  {children}
</AuthContext.Provider>

  )
}
