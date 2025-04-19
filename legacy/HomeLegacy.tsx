'use client';

import Link from "next/link";
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

import { db } from './utils/firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PencilSquareIcon, TrashIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import MainMenu from "./components/MainMenu";
import AddEventModal from "./components/AddEventModal";

interface Event {
  id?: string;
  clientId: string;
  data: string;
  hora: string;
  endereco: string;
  observacoes: string;
  createdAt: Date;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  // ... outros campos do cliente
}

export default function Home() {

  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [eventosFuturos, setEventosFuturos] = useState<Event[]>([]);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedClientIdForEvent, setSelectedClientIdForEvent] = useState('');

  const fetchClientes = async () => {
    const querySnapshot = await getDocs(collection(db, 'clientes'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setClientes(dados);
  };

  const fetchEventosFuturos = async () => {
    const hoje = new Date();
    const q = query(
      collection(db, 'events'),
      where('data', '>=', format(hoje, 'yyyy-MM-dd')),
      orderBy('data', 'asc'),
      orderBy('hora', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    setEventosFuturos(eventosData);
  };

  useEffect(() => {
    fetchClientes();
    fetchEventosFuturos();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'clientes', id));
      await fetchClientes();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
    }
  };

  const openAddEventModal = (clientId: string) => {
    setSelectedClientIdForEvent(clientId);
    setIsAddEventModalOpen(true);
  };

  const closeAddEventModal = () => {
    setIsAddEventModalOpen(false);
    setSelectedClientIdForEvent('');
    fetchEventosFuturos(); // Recarrega os eventos após adicionar um novo
  };


  return (
    <main className="p-4 md:p-8 lg:p-10 flex flex-col gap-4">
      <MainMenu />

      {/* ... seção de próximos eventos ... */}

      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2 text-gray-700">Próximos Eventos</h2>
        {eventosFuturos.length > 0 ? (
          <ul className="list-disc pl-5">
            {eventosFuturos.map(evento => {
              const [ano, mes, dia] = evento.data.split('-').map(Number);
              const dataCorreta = new Date(ano, mes - 1, dia);
              return (
                <li key={evento.id}>
                  {format(dataCorreta, 'dd/MM/yyyy', { locale: ptBR })} às {evento.hora} em {evento.endereco} ({clientes.find(c => c.id === evento.clientId)?.nome}: {evento.observacoes})
                </li>
              )
            })}
          </ul>
        ) : (
          <p>Nenhum evento futuro agendado.</p>
        )}
      </div>

      {/* ... seção de diretório de pessoas ... */}

      <div className="overflow-x-auto">
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
}