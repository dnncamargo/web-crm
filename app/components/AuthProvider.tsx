'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface User {
  name: string
  email: string
  picture: string
}

interface AuthContextType {
  user: User | null
  setUser: (user: User | null) => void
  uid: string | null
  setUid: (uid: string | null) => void
  loading: boolean
  googleAccessToken: string | null
  setGoogleAccessToken: (token: string | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => { },
  uid: null,
  loading: true,
  googleAccessToken: null,
  setGoogleAccessToken: () => { },
  setUid: () => { }
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  let tokenClient: google.accounts.oauth2.TokenClient | null = null

  useEffect(() => {
    const token = localStorage.getItem('googleAccessToken')

    const waitForFirebaseUid = async (): Promise<string | null> => {
      let retries = 10
      while (retries-- > 0) {
        const storedUid = localStorage.getItem('firebaseUid')
        if (storedUid) return storedUid
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      return null
    }

    const restoreSession = async () => {
      if (!token) {
        console.warn('[AuthProvider] Nenhum token encontrado — sessão inválida.')
        setLoading(false)
        return
      }

      const savedUid = await waitForFirebaseUid()

      if (!savedUid) {
        console.warn('[AuthProvider] UID não encontrado após tentativas.')
        setLoading(false)
        return
      }

      setGoogleAccessToken(token)
      setUid(savedUid)

      // ⬇️ Neste ponto, podemos liberar o app — já temos token e UID
      setLoading(false)

      // ⬇️ Busca de perfil (opcional e paralela)
      try {
        const res = await fetch(
          'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos,birthdays,addresses,phoneNumbers',
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        )

        if (!res.ok) {
          throw new Error(`Erro ao buscar perfil: ${res.status}`)
        }

        const data = await res.json()
        const name = data.names?.[0]?.displayName || ''
        const picture = data.photos?.[0]?.url || data.picture || ''
        const email = data.emailAddresses?.[0]?.value || ''

        const userData: User = { name, email, picture }
        setUser(userData)
        localStorage.setItem('userInfo', JSON.stringify(userData))

        console.log('[AuthProvider] Perfil carregado com sucesso.', userData)
      } catch (error) {
        console.warn('[AuthProvider] Falha ao buscar perfil do usuário:', error)
        setUser(null)
        localStorage.removeItem('userInfo')
      }
    }

    restoreSession()

    // Dentro do useEffect, após setGoogleAccessToken e setUid:
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2 && googleAccessToken) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: '996833302397-gsksfg2ujfqgt27jg5ulti0ffrnmje9a.apps.googleusercontent.com',
        scope: [
          'openid',
          'profile',
          'email',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/contacts.readonly'].join(''),
          callback: (response: google.accounts.oauth2.TokenResponse) => {
            if (response.error) {
              console.error('[AuthProvider] Erro ao renovar token:', response)
              return
            }

            const newToken = response.access_token
            setGoogleAccessToken(newToken)
            localStorage.setItem('googleAccessToken', newToken)
            console.log('[AuthProvider] Token renovado com sucesso.')
          }
      })

      // 🔁 Define intervalo de renovação
      const intervalId = setInterval(() => {
        console.log('[AuthProvider] Renovando token Google...')
        tokenClient?.requestAccessToken({ prompt: '' })
      }, 50 * 60 * 1000)

      // 🧹 Limpa o intervalo ao desmontar
      return () => clearInterval(intervalId)
    }

  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        uid,
        loading,
        googleAccessToken,
        setGoogleAccessToken,
        setUid
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

