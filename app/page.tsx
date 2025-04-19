'use client';

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';
import { deleteDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Person, Event } from './utils/interfaces';

import MainMenu from "./components/MainMenu";


export default function Home() {

  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [eventosFuturos, setEventosFuturos] = useState<Event[]>([]);

  const fetchClientes = async () => {
    const querySnapshot = await getDocs(collection(db, 'people-directory'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setClientes(dados);
  };

  const fetchEventosFuturos = async () => {
    const today = new Date();
    const q = query(
      collection(db, 'events-history'),
      where('date', '>=', format(today, 'yyyy-MM-dd')),
      orderBy('date', 'asc'),
      orderBy('hour', 'asc')
    );
    const querySnapshot = await getDocs(q);
    const eventosDate = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    setEventosFuturos(eventosDate);
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
            {eventosFuturos.map(event => {
              const [ano, mes, dia] = event.date.split('-').map(Number);
              const splitDate = new Date(ano, mes - 1, dia);
              return (
                <li key={event.id}>
                  {format(splitDate, 'dd/MM/yyyy', { locale: ptBR })} às {event.hour} em {event.address} ({clientes.find(c => c.id === event.personId)?.nome}: {event.description})
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