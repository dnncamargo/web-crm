'use client';

import { useState, useEffect, JSX } from 'react';
import { getDocs, query, where, orderBy, collection } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';
import { Event, Person } from './utils/interfaces';
import { format, isToday, isThisWeek, isThisMonth, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UserIcon as UserIconOutline } from '@heroicons/react/24/outline';
import { CalendarDaysIcon as CalendarDaysIconOutline } from '@heroicons/react/24/outline';
import { PencilSquareIcon as PencilSquareIconOutline } from '@heroicons/react/24/outline';
import MainMenu from './components/MainMenu';

/**
 * @component
 * @description Componente principal da página inicial, exibindo os próximos eventos e permitindo adicionar novos eventos.
 * @returns {JSX.Element} A interface da página inicial.
 */
export default function Home(): JSX.Element {
  const [person, setPerson] = useState<Person[]>([]); /** @state {Person[]} person - Array de pessoas buscadas do Firestore. */
  const [futureEvents, setFutureEvents] = useState<Event[]>([]); /** @state {Event[]} futureEvents - Array de eventos futuros buscados do Firestore, ordenados por data. */

  useEffect(() => {
    fetchPeople();
    fetchFutureEvents();
  }, []);

  /**
  * @async
  * @function fetchPerson
  * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
  * @returns {Promise<void>}
  */
  const fetchPeople = async (): Promise<void> => {
    const querySnapshot = await getDocs(collection(db, 'people-directory'));
    const personData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Person[];
    setPerson(personData);
  };

  /**
   * @async
   * @function fetchFutureEvents
   * @description Busca os eventos futuros da coleção 'events-history' no Firestore, ordenados por data e hora.
   * @description Os eventos são filtrados para incluir apenas aqueles com data maior ou igual à data atual.
   * @returns {Promise<void>}
   */
  const fetchFutureEvents = async (): Promise<void> => {
    const today = new Date();
    const q = query(
      collection(db, 'events-history'),
      where('date', '>=', format(today, 'yyyy-MM-dd')),
      orderBy('date'),
      orderBy('hour')
    );
    const querySnapshot = await getDocs(q);
    const eventData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Event[];
    setFutureEvents(eventData);
  };

  // Agrupar eventos por categorias
  const eventsToday = futureEvents.filter(e => isToday(parseISO(e.date)));
  const eventsThisWeek = futureEvents.filter(e => isThisWeek(parseISO(e.date), { weekStartsOn: 1 }) && !isToday(parseISO(e.date)));
  const eventsNextMonth = futureEvents.filter(e => {
    const dateEvent = parseISO(e.date);
    const hoje = new Date();
    return (
      dateEvent.getMonth() === addMonths(hoje, 1).getMonth() &&
      dateEvent.getFullYear() === hoje.getFullYear()
    );
  });
  const otherEvents = futureEvents.filter(e =>
    !eventsToday.includes(e) &&
    !eventsThisWeek.includes(e) &&
    !eventsNextMonth.includes(e)
  );

  /**
   * @function formatDate
   * @description Formata uma string de data (ISO 8601) para um formato legível em português brasileiro, opcionalmente incluindo a hora.
   * @param {string} stringDate - A string de data no formato ISO 8601 (ex: "2023-10-26").
   * @param {string | undefined} hour - Uma string opcional representando a hora (ex: "10:30").
   * @returns {string} A data formatada como "Dia da semana, dia de Mês" ou "Dia da semana, dia de Mês às Hora".
   */
  const formatDate = (stringDate: string, hour?: string): string => {
    const data = parseISO(stringDate);
    const textoBase = format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
    return hour ? `${textoBase} às ${hour}` : textoBase;
  };

  /**
   * @function renderItem
   * @description Renderiza um item de evento, buscando a pessoa associada na lista de pessoas (se houver).
   * @param {Event} event - O objeto do evento a ser renderizado.
   * @returns {Person} O objeto da pessoa associada ao evento, ou undefined se não houver associação ou a pessoa não for encontrada.
   */
  const renderItem = (event: Event) => {
    const pessoa = person.find(p => p.id === event.personId);

    return (
      <li key={event.id} className="border rounded p-3 mb-2 bg-white">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-gray-600 flex items-center">
          <CalendarDaysIconOutline className="w-4 h-4 mr-2" />
          {formatDate(event.date, event.hour)}
        </p>
        {pessoa && (
          <p className="text-sm text-gray-600 flex items-center">
            <UserIconOutline className="w-4 h-4 mr-2" />
            {pessoa.name}
          </p>
        )}
        {event.description && (
          <p className="text-sm text-gray-400 mt-1 flex items-start">
            <PencilSquareIconOutline className="w-4 h-4 mr-2 mt-0.5" />
            {event.description}
          </p>
        )}
      </li>
    );
  };

  return (

    <main className="p-4 space-y-6 bg-gray-50 min-h-screen">

      {/* Renderiza o menu principal da aplicação. */}
      <MainMenu />
      <h1 className="text-2xl font-bold">Próximos Eventos</h1>

      {/* Eventos do dia */}
      {eventsToday.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Hoje ({eventsToday.length})</h2>
          <ul>{eventsToday.map(renderItem)}</ul>
        </section>
      )}

      {/* Eventos da Semana */}
      {eventsThisWeek.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Esta semana ({eventsThisWeek.length})</h2>
          <ul>{eventsThisWeek.map(renderItem)}</ul>
        </section>
      )}

      {/* Eventos do Próximo Mês */}
      {eventsNextMonth.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Próximo mês ({eventsNextMonth.length})</h2>
          <ul>{eventsNextMonth.map(renderItem)}</ul>
        </section>
      )}

      {/* Eventos sem Data Específica */}
      {otherEvents.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Futuro ({otherEvents.length})</h2>
          <ul>{otherEvents.map(renderItem)}</ul>
        </section>
      )}

      {futureEvents.length === 0 && (
        <p className="text-gray-600">Nenhum evento futuro agendado.</p>
      )}
    </main>
  );
}
