'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../utils/firebaseConfig'
import { useRouter } from 'next/navigation'
import './login.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const token = await userCredential.user.getIdToken()
      document.cookie = `token=${token}; path=/`
      router.push('/')
    } catch (error: any) {
      alert('Erro no login: ' + error.message)
    }
  }  

  return (
    <div className="login-container">
      <h1 className="login-title title-logo">Connexus</h1>
      <form onSubmit={handleLogin} className="login-card">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="login-input" required />
        <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="login-input" required />
        <button type="submit" className="login-button">Entrar</button>
      </form>
    </div>
  )
}
