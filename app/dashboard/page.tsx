'use client';

import { useState, useEffect, JSX } from 'react';
import { getDocs, query, where, orderBy, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Event, Person } from '../utils/interfaces';
import { format, isToday, isThisWeek, isThisMonth, addMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProtectedRoute from '../components/ProtectedRoute'
import MainMenu from '../components/MainMenu';
import UpcomingEventCard from '../components/UpcomingEventCard';

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
export default function Dashboard(): JSX.Element {
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
   * @function renderEvent
   * @description Renderiza um cartão de resumo de evento, buscando a pessoa associada na lista de pessoas (se houver).
   * @param {Event}
   */
  const renderEvent = (event: Event) => {
    const associatedPerson = person.find(p => p.id === event.personId)
    return (
      <UpcomingEventCard key={event.id} event={event} person={associatedPerson} />
    )
  }

  return (

    <ProtectedRoute>

      <main className="main-container-body">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu />
        <h1 className="title-1">Próximos Eventos</h1>

        {Object.entries(events).map(([groupName, groupEvents]) => (
          groupEvents.length > 0 && (
            <section key={groupName}>
              <h2 className="title-2">
                {groupName === 'today' && `Hoje (${groupEvents.length})`} {/* Eventos do dia */}
                {groupName === 'week' && `Esta Semana (${groupEvents.length})`} {/* Eventos da Semana */}
                {groupName === 'nextMonth' && `Próximo Mês (${groupEvents.length})`} {/* Eventos do Próximo Mês */}
                {groupName === 'future' && `Futuro (${groupEvents.length})`} {/* Eventos sem Data Específica */}
              </h2>
              <div className="card-spacing-bellow">
                {groupEvents.map(renderEvent)}
              </div>
            </section>
          )
        ))}

        {Object.values(events).flat().length === 0 && (
          <p className="text-gray-600">Nenhum evento futuro agendado.</p>
        )}

      </main>

    </ProtectedRoute>
  );
}
