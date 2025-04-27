'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '../utils/firebaseConfig';
import ImportContactsModal from './ImportContactsModal';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const [showImportContacts, setShowImportContacts] = useState(false);
  const [darkMode, setDarkMode] = useState(false); // futuro uso
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await signOut(auth);
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/auth-login');
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-40 z-40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      <motion.div
        className="fixed top-0 right-0 w-full sm:w-80 h-full bg-white shadow-xl z-50 p-6 overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <h2 className="text-xl font-bold mb-6">Configurações</h2>

        <div className="space-y-4">
          <button
            onClick={() => setShowImportContacts(true)}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Importar Contatos
          </button>

          <button
            onClick={() => router.push('/trash')}
            className="w-full py-2 px-4 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
          >
            Acessar Lixeira
          </button>

          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Modo Escuro</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-12 h-6 flex items-center bg-gray-300 rounded-full p-1 transition ${
                darkMode ? 'bg-blue-600' : ''
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
                  darkMode ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600 transition mt-8"
          >
            Sair
          </button>
        </div>

        {/* Modal interno para Importação */}
        {showImportContacts && (
          <ImportContactsModal
            isOpen={showImportContacts}
            onClose={() => setShowImportContacts(false)}
          />
        )}
      </motion.div>
    </>
  );
}
