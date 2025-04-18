'use client';

import { Person } from '../utils/interfaces';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import MainMenu from '../components/MainMenu';

const People = () => {
  const router = useRouter();
  const [person, setPerson] = useState<Person[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedClientIdForEvent, setSelectedClientIdForEvent] = useState('');

  const fetchPeople = async () => {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[];
    setPerson(dados);
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const openAddEventModal = (clientId: string) => {
    setSelectedClientIdForEvent(clientId);
    setIsAddEventModalOpen(true);
  };

  const closeAddEventModal = () => {
    setIsAddEventModalOpen(false);
    setSelectedClientIdForEvent('');
  };

  return (
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Diretório de Pessoas</h1>

      <div className="space-y-3">
        {person.map(cliente => (
          <div key={cliente.id} className="bg-white p-4 rounded-lg shadow flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{cliente.nome}</h2>
            <p className="text-gray-500">{cliente.telefone}</p>
            <div className="flex gap-2">
              <button onClick={() => openAddEventModal(cliente.id)} className="btn-primary">+ Evento</button>
              <button onClick={() => router.push(`/edit-client/${cliente.id}`)} className="btn-secondary">Editar</button>
            </div>
          </div>
        ))}
      </div>

    </main>
  );
};

export default People;
