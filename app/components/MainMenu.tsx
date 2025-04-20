'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

const MainMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const toggleMenu = () => setIsOpen(!isOpen)

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${
      pathname === path
        ? 'text-blue-900'
        : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <header className="fixed top-0 left-0 w-full backdrop-blur bg-white/80 z-50 border-b">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="text-xl font-semibold text-gray-900">
          CRM
        </Link>

        {/* Menu desktop */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/people-directory" className={linkClass('/people-directory')}>Pessoas</Link>
          <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
        </div>

        {/* Botão mobile */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 rounded hover:bg-gray-100 transition"
        >
          {isOpen ? (
            <XMarkIcon className="h-6 w-6 text-gray-700" />
          ) : (
            <Bars3Icon className="h-6 w-6 text-gray-700" />
          )}
        </button>
      </div>

      {/* Menu mobile */}
      {isOpen && (
        <div className="md:hidden bg-white border-t mt-1">
          <div className="flex flex-col p-3 space-y-2">
            <Link
              href="/people-directory"
              className={linkClass('/people-directory')}
              onClick={toggleMenu}
            >
              Pessoas
            </Link>
            <Link
              href="/events-history"
              className={linkClass('/events-history')}
              onClick={toggleMenu}
            >
              Eventos
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default MainMenu
