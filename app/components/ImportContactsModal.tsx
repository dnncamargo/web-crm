'use client'

import { useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { Contact, fetchAllContacts, parseGoogleContact } from '../utils/googleContacts'
import { useRouter } from 'next/navigation'
import { db } from '../utils/firebaseConfig'
import { addDoc, collection } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { Timestamp } from 'firebase/firestore'

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportContactsPage({ onClose }: ImportContactsModalProps) {
  const { uid, googleAccessToken } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase e do Google autenticado. */
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  if (!uid) return <p className="p-6">Carregando usuário...</p>;

  async function loadContacts() {
    if (!googleAccessToken) {
      alert('Token de acesso não encontrado.');
      return;
    }

    setLoading(true);
    try {
      const loadedContacts = await fetchAllContacts(googleAccessToken);
      console.log('[Loaded Contact]', JSON.stringify(loadedContacts))
      const mappedContacts = loadedContacts.map(parseGoogleContact);

      setContacts(mappedContacts);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      alert('Erro ao carregar contatos.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  function selectAll() {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.resourceName));
    }
  }

  async function importSelected() {
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um contato.');
      return;
    }

    setImporting(true);

    try {
      const selectedContacts = contacts.filter(c => selectedIds.includes(c.resourceName));

      const batch = selectedContacts.map(contact => {
        return addDoc(collection(db, `users/${uid}/people-directory`), {
          name: contact.displayName || 'Sem nome',
          phone: contact.phoneNumbers || '',
          favorite: false,
          relationship: '',
          contactFrequency: null,
          optionalFields: contact.addresses || [],
          createdAt: Timestamp.fromDate(new Date())
        });
      });

      await Promise.all(batch);

      alert('Contatos importados!');
      onClose();
      router.push('/people-directory');
    } catch (error) {
      console.error('Erro ao importar:', error);
      alert('Erro ao importar contatos.');
    } finally {
      setImporting(false);
    }
  }


  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 h-screen overflow-y-auto">

      {/* Topo */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Importar Contatos</h1>
        <button onClick={onClose} className="text-gray-500 hover:text-black">
          Voltar
        </button>

      </div>

      {/* Botões principais */}
      <div className="flex gap-4">
        <button
          onClick={loadContacts}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          {loading ? 'Carregando...' : 'Carregar Contatos'}
        </button>

        {contacts.length > 0 && (
          <button
            onClick={selectAll}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition"
          >
            {selectedIds.length === contacts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
          </button>
        )}

        {/* Botão de Importar */}
        {contacts.length > 0 && (
          <button
            onClick={importSelected}
            disabled={importing}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition"
          >
            {importing
              ? 'Importando...'
              : `Importar ${selectedIds.length} Contato(s)`}
          </button>
        )}
      </div>

      {/* Lista de Contatos */}
      <div className="grid gap-4">
        {contacts.length === 0 && (
          <p className="text-gray-500">Nenhum contato carregado.</p>
        )}
        {contacts.map((contact) => (
          <motion.div
            key={contact.resourceName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between border p-4 rounded-lg bg-white shadow-sm"
          >
            <div>
              <p className="font-medium">{contact.displayName}</p>
              {contact.phoneNumbers && (
                <p className="text-sm text-gray-500">{contact.phoneNumbers}</p>
              )}
            </div>
            <input
              type="checkbox"
              checked={selectedIds.includes(contact.resourceName)}
              onChange={() => toggleSelect(contact.resourceName)}
              className="w-5 h-5"
            />
          </motion.div>
        ))}
      </div>



    </div>
  )
}
