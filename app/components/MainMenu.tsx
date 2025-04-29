'use client'

import { JSX, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { useAuth } from './AuthProvider'
import { useDeviceType } from '../hooks/useDeviceType'
import Link from 'next/link'
import LogoutButton from './LogoutButton'
import ImportContactsModal from './ImportContactsModal'

interface MainMenuProps {
  externalCloseTrigger?: boolean;
}

export default function MainMenu({ externalCloseTrigger }: MainMenuProps): JSX.Element {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showImportContacts, setShowImportContacts] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // futuro uso
  const pathname = usePathname();

  if (!user) return <p className="p-6">Carregando usuário...</p>;

  const toggleMenu = (): void => setIsOpen(!isOpen);
  const device = useDeviceType()

  const linkClass = (path: string) =>
    `px-3 py-2 rounded-md text-sm font-medium transition ${pathname === path
      ? 'text-blue-900'
      : 'text-gray-600 hover:text-gray-900'
    }`;

  return (

    <>

      <header className="fixed top-0 left-0 w-full backdrop-blur bg-white/80 z-50 border-b">
        <div className="flex justify-between items-center max-w-5xl mx-auto px-4 h-14">

          {/* Logo à esquerda */}
          <Link href="/" className="title-logo mb-2">
            connexus
          </Link>

          {/* Links principais para desktop */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/people-directory" className={linkClass('/people-directory')}>Pessoas</Link>
            <Link href="/events-history" className={linkClass('/events-history')}>Eventos</Link>
            <Link href="/tasks-list" className={linkClass('/tasks-list')}>Tarefas</Link>

            {/* Botão de Perfil */}
            <motion.button
              onClick={toggleMenu}
              className="rounded-full overflow-hidden w-10 h-10 border-2 border-gray-300 hover:border-blue-400 transition"
              whileTap={{ scale: 0.9 }}
            >
              <img
                src={user.photoURL || '/default-profile.png'}
                alt="Usuário"
                className="object-cover w-full h-full"
              />
            </motion.button>
          </div>


          {/* Menu Mobile - ícone da foto */}
          <div className="md:hidden flex">
            <motion.button
              onClick={toggleMenu}
              className="rounded-full overflow-hidden w-10 h-10 border-2 border-gray-300 hover:border-blue-400 transition"
              whileTap={{ scale: 0.9 }}
            >
              <img
                src={user.photoURL || '/default-profile.png'}
                alt="Usuário"
                className="object-cover w-full h-full"
              />
            </motion.button>
          </div>
        </div>

        {/* Menu flutuante (mobile + desktop) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-14 left-0 w-full bg-white border-t justify-items-end shadow-md md:rounded-b-md md:max-w-5xl md:mx-auto"
            >
              <div className="flex flex-col md:flex-row md:justify-between p-4 gap-6">

                {/* Links principais */}
                {device === 'mobile' &&
                  <div className="flex md:flex-row md:items-center gap-4">
                    <Link href="/people-directory" className={linkClass('/people-directory')} onClick={toggleMenu}>Pessoas</Link>
                    <Link href="/events-history" className={linkClass('/events-history')} onClick={toggleMenu}>Eventos</Link>
                    <Link href="/tasks-list" className={linkClass('/tasks-list')} onClick={toggleMenu}>Tarefas</Link>
                  </div>
                }

                {/* Links de configuração */}
                <div className="flex md:flex-row md:items-center gap-4 md:gap-6">
                  <button className={linkClass('')} onClick={() => { /* abrir modal Import Contacts */ {
                    toggleMenu();
                    setShowImportContacts(true)
                  }
                  }}>
                    Importar Contatos
                  </button>

                  <button className={linkClass('')} onClick={() => { /* alternar dark/light mode */ toggleMenu() }}>
                    Dark/Light Mode
                  </button>

                  <button className={linkClass('')} onClick={() => { /* ir para Trash */ toggleMenu() }}>
                    Lixeira
                  </button>

                  <LogoutButton />
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Modal interno para Importação */}
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
