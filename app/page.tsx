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
import EventSummaryCard from './components/EventSummaryCard';

type GroupedEvents = {
  today: Event[],
  week: Event[],
  nextMonth: Event[],
  future: Event[]
}

/**
 * @component
 * @description Componente principal da página inicial, exibindo os próximos eventos e permitindo adicionar novos eventos.
 * @returns {JSX.Element} A interface da página inicial.
 */
export default function Home(): JSX.Element {
  const [person, setPerson] = useState<Person[]>([])
  const [events, setEvents] = useState<GroupedEvents>({
    today: [],
    week: [],
    nextMonth: [],
    future: []
  })

  useEffect(() => {
    fetchPerson();
    fetchAndGroupEvents()
  }, []);

  /**
  * @async
  * @function fetchPerson
  * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
  * @returns {Promise<void>}
  */
  const fetchPerson = async (): Promise<void> => {
    const querySnapshot = await getDocs(collection(db, 'people-directory'));
    const personData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Person[];
    setPerson(personData);
  };

  /**
   * @async
   * @function fetchAndGroupEvents
   * @description Busca os eventos futuros da coleção 'events-history' no Firestore, e agrupa por categorias de tempo.
   * @returns {Promise<void>}
   */
  const fetchAndGroupEvents = async (): Promise<void> => {
    const today = new Date()
    const q = query(
      collection(db, 'events-history'),
      where('date', '>=', format(today, 'yyyy-MM-dd')),
      orderBy('date'),
      orderBy('hour')
    )
    const querySnapshot = await getDocs(q)
    const allEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[]

    const grouped = allEvents.reduce<GroupedEvents>((acc, event) => {
      const date = parseISO(event.date)
      const now = new Date()

      if (isToday(date)) {
        acc.today.push(event)
      } else if (isThisWeek(date, { weekStartsOn: 1 })) {
        acc.week.push(event)
      } else if (
        date.getMonth() === addMonths(now, 1).getMonth() &&
        date.getFullYear() === now.getFullYear()
      ) {
        acc.nextMonth.push(event)
      } else {
        acc.future.push(event)
      }

      return acc
    }, { today: [], week: [], nextMonth: [], future: [] })

    setEvents(grouped)
  }

  /**
   * @function formatDate
   * @description Formata uma string de data (ISO 8601) para um formato legível em português brasileiro, opcionalmente incluindo a hora.
   * @param {string} stringDate - A string de data no formato ISO 8601 (ex: "2023-10-26").
   * @param {string | undefined} hour - Uma string opcional representando a hora (ex: "10:30").
   * @returns {string} A data formatada como "Dia da semana, dia de Mês" ou "Dia da semana, dia de Mês às Hora".
   */
  const formatDate = (stringDate: string, hour?: string): string => {
    const date = parseISO(stringDate);
    const textCard = format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
    return hour ? `${textCard} às ${hour}` : textCard;
  };

  /**
   * @function renderItem
   * @description Renderiza um item de evento, buscando a pessoa associada na lista de pessoas (se houver).
   * @param {Event} event - O objeto do evento a ser renderizado.
   * @returns {Person} O objeto da pessoa associada ao evento, ou undefined se não houver associação ou a pessoa não for encontrada.
   */
  const renderItem = (event: Event) => {
    const associatedPerson = person.find(p => p.id === event.personId);

    return (
      <li key={event.id} className="border rounded p-3 mb-2 bg-white">
        <p className="font-medium">{event.title}</p>
        <p className="text-sm text-gray-600 flex items-center">
          <CalendarDaysIconOutline className="w-4 h-4 mr-2" />
          {formatDate(event.date, event.hour)}
        </p>
        {associatedPerson && (
          <p className="text-sm text-gray-600 flex items-center">
            <UserIconOutline className="w-4 h-4 mr-2" />
            {associatedPerson.name}
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

  /**
   * @function renderEvent
   * @description Renderiza um cartão de resumo de evento, buscando a pessoa associada na lista de pessoas (se houver).
   * @param {Event}
   */
  const renderEvent = (event: Event) => {
    const associatedPerson = person.find(p => p.id === event.personId)
    return (
      <EventSummaryCard key={event.id} event={event} person={associatedPerson} />
    )
  }

  return (

    <main className="p-4 space-y-6 bg-gray-50 min-h-screen">

      {/* Renderiza o menu principal da aplicação. */}
      <MainMenu />
      <h1 className="text-2xl font-bold">Próximos Eventos</h1>

      {Object.entries(events).map(([groupName, groupEvents]) => (
        groupEvents.length > 0 && (
          <section key={groupName}>
            <h2 className="text-lg font-semibold mb-2">
              {groupName === 'today' && `Hoje (${groupEvents.length})`} {/* Eventos do dia */}
              {groupName === 'week' && `Esta Semana (${groupEvents.length})`} {/* Eventos da Semana */}
              {groupName === 'nextMonth' && `Próximo Mês (${groupEvents.length})`} {/* Eventos do Próximo Mês */}
              {groupName === 'future' && `Futuro (${groupEvents.length})`} {/* Eventos sem Data Específica */}
            </h2>
            <div className="space-y-2">
              {groupEvents.map(renderEvent)}
            </div>
          </section>
        )
      ))}

      {Object.values(events).flat().length === 0 && (
        <p className="text-gray-600">Nenhum evento futuro agendado.</p>
      )}

    </main>
  );
}
