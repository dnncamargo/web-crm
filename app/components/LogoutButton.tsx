'use client'

import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebaseConfig'
import { useRouter } from 'next/navigation'
import { ArrowRightEndOnRectangleIcon } from '@heroicons/react/24/outline'

export default function LogoutButton() {
  const router = useRouter()

  const handleLogout = async () => {
    await signOut(auth)
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/login')
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
