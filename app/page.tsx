'use client';

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';

import { db } from './utils/firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import MainMenu from "./components/MainMenu";


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

    </main>
  );
}