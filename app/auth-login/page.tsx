'use client'

import { useEffect, useRef } from 'react'
import { useAuth } from '../components/AuthProvider'
import { useRouter } from 'next/navigation'
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../utils/firebaseConfig'
import './login.css'

declare global {
  interface Window {
    google: any;
  }
}

//const auth = getAuth()
const currentUser = auth.currentUser
console.log('[currentUser]', currentUser)

export default function LoginPage() {
  const router = useRouter()
  const { setGoogleAccessToken, setUid } = useAuth()
  const tokenClientRef = useRef<any>(null)

  useEffect(() => {
    if (!window.google || tokenClientRef.current) return

    // scripts da Google Identity API
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: '996833302397-gsksfg2ujfqgt27jg5ulti0ffrnmje9a.apps.googleusercontent.com',
      scope: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/contacts.readonly'
      ].join(' '),
      callback: async (tokenResponse: { access_token: string }) => {
        const accessToken = tokenResponse.access_token
      
        // Buscar dados do usuário (opcional, se quiser customizar UI)
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        const userInfo = await res.json()
      
        // Salvar no localStorage e contexto
        localStorage.setItem('googleAccessToken', accessToken)
        localStorage.setItem('userInfo', JSON.stringify(userInfo))
        setGoogleAccessToken(accessToken)
      
        // ✅ Criar a credencial Firebase com o access_token do Google
        const credential = GoogleAuthProvider.credential(null, accessToken)
      
        // 🔐 Autenticar com Firebase
        signInWithCredential(auth, credential)
          .then(userCredential => {
            console.log('🪪 Usuário autenticado no Firebase:', userCredential.user)
            localStorage.setItem('firebaseUid', userCredential.user.uid) // Salvar o uid no localStorage
            setUid(userCredential.user.uid)

            // Redirecionar
            router.push('/')
          })
          .catch(error => {
            console.error('Erro ao autenticar com Firebase:', error)
          })
      
      }
    })
  }, [setGoogleAccessToken, router])

  const handleLogin = () => {
    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken()
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title title-logo">Connexus</h1>

        {/* Botão customizado para login */}
        <button
          type="button"
          onClick={handleLogin}
          className="group relative w-full overflow-hidden rounded-md bg-blue-600 px-6 py-3 text-white transition-colors duration-1000 hover:bg-red-600 focus:outline-none"
        >
          <span className="relative z-10">Entrar com Google</span>
          <div className="absolute inset-x-0 bottom-0 h-0 text-white bg-red-600 transition-all duration-300 group-hover:h-full"></div>
        </button>

        <p className="text-gray-300 sm:text-sm text-center mt-4">version 0.1.4</p>
      </div>
    </div>
  )
}
