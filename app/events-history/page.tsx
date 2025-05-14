'use client'

import { useState, useEffect, JSX } from 'react';
import { getDocs, query, orderBy, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { Event } from '../utils/interfaces';
import ProtectedRoute from '../components/ProtectedRoute';
import MainMenu from '../components/MainMenu';
import EventCard from '../components/EventCard';
import AddEventModal from '../components/AddEventModal';
import EditEventModal from '../components/EditEventModal';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/16/solid';
import { ListFilterIcon } from 'lucide-react';
import FilterModal from '../components/FilterModal';
import { OptionalField } from '../utils/interfaces'

/**
 * @component
 * @description Componente para exibir o histórico de eventos. Permite visualizar, adicionar, editar e excluir eventos.
 * @returns {JSX.Element} A interface do histórico de eventos.
 */
const EventsHistory = (): JSX.Element => {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const [events, setEvents] = useState<Event[]>([]);  /** @state {Event[]} events - Array de eventos buscados do Firestore. */
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);  /** @state {Event | null} selectedEvent - O evento selecionado para edição. */
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);  /** @state {boolean} isAddEventModalOpen - Controla a visibilidade do modal de adicionar um novo evento. */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); /** @state {boolean} isEditModalOpen - Controla a visibilidade do modal de edição de um evento existente. */
  const [menuCloseTrigger, setMenuCloseTrigger] = useState<boolean>(false)  /** @state {boolean} closeMenu - Controla a visibilidade do menu principal. */
  const [startDateFilter, setStartDateFilter] = useState<string | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false); // para evitar renderização prematura
  const [filters, setFilters] = useState({
    enabled: true,
    startDate: '',
    endDate: '',
    hasRating: 0,
    hasTasks: null,
    hasNotes: null,
    hasAddressByCEP: null
  })


  useEffect(() => {
    // Buscar os eventos do Firestore
    // Chama a função fetchEvents quando o componente é montado.
    // Isso garante que a lista de eventos seja carregada assim que o componente for exibido.
    if (uid) {
      fetchEvents();
    }
  }, [uid]);


  useEffect(() => {
    const init = async () => {
      if (!uid) return;

      try {
        const docRef = doc(db, `users/${uid}/settings`, 'userFilters');
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setFilters({
            enabled: data.enabled ?? true,
            startDate: data.startDate ?? '',
            endDate: data.endDate ?? '',
            hasRating: data.hasRating ?? 0,
            hasTasks: data.hasTasks ?? null,
            hasNotes: data.hasNotes ?? null,
            hasAddressByCEP: data.hasAddressByCEP ?? null,
          });
        }
      } catch (error) {
        console.error('Erro ao carregar filtros:', error);
      } finally {
        setFiltersLoaded(true);
      }
    };

    init();
  }, [uid]);

  /**
   * @async
   * @function fetchEvents
   * @description Busca todos os eventos da coleção 'events-history' no Firestore
   * @returns {Promise<void>}
   */
  const fetchEvents = async (): Promise<void> => {
    try {
      // Obtém todos os documentos da coleção 'events-history' no banco de dados 'db'.
      const q = query(collection(db, `users/${uid}/events-history`), orderBy('startDate', 'asc'), orderBy('startTime', 'asc'));
      const querySnapshot = await getDocs(q);
      // Mapeia os documentos para um array de objetos 'Event', incluindo o ID do documento.
      const eventData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];

      // Atualiza o estado 'events' com os dados ordenados.
      setEvents(eventData);

    } catch (error) {
      console.error('Erro ao buscar eventos:', error);
      //todo: Lide com o erro de forma apropriada (ex: exibir uma mensagem ao usuário)
    }
  };

  /**
   * @function openEditEventModal
   * @description Abre o modal de edição para o evento fornecido.
   * @param {Event} event - O objeto do evento a ser editado.
   * @returns {void}
   */
  const openEditEventModal = (event: Event): void => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  // Aplica os filtros apenas se `enabled === true`
  const filteredEvents = filters.enabled
    ? events.filter(event => {
      const from = filters.startDate ? new Date(filters.startDate) : null;
      const to = filters.endDate ? new Date(filters.endDate) : null;
      const eventDate = new Date(event.startDate);

      // Filtro por data
      const matchesDate =
        (!from || eventDate >= from) &&
        (!to || eventDate <= to);

      // Filtro por avaliação (rating >= filters.hasRating)
      const matchesRating =
        filters.hasRating === 0 || event.rating === filters.hasRating;

      // Filtro por tarefas opcionais
      const matchesTasks =
        filters.hasTasks === null ||
        (event.optionalFields?.some((field: OptionalField) =>
          field.type === 'note' && Array.isArray((field as any).value)
        ) === filters.hasTasks);

      // Filtro por anotações
      const matchesNotes =
        filters.hasNotes === null ||
        (event.optionalFields?.some((field: OptionalField) =>
          field.type === 'note' && typeof field.value === 'string' && field.value.trim() !== ''
        ) === filters.hasNotes);

      // Filtro por endereço com CEP
      const matchesAddress =
        filters.hasAddressByCEP === null ||
        (event.optionalFields?.some((field: OptionalField) =>
          field.type === 'address' && field.value.zipcode
        ) === filters.hasAddressByCEP);


      return (
        matchesDate &&
        matchesRating &&
        matchesTasks &&
        matchesNotes &&
        matchesAddress
      );
    })
    : events;

  const filtersAreActive =
    filters.enabled &&
    (
      filters.startDate ||
      filters.endDate ||
      filters.hasRating !== 0 ||
      filters.hasTasks !== null ||
      filters.hasNotes !== null ||
      filters.hasAddressByCEP !== null
    );

  return (

    <ProtectedRoute>

      <main className="main-container-body main-container-bg">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu externalCloseTrigger={menuCloseTrigger} />

        <div className="flex justify-between">
          <h1 className="title-1">Histórico de Eventos</h1>

          <ListFilterIcon
            className={`flex items-center w-6 h-6 mr-2 cursor-pointer transition 
              ${filtersAreActive ?
                'text-blue-600' :
                'text-gray-500'}`} // Adicione cursor-pointer para indicar que é clicável
            onClick={() => setShowFilterModal(true)} // Abre o modal ao clicar
          />
        </div>

        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filters={filters}
          setFilters={setFilters}
        />

        {Object.values(events).flat().length === 0 && (
          <p className="text-gray-600">Nenhum evento registrado.</p>
        )}

        {/* Renderiza os cards de cada evento. */}
        <div className="card-spacing-bellow">
          {filteredEvents.map(e => (
            <EventCard
              key={e.id}
              event={e}
              onEditEvent={openEditEventModal}
            />
          ))}
        </div>


        {/* Modal de adição de novo evento. Abre quando isAddEventModalOpen é verdadeiro */}
        {isAddEventModalOpen && (
          <AddEventModal
            isOpen={isAddEventModalOpen}
            onClose={() => setIsAddEventModalOpen(false)}
            onAdded={fetchEvents}
          />
        )}

        {/* Modal de edição de evento. Abre quando isEditModalOpen é verdadeiro e um evento está selecionado */}
        {isEditModalOpen && selectedEvent && (
          <EditEventModal
            event={selectedEvent}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onUpdated={fetchEvents}
          />
        )}

        {/* Botão flutuante para adicionar um novo evento */}
        <button
          onClick={() => {
            setIsAddEventModalOpen(true); // Abre o modal de adição
            setMenuCloseTrigger(true); // Fecha o menu principal ao abrir o modal
          }}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-blue-600 transition"
        >
          <CalendarDaysIcon className="w-6 h-6 absolute mr-1" />
          <PlusIcon className="w-4 h-4 absolute ml-5 mb-5" />
        </button>
      </main>

    </ProtectedRoute>
  );
};

export default EventsHistory;
