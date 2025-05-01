'use client'

import { useState, useEffect, JSX } from 'react';
import { getDocs, query, orderBy, collection } from 'firebase/firestore';
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

/**
 * @component
 * @description Componente para exibir o histórico de eventos. Permite visualizar, adicionar, editar e excluir eventos.
 * @returns {JSX.Element} A interface do histórico de eventos.
 */
const EventsHistory = (): JSX.Element => {
  const { user } = useAuth(); /** @const {User | null} user - O usuário autenticado. */
  const [events, setEvents] = useState<Event[]>([]);  /** @state {Event[]} events - Array de eventos buscados do Firestore. */
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);  /** @state {Event | null} selectedEvent - O evento selecionado para edição. */
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);  /** @state {boolean} isAddEventModalOpen - Controla a visibilidade do modal de adicionar um novo evento. */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); /** @state {boolean} isEditModalOpen - Controla a visibilidade do modal de edição de um evento existente. */
  const [menuCloseTrigger, setMenuCloseTrigger] = useState<boolean>(false)  /** @state {boolean} closeMenu - Controla a visibilidade do menu principal. */

  useEffect(() => {
    // Chama a função fetchEvents quando o componente é montado.
    // Isso garante que a lista de eventos seja carregada assim que o componente for exibido.
    if (user) {
      fetchEvents();
    }
  }, [ user ]);

  if (!user) {
    return <p>Carregando usuário...</p>;
  }

  /**
   * @async
   * @function fetchEvents
   * @description Busca todos os eventos da coleção 'events-history' no Firestore
   * @returns {Promise<void>}
   */
  const fetchEvents = async (): Promise<void> => {
    try {
      // Obtém todos os documentos da coleção 'events-history' no banco de dados 'db'.
      const q = query(collection(db, `users/${user.uid}/events-history`), orderBy('startDate', 'asc'));
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

  return (

    <ProtectedRoute>

      <main className="main-container-body main-container-bg">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu externalCloseTrigger={menuCloseTrigger} />
        <h1 className="title-1">Histórico de Eventos</h1>

        {Object.values(events).flat().length === 0 && (
          <p className="text-gray-600">Nenhum evento registrado.</p>
        )}

        {/* Renderiza os cards de cada evento. */}
        <div className="card-spacing-bellow">
          {events.map(e => (
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
