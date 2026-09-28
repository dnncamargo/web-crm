'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '@/app/components/auth/AuthProvider';
import { Event, Person } from '@/app/utils/interfaces';
import { OptionalField } from '@/app/types/optionalFields';
import { createGoogleCalendarEvent } from '@/app/utils/googleCalendar';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import MainMenu from '../../components/ui/MainMenu';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { CheckCircle, Circle } from 'lucide-react';

/**
 * @component
 * @description Componente para exibir os detalhes de um evento específico, incluindo informações sobre a pessoa associada (se houver).
 * @returns {JSX.Element} A interface de detalhes do evento.
 */
const EventDetails = () => {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];  /** @const {string} id - O ID do evento a ser exibido, extraído da URL. */
  const router = useRouter(); /** @const {object} router - O objeto de roteamento do Next.js. */

  const [event, setEvent] = useState<Event | null>(null); /** @state {Event | null} event - Os detalhes do evento buscado do Firestore. Inicialmente null. */
  const [person, setPerson] = useState<Person[] | null>(null); /** @state {Person[] | null} person - Os detalhes das pessoas associadas ao evento, buscados do Firestore. Inicialmente null. */
  const [currentRating, setCurrentRating] = useState(0);

  useEffect(() => {
    if (uid && id) {
      fetchEvent();
    }
    if (typeof event?.rating === 'number') {
      setCurrentRating(event.rating);
    }
  }, [uid, id, event]);

  /**
 * @async
 * @function fetchEvent
 * @description Busca os dados do evento específico da coleção 'events-history' no Firestore.
 * @returns {Promise<void>}
 */
  const fetchEvent = async (): Promise<void> => {
    try {

      const docRef = doc(db, `users/${uid}/events-history/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {

        const eventData = {
          id: docSnap.id, ...docSnap.data()

        } as Event;
        setEvent(eventData);

        // Se evento tiver personIds, buscar pessoas associadas
        if (eventData.personIds && eventData.personIds.length > 0) {
          const personPromises = eventData.personIds.map(async (personId) => {
            const personRef = doc(db, `users/${uid}/people-directory`, personId);
            const personSnap = await getDoc(personRef);
            if (personSnap.exists()) {
              return { id: personSnap.id, ...personSnap.data() } as Person;
            }
          });
          const people = await Promise.all(personPromises);
          // Filtra pessoas válidas (não undefined)
          const validPeople = people.filter((p): p is Person => p !== undefined);
          setPerson(validPeople);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar evento:', error);
    }
  };

  if (!event) return <div className="animate-pulse text-gray-500 m-6">Carregando as informações do evento...</div>;

  const handleRatingChange = async (value: number) => {
    const newRating = currentRating === value ? 0 : value;
    setCurrentRating(newRating);

    await updateDoc(doc(db, `users/${uid}/events-history/${id}`), {
      rating: newRating,
    });
  };

  const renderOptionalFieldValue = (field: OptionalField) => {
    switch (field.type) {
      case 'text':
      case 'additionalEmail':
      case 'additionalPhone':
      case 'url':
        return field.value as string;

      case 'address':
        const { address, number, district, city, state, zipcode } = field.value;
        const parts = [
          address && `Endereço: ${address}`,
          number && `Número: ${number}`,
          district && `Bairro: ${district}`,
          city && `Cidade: ${city}`,
          state && `Estado: ${state}`,
          zipcode && `CEP: ${zipcode}`,
        ].filter(Boolean);
        return parts.join(', ');

      case 'tasks':
        return (
          <ul className="space-y-1">
            {(field.value as { id: string; text: string; done?: boolean }[]).map((task) => (
              <li key={task.id} className="flex items-start gap-2">
                <span className="text-lg">
                  {task.done ? (
                    <CheckCircle className="text-green-500 w-4 h-4 mt-0.5" />
                  ) : (
                    <Circle className="text-gray-400 w-4 h-4 mt-0.5" />
                  )}

                </span>
                <span className={task.done ? 'line-through text-gray-500' : ''}>
                  {task.text}
                </span>
              </li>
            ))}
          </ul>
        );


      default:
        return 'Valor não suportado';
    }
  };


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
          {event.location && (
            <div className="mt-2">
              <p><strong>Local:</strong> {event.location}</p>
            </div>
          )}

        </div>

        {/* Outras informações (OptionalFields) */}
        {(event.optionalFields && event.optionalFields.length > 0 || person) &&
          <div className="bg-white p-4 rounded-lg shadow space-y-2">
            {event.optionalFields && event.optionalFields.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-700">Outras informações</h3>
                {event.optionalFields.map((field) => (
                  <div key={field.id} className="bg-gray-50 p-3 rounded border">
                    <p className="text-sm font-medium text-gray-600">{field.label}</p>
                    <div className="mt-1 text-gray-800 text-sm break-words">
                      {renderOptionalFieldValue(field)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pessoa associada */}
            {person && person.length > 0 && person.map((p) => (
              <div key={p.id} className="bg-gray-50 rounded border pl-2">
                <p><strong>{p.name}</strong></p>
                <p className="text-sm text-gray-500">{p.phone}</p>
              </div>
            ))}
          </div>}

        {/* Avaliação do Evento */}
        <div className="bg-white flex items-center p-4 rounded-lg shadow space-y-2">
          <p><strong>Avaliação:</strong></p>
          <div className="flex items-center ml-2 space-x-2">
            {[1, 2, 3, 4, 5].map((star) =>
              star <= currentRating ? (
                <StarSolid
                  key={star}
                  className="h-5 w-5 text-yellow-500 mb-2 cursor-pointer"
                  onClick={() => handleRatingChange(star)}
                />
              ) : (
                <StarOutline
                  key={star}
                  className="h-5 w-5 text-gray-500 mb-2 cursor-pointer"
                  onClick={() => handleRatingChange(star)}
                />
              )
            )}
          </div>
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
