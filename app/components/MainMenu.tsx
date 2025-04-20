'use client'

import { useState, JSX } from 'react'
import { usePathname } from 'next/navigation'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

/**
 * @component
 * @description Componente para o menu principal de navegação do aplicativo. Exibe links para diferentes seções e um menu responsivo para telas menores.
 * @returns {JSX.Element} A interface do menu principal.
 */
const MainMenu = (): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false) /** @state {boolean} isOpen - Controla a visibilidade do menu responsivo em telas menores. */
  const pathname = usePathname() /** @const {string} pathname - O caminho atual da URL, obtido usando `usePathname`. */

  /**
   * @function toggleMenu
   * @description Alterna a visibilidade do menu responsivo (abre e fecha).
   * @returns {void}
   */
  const toggleMenu = () => setIsOpen(!isOpen)

  /**
   * @function linkClass
   * @description Gera as classes CSS para um link de navegação com base no caminho atual da URL. Aplica um estilo diferente para o link ativo.
   * @param {string} path - O caminho do link a ser estilizado.
   * @returns {string} Uma string contendo as classes CSS para o link.
   */
  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${pathname === path
      ? 'text-blue-900'
      : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <header className="fixed top-0 left-0 w-full backdrop-blur bg-white/80 z-50 border-b">

      {/* Logo e menu desktop */}
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="title-logo">
          connexus
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
