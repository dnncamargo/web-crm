'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import MainMenu from '../components/MainMenu';
import AddEventModal from '../components/AddEventModal';

const People = () => {
  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedClientIdForEvent, setSelectedClientIdForEvent] = useState('');

  const fetchClientes = async () => {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setClientes(dados);
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'clientes', id));
    fetchClientes();
  };

  useEffect(() => {
    fetchClientes();
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

      <div className="space-y-3">
        {clientes.map(cliente => (
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


      <div className="overflow-x-auto">
        <Link href="/add-client" className={'/add-client'}>+ Cliente</Link>
        <table className="min-w-full bg-white shadow-md rounded-lg overflow-hidden">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="th-base">Nome</th>
              <th className="th-base">Telefone</th>
              <th className="th-base md:table-cell hidden">Email</th>
              <th className="th-base">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map(cliente => (
              <tr
                key={cliente.id}
                className="hover:bg-gray-100 cursor-pointer group"
                onClick={() => router.push(`/edit-client/${cliente.id}`)}
              >
                <td className="td-base">{cliente.nome}</td>
                <td className="td-base">{cliente.telefone}</td>
                <td className="td-base md:table-cell hidden">{cliente.email}</td>
                <td className="td-base flex items-center justify-end space-x-2">
                  <div className="group-hover:opacity-100 opacity-0 transition-opacity duration-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Impedir que o clique na ação navegue para editar cliente
                        openAddEventModal(cliente.id);
                      }}
                      className="text-green-600 hover:text-green-900 flex items-center space-x-1"
                    >
                      <PlusCircleIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Adicionar Evento</span>
                    </button>
                    <Link
                      href={`/edit-client/${cliente.id}`}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center"
                      onClick={(e) => e.stopPropagation()} // Impedir que o clique navegue duas vezes
                    >
                      <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Editar</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Impedir que o clique na ação navegue para editar cliente
                        handleDelete(cliente.id);
                      }}
                      className="text-red-600 hover:text-red-900 flex items-center"
                    >
                      <TrashIcon className="h-5 w-5" aria-hidden="true" />
                      <span className="sr-only">Excluir</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddEventModalOpen && (
        <AddEventModal clientId={selectedClientIdForEvent} onClose={closeAddEventModal} />
      )}
    </main>
  );
};

export default People;
