'use client';

import { useState, useEffect, JSX } from 'react';
import { getDocs, query, where, orderBy, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { Event, Person } from '../utils/interfaces';
import { format, isToday, isThisWeek, addMonths, parseISO } from 'date-fns';
import { StarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '../components/ProtectedRoute'
import MainMenu from '../components/MainMenu';
import UpcomingEventCard from '../components/UpcomingEventCard';
import SuggestionPanel from '../components/SuggestionPanel';

type GroupedEvents = {
  today: Event[],
  thisWeek: Event[],
  thisMonth: Event[],
  nextMonth: Event[],
  future: Event[]
}

/**
 * @component
 * @description Componente principal da página inicial, exibindo os próximos eventos e permitindo adicionar novos eventos.
 * @returns {JSX.Element} A interface da página inicial.
 */
export default function Dashboard(): JSX.Element {
  const { user } = useAuth(); /** @const {User | null} user - O usuário autenticado. */
  const [person, setPerson] = useState<Person[]>([]); /** @state {Person[]} person - Array de pessoas buscadas do Firestore. */
  const [events, setEvents] = useState<GroupedEvents>({
    today: [],
    thisWeek: [],
    thisMonth: [],
    nextMonth: [],
    future: []
  }); /** @state {GroupedEvents} events - Array de eventos agrupados por data. */
  const [showSuggestions, setShowSuggestions] = useState(false); /** @state {boolean} showSuggestions - Controla a visibilidade do painel de sugestões de eventos. */
  const [menuCloseTrigger, setMenuCloseTrigger] = useState<boolean>(false)  /** @state {boolean} closeMenu - Controla a visibilidade do menu principal. */

  useEffect(() => {
    // Chama as funções fetchPerson e fetchAndGroupEvents quando o componente é montado.
    // Isso garante que a lista de pessoas e eventos seja carregada assim que o componente for exibido.
    if(user) {
      fetchAndGroupEvents()
      fetchPerson();
    }
  }, [ user ]); // <- Executa quando user estiver pronto

  if (!user) {
    return <p></p>;
  }
  console.log('user', user.uid)

  /**
  * @async
  * @function fetchPerson
  * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
  * @returns {Promise<void>}
  */
  const fetchPerson = async (): Promise<void> => {
    const querySnapshot = await getDocs(collection(db, `users/${user.uid}/people-directory`));
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
    console.log('today', today)
    const q = query(
      collection(db, `users/${user.uid}/events-history`),
      where('startDate', '>=', format(today, 'yyyy-MM-dd')),
      orderBy('startDate'),
      orderBy('startTime')
    )
    const querySnapshot = await getDocs(q)
    const allEvents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    groupEventsByTime(allEvents);
  }

  /**
   * @function groupEventsByTime
   * @description Agrupa uma lista de eventos (`allEvents`) em categorias temporais: hoje, esta semana, este mês, próximo mês e futuro.
   * Utiliza as funções `parseISO`, `isToday`, `isThisWeek`, `isSameMonth`, e `addMonths` da biblioteca `date-fns` para realizar a categorização.
   * O resultado da agrupamento é um objeto do tipo `GroupedEvents`, que é então utilizado para atualizar o estado `events`.
   * @param {Event[]} allEvents - Um array de objetos `Event`, onde cada objeto deve ter uma propriedade `date` no formato ISO 8601.
   * @returns {void} - Esta função não retorna um valor diretamente, mas atualiza o estado `events` com os eventos agrupados.
   */
  const groupEventsByTime = (allEvents: Event[]): void => {
    const grouped = allEvents.reduce<GroupedEvents>((acc, event) => {
      const date = parseISO(event.startDate);
      const now = new Date();

      const isSameMonth = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      const isNextMonth = date.getMonth() === addMonths(now, 1).getMonth() && date.getFullYear() === addMonths(now, 1).getFullYear();

      if (isToday(date)) {
        acc.today.push(event);
      } else if (isThisWeek(date, { weekStartsOn: 1 }) && isSameMonth) {
        acc.thisWeek.push(event);
      } else if (isSameMonth) {
        acc.thisMonth.push(event);
      } else if (isNextMonth) {
        acc.nextMonth.push(event);
      } else {
        acc.future.push(event);
      }

      return acc;
    }, {
      today: [],
      thisWeek: [],
      thisMonth: [],
      nextMonth: [],
      future: []
    });
    setEvents(grouped);
  }

  const refreshDashboardEvents = async () => {
    await fetchAndGroupEvents(); // invoca a função para buscar e agrupar eventos novamente
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

      <main className="main-container-body main-container-bg">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu externalCloseTrigger={menuCloseTrigger}/>
        <h1 className="title-1">Próximos Eventos</h1>

        {Object.entries(events).map(([groupName, groupEvents]) => (
          groupEvents.length > 0 && (
            <section key={groupName}>
              <h2 className="title-2">
                {groupName === 'today' && `Hoje (${groupEvents.length})`} {/* Eventos do dia */}
                {groupName === 'thisWeek' && `Esta Semana (${groupEvents.length})`} {/* Eventos da Semana */}
                {groupName === 'thisMonth' && `Este Mês (${groupEvents.length})`} {/* Eventos do Mês */}
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

        {/* Renderiza o painel de sugestões de eventos. Abre quando showSuggestions é verdadeiro. */}
        {showSuggestions && (
          <SuggestionPanel
            onClose={() => setShowSuggestions(false)}
            onEventCreated={refreshDashboardEvents} // Passa a função de atualização para o painel de sugestões
          />
        )}

        {/* Botão flutuante de Sugestão de Eventos */}
        <button
          onClick={() => {
            setShowSuggestions(true); // Abre o painel de sugestões
            setMenuCloseTrigger(true); // Fecha o menu principal ao abrir o painel de sugestões
          }}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse z-50"
          aria-label="Ver sugestões"
        >
          <StarIcon className="w-6 h-6"/>
          
        </button>

      </main>

    </ProtectedRoute>
  );
}
