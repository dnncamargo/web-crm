'use client';

import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isToday, isThisWeek, isThisMonth, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Person, Event } from './utils/interfaces';

import MainMenu from './components/MainMenu';

export default function Home() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Person[]>([]);
  const [eventosFuturos, setEventosFuturos] = useState<Event[]>([]);

  const fetchClientes = async () => {
    const querySnapshot = await getDocs(collection(db, 'people-directory'));
    const dados = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[];
    setClientes(dados);
  };

  const fetchEventosFuturos = async () => {
    const today = new Date();
    const q = query(
      collection(db, 'events-history'),
      where('date', '>=', format(today, 'yyyy-MM-dd')),
      orderBy('date'),
      orderBy('hour')
    );
    const querySnapshot = await getDocs(q);
    const eventosDate = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    setEventosFuturos(eventosDate);
  };

  useEffect(() => {
    fetchClientes();
    fetchEventosFuturos();
  }, []);

  // Agrupar eventos por categorias
  const eventosHoje = eventosFuturos.filter(e => isToday(parseISO(e.date)));
  const eventosSemana = eventosFuturos.filter(e => isThisWeek(parseISO(e.date), { weekStartsOn: 1 }) && !isToday(parseISO(e.date)));
  const eventosProximoMes = eventosFuturos.filter(e => {
    const dataEvento = parseISO(e.date);
    const hoje = new Date();
    return (
      dataEvento.getMonth() === addMonths(hoje, 1).getMonth() &&
      dataEvento.getFullYear() === hoje.getFullYear()
    );
  });
  const outrosEventos = eventosFuturos.filter(e =>
    !eventosHoje.includes(e) &&
    !eventosSemana.includes(e) &&
    !eventosProximoMes.includes(e)
  );

  const formatarData = (dataString: string, hour?: string) => {
    const data = parseISO(dataString);
    const textoBase = format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
    return hour ? `${textoBase} às ${hour}` : textoBase;
  };

  const renderItem = (event: Event) => {
    const pessoa = clientes.find(c => c.id === event.personId);

    return (
      <li key={event.id} className="border rounded p-3 mb-2 bg-white">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-gray-600">📅 {formatarData(event.date, event.hour)}</p>
        {pessoa && <p className="text-sm text-gray-600">👤 {pessoa.name}</p>}
        {event.description && <p className="text-sm text-gray-400 mt-1">📝 {event.description}</p>}
      </li>
    );
  };

  return (
    <main className="p-4 space-y-6 bg-gray-50 min-h-screen">
      <MainMenu />
      <h1 className="text-2xl font-bold">Próximos Eventos</h1>

      {eventosHoje.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Hoje ({eventosHoje.length})</h2>
          <ul>{eventosHoje.map(renderItem)}</ul>
        </section>
      )}

      {eventosSemana.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Esta semana ({eventosSemana.length})</h2>
          <ul>{eventosSemana.map(renderItem)}</ul>
        </section>
      )}

      {eventosProximoMes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Próximo mês ({eventosProximoMes.length})</h2>
          <ul>{eventosProximoMes.map(renderItem)}</ul>
        </section>
      )}

      {outrosEventos.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Futuro ({outrosEventos.length})</h2>
          <ul>{outrosEventos.map(renderItem)}</ul>
        </section>
      )}

      {eventosFuturos.length === 0 && (
        <p className="text-gray-600">Nenhum evento futuro agendado.</p>
      )}
    </main>
  );
}
