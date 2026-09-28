// 'use client'

import { JSX, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useAuth } from '../auth/AuthProvider'
import { useDeviceType } from '../../hooks/useDeviceType'
import Link from 'next/link'
import LogoutButton from './LogoutButton'
import ImportContactsModal from './ImportContactsModal'

interface MainMenuProps {
  externalCloseTrigger?: boolean;
}

export default function MainMenu({ externalCloseTrigger }: MainMenuProps): JSX.Element {
  const { uid, googleAccessToken, user } = useAuth();
  const isAuthenticated = !!uid && !!googleAccessToken;
  const [userPicture, setUserPicture] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false);
  const [showImportContacts, setShowImportContacts] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const pathname = usePathname();
  const toggleMenu = (): void => setIsOpen(!isOpen);
  const device = useDeviceType()

  useEffect(() => {
    const savedUserInfo = localStorage.getItem('userInfo')
    if (savedUserInfo) {
      try {
        const user = JSON.parse(savedUserInfo)
        if (user.picture) {
          setUserPicture(user.picture)
        }
      } catch (e) {
        console.warn('[MainMenu] Falha ao carregar imagem de perfil do localStorage:', e)
      }
    }
  }, [])

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${pathname === path
      ? 'text-blue-900'
      : 'text-gray-600 hover:text-gray-900'
    }`;

  if (!isAuthenticated) {
    return <div className="animate-pulse text-gray-500 m-6">Carregando menu...</div>;
  }

  return (
    <>
      <header className="fixed top-0 left-0 w-full backdrop-blur bg-white/80 z-50 border-b">
        <div className="grid grid-cols-2 items-center max-w-5xl mx-auto px-4 h-14">
          <Link href="/" className="title-logo mb-2">connexus</Link>

          <div className="flex justify-end items-center gap-4">
            <div className="hidden md:flex items-center gap-4">
              <Link href="/people-directory" className={linkClass('/people-directory')}>Pessoas</Link>
              <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
              <Link href="/tasks-list" className={linkClass('/tasks-list')}>Tarefas</Link>
            </div>

            <motion.button
              onClick={toggleMenu}
              className="rounded-full overflow-hidden w-10 h-10 border-2 border-gray-300 hover:border-blue-400 transition"
              whileTap={{ scale: 0.9 }}
            >
              <img
                src={userPicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name?.[0] || 'U')}&background=ccc&color=000`}
                alt="Usuário"
                className="object-cover w-full h-full"
              />
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-14 left-0 w-full bg-white border-t shadow-md md:rounded-b-md md:mx-auto"
            >
              {device === 'mobile' ? (
                <div className="grid grid-cols-2 gap-4 p-4 text-center">
                  <div className="flex flex-col gap-2">
                    <Link href="/people-directory" className={linkClass('/people-directory')} onClick={toggleMenu}>Pessoas</Link>
                    <Link href="/events-history" className={linkClass('/events-history')} onClick={toggleMenu}>Eventos</Link>
                    <Link href="/tasks-list" className={linkClass('/tasks-list')} onClick={toggleMenu}>Tarefas</Link>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button className={linkClass('')} onClick={() => { toggleMenu(); setShowImportContacts(true); }}>
                      Importar Contatos
                    </button>
{/*                     <button className={linkClass('')} onClick={() => { toggleMenu(); setDarkMode(!darkMode); }}>
                      Dark/Light Mode
                    </button> */}
                    <a href="https://github.com/seu-repo" className={linkClass('')} target="_blank" rel="noopener noreferrer">
                      Repositório
                    </a>
                    <div className='self-end items-end mr-10'>
                      <LogoutButton />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end mr-14 gap-6 p-4">
                  <button className={linkClass('')} onClick={() => { toggleMenu(); setShowImportContacts(true); }}>
                    Importar Contatos
                  </button>
{/*                   <button className={linkClass('')} onClick={() => { toggleMenu(); setDarkMode(!darkMode); }}>
                    Dark/Light Mode
                  </button> */}
                  <a href="https://github.com/seu-repo" className={linkClass('')} target="_blank" rel="noopener noreferrer">
                    Repositório
                  </a>
                  <LogoutButton />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {showImportContacts && (
          <ImportContactsModal
            isOpen={showImportContacts}
            onClose={() => setShowImportContacts(false)}
          />
        )}
      </header>
    </>
  );
}

