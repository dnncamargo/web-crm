'use client'

import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../utils/firebaseConfig'
import { useRouter } from 'next/navigation'
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAuth } from '../components/AuthProvider'
import './login.css'


export default function LoginPage() {
  const router = useRouter()
  const { setGoogleAccessToken } = useAuth();

  useGoogleAuth(); // Hook para inicializar a autenticação do Google

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar'); // Solicita acesso ao Google Calendar
      provider.addScope('https://www.googleapis.com/auth/contacts.readonly'); // Solicita acesso aos contatos do Google
      provider.addScope('https://www.googleapis.com/auth/user.birthday.read'); // Solicita acesso à data de nascimento do usuário

      //provider.setCustomParameters({ prompt: 'select_account' }); // Solicita ao usuário selecionar uma conta, mesmo que já esteja logado

      const result = await signInWithPopup(auth, provider); // Abre a janela de login do Google
      const credential = GoogleAuthProvider.credentialFromResult(result); // Obtém as credenciais do usuário
      const accessToken = credential?.accessToken; // Obtém o token de acesso do Google

      const user = result.user; // Obtém o usuário autenticado
      localStorage.setItem('googleAccessToken', accessToken ?? '') // Armazena o token de acesso no localStorage
      // Aqui você pode armazenar o token de acesso em um cookie ou no localStorage, se necessário

      setGoogleAccessToken(accessToken ?? null); // Atualiza o estado do token de acesso do Google no contexto de autenticação

      document.cookie = `token=${await user.getIdToken()}; path=/`;  // Armazena o token de autenticação do Firebase em um cookie

      router.push('/');
    } catch (error: any) {
      console.error('Erro ao fazer login com Google:', error);
      alert('Erro ao fazer login com Google');
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title title-logo">Connexus</h1>
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="group relative w-full overflow-hidden rounded-md bg-blue-600 px-6 py-3 text-white transition-colors duration-1000 hover:bg-red-600 focus:outline-none">
          <span className="relative z-10">Entrar com Google</span>
          <div className="absolute inset-x-0 bottom-0 h-0 text-white bg-red-600 transition-all duration-300 group-hover:h-full"></div>
        </button>
        <p className='text-gray-300 sm:text-sm text-center mt-4'>version 0.1.3</p>
      </div>
    </div>
  )
}
