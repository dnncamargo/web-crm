'use client'

import { useRouter } from 'next/navigation';
import { useAuth } from '../auth/AuthProvider';
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline'

export default function LogoutButton() {
  const { setUid, setUser, setGoogleAccessToken } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    setGoogleAccessToken(null)
    setUid(null)
    setUser(null)
    localStorage.removeItem('googleAccessToken')
    localStorage.removeItem('firebaseUid')
    localStorage.removeItem('userInfo')
    router.push('/auth-login'); // Redireciona
  }
  
  
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
