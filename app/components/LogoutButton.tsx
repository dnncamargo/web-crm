'use client'

import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline'

export default function LogoutButton() {
  const { setGoogleAccessToken } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('googleAccessToken'); // Remove o token armazenado
    setGoogleAccessToken(null); // Limpa o contexto
    router.push('/auth-login'); // Redireciona
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 rounded-md text-sm text-gray-600 hover:text-red-600 transition"
    >
      <ArrowRightEndOnRectangleIcon className="w-5 h-5" />
      Sair
    </button>
  )
}
