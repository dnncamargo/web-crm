'use client'

import { useState, JSX, use, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

interface MainMenuProps {
  externalCloseTrigger?: boolean;
}

/**
 * @component
 * @description Componente para o menu principal de navegação do aplicativo. Exibe links para diferentes seções e um menu responsivo para telas menores.
 * @returns {JSX.Element} A interface do menu principal.
 */
const MainMenu = ({ externalCloseTrigger }: MainMenuProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState<boolean>(false) /** @state {boolean} isOpen - Controla a visibilidade do menu responsivo em telas menores. */
  const pathname = usePathname() /** @const {string} pathname - O caminho atual da URL, obtido usando `usePathname`. */

  useEffect(() => {
    if (externalCloseTrigger) {
      setIsOpen(false)
    }
  }, [externalCloseTrigger])

  /**
   * @function toggleMenu
   * @description Alterna a visibilidade do menu responsivo (abre e fecha).
   * @returns {void}
   */
  const toggleMenu = (): void => setIsOpen(!isOpen)


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

  const { user } = useAuth() /** @const {object} user - Objeto que contém informações sobre o usuário autenticado, obtido do contexto de autenticação. */

  return (
    <header className="main-container-top">

      {/* Logo e menu desktop */}
      <div className="menu-container">
        <Link href="/" className="title-logo">
          connexus
        </Link>

        {/* Foto do usuário */}
        <div className="flex items-center p-4">
          {user?.photoURL && <img src={user.photoURL} className="w-5 h-5 rounded-full" alt="Foto do usuário" />}
        </div>

        {/* Menu desktop */}
        <div className="menu-desktop">
          <Link href="/people-directory" className={linkClass('/people-directory')}>Pessoas</Link>
          <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
          <Link href="/task-list" className={linkClass('/task-list')}>Tarefas</Link>
          <LogoutButton />
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
        <div className="menu-mobile">
          <div className="menu-mobile-content">

            <div className="menu-mobile-links">
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
              <Link
                href="/task-list"
                className={linkClass('/task-list')}
                onClick={toggleMenu}
              > Tarefas
              </Link>
            </div>
            <div className="flex justify-end">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default MainMenu
