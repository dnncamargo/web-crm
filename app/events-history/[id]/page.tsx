'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '@/app/components/AuthProvider';
import { Event, Person } from '@/app/utils/interfaces';
import { createGoogleCalendarEvent } from '@/app/utils/googleCalendar';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import MainMenu from '@/app/components/MainMenu';

/**
 * @component
 * @description Componente para exibir os detalhes de um evento específico, incluindo informações sobre a pessoa associada (se houver).
 * @returns {JSX.Element} A interface de detalhes do evento.
 */
const EventDetails = () => {
  const { user } = useAuth(); /** @const {User | null} user - O usuário autenticado. */
  const { id } = useParams();  /** @const {string} id - O ID do evento a ser exibido, extraído da URL. */
  const router = useRouter(); /** @const {object} router - O objeto de roteamento do Next.js. */

  const [event, setEvent] = useState<Event | null>(null); /** @state {Event | null} event - Os detalhes do evento buscado do Firestore. Inicialmente null. */
  const [person, setPerson] = useState<Person | null>(null); /** @state {Person | null} person - Os detalhes da pessoa associada ao evento, buscados do Firestore. Inicialmente null. */

  useEffect(() => {
    if (user && id) {
      fetchEvent();
    }
  }, [ user, id ]);

  if (!user) {
    return <p>Carregando usuário...</p>;
  }

  /**
 * @async
 * @function fetchEvent
 * @description Busca os dados do evento específico da coleção 'events-history' no Firestore.
 * @returns {Promise<void>}
 */
  const fetchEvent = async (): Promise<void> => {
    try {

      const docRef = doc(db, `users/${user.uid}/events-history/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const eventData = { id: docSnap.id, ...docSnap.data() } as Event;
        setEvent(eventData);

        // Se evento tiver personId, buscar pessoa associada
        if (eventData.personId) {
          const personRef = doc(db, `users/${user.uid}/people-directory`, eventData.personId);
          const personSnap = await getDoc(personRef);
          if (personSnap.exists()) {
            setPerson({ id: personSnap.id, ...personSnap.data() } as Person);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar evento:', error);
    }
  };

  if (!event) return <p className="p-6">Carregando dados do evento...</p>;

  return (

    <ProtectedRoute>

      <div className="p-6 space-y-6 gap-2">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu />
        <h1 className="text-xl font-semibold">Detalhes do Evento</h1>

        {/* Dados principais */}
        <div className="bg-white p-4 rounded-lg shadow space-y-2">
          <p><strong>Evento:</strong> {event.title}</p>
          <p><strong>Data:</strong> {event.startDate}</p>
          <p><strong>Hora:</strong> {event.startTime || 'Dia inteiro'}</p>

          {/* Endereço */}
          {event.zipcode && <p><strong>CEP:</strong> {event.zipcode}</p>}
          {event.address && <p><strong>Endereço:</strong> {event.address}</p>}
          {event.number && <p><strong>Número:</strong> {event.number}</p>}
          {event.complement && <p><strong>Complemento:</strong> {event.complement}</p>}
          {event.district && <p><strong>Bairro:</strong> {event.district}</p>}
          {event.city && <p><strong>Cidade:</strong> {event.city}</p>}
          {event.state && <p><strong>Estado:</strong> {event.state}</p>}

          {/* Outras informações */}
          {event.description && <p><strong>Notas:</strong> {event.description}</p>}

          {/* Pessoa associada */}
          {person && (
            <div className="bg-gray-50 rounded border">
              <p><strong>{person.name}</strong></p>
              <p className="text-sm text-gray-500">{person.phone}</p>
            </div>
          )}
        </div>


        {/* Botão para criar evento no Google Calendar */}
        <button
          onClick={async () => { createGoogleCalendarEvent(event) }}
          className="btn-primary w-full">
          Criar Evento no Google Calendar
        </button>

        {/* Botão Voltar */}
        <button
          onClick={() => router.back()}
          className="btn-secondary w-full">
          Voltar
        </button>
      </div>
    </ProtectedRoute>
  );
};

export default EventDetails;
