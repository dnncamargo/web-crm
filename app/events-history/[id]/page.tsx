'use client';

import { useState, useEffect, MouseEventHandler } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '@/app/components/AuthProvider';
import { Event, Person } from '@/app/utils/interfaces';
import { createGoogleCalendarEvent } from '@/app/utils/googleCalendar';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import MainMenu from '@/app/components/MainMenu';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import { StarIcon as StarSolid } from '@heroicons/react/24/solid';
import { v4 as uuidv4 } from 'uuid';

type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

type OptionalField = {
  id: string;                 // UUID para controle único
  type: 'text' | 'textarea' | 'url' | 'location' | 'person' | 'tasks';
  label: string;             // Ex: "Descrição", "URL", "Endereço Alternativo"
  value: string | TaskItem[]; // string para os outros tipos, array para tasks
};

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
  const [person, setPerson] = useState<Person | null>(null); /** @state {Person | null} person - Os detalhes da pessoa associada ao evento, buscados do Firestore. Inicialmente null. */
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

        // Se evento tiver personId, buscar pessoa associada
        if (eventData.personId) {
          const personRef = doc(db, `users/${uid}/people-directory`, eventData.personId);
          const personSnap = await getDoc(personRef);
          if (personSnap.exists()) {
            setPerson({
              id: personSnap.id, ...personSnap.data()

            } as Person);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar evento:', error);
    }
  };

  if (!event) return <div className="animate-pulse text-gray-500 m-6">Carregando as informações do evento...</div>;


  const updateOptionalFieldTasks = async (fieldId: string, updatedTasks: TaskItem[]) => {
    if (!event || !uid) return;

    const updatedFields = event.optionalFields.map((field: { id: string; type: string; }) => {
      if (field.id === fieldId && field.type === 'tasks') {
        return { ...field, value: updatedTasks };
      }
      return field;
    });

    setEvent({ ...event, optionalFields: updatedFields });

    await updateDoc(doc(db, `users/${uid}/events-history/${event.id}`), {
      optionalFields: updatedFields
    });
  };

  const addTask = (fieldId: string) => {
    const newTask: TaskItem = {
      id: uuidv4(),
      text: '',
      done: false
    };

    const targetField = event?.optionalFields.find((f: { id: string; }) => f.id === fieldId);
    if (!targetField || targetField.type !== 'tasks') return;

    const currentTasks = targetField.value as TaskItem[];
    updateOptionalFieldTasks(fieldId, [...currentTasks, newTask]);
  };

  const updateTaskText = (fieldId: string, taskId: string, newText: string) => {
    const field = event?.optionalFields.find((f: { id: string; type: string; }) => f.id === fieldId && f.type === 'tasks');
    if (!field) return;

    const updatedTasks = (field.value as TaskItem[]).map(task =>
      task.id === taskId ? { ...task, text: newText } : task
    );

    updateOptionalFieldTasks(fieldId, updatedTasks);
  };

  const toggleTaskDone = (fieldId: string, taskId: string) => {
    const field = event?.optionalFields.find((f: { id: string; type: string; }) => f.id === fieldId && f.type === 'tasks');
    if (!field) return;

    const updatedTasks = (field.value as TaskItem[]).map(task =>
      task.id === taskId ? { ...task, done: !task.done } : task
    );

    updateOptionalFieldTasks(fieldId, updatedTasks);
  };

  const deleteTask = (fieldId: string, taskId: string) => {
    const field = event?.optionalFields.find((f: { id: string; type: string; }) => f.id === fieldId && f.type === 'tasks');
    if (!field) return;

    const updatedTasks = (field.value as TaskItem[]).filter(task => task.id !== taskId);
    updateOptionalFieldTasks(fieldId, updatedTasks);
  };


  function renderOptionalFieldValue(field: OptionalField) {
    switch (field.type) {
      case 'url':
        return (
          <a
            href={field.value as string}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {typeof field.value === 'string'
              ? field.value
              : '[Tipo de campo não suportado para exibição direta]'}
          </a>
        );

      case 'tasks':
        const tasks = Array.isArray(field.value) ? field.value as TaskItem[] : [];
        return (
          <div className="space-y-2">
            <ul className="space-y-1">
              {tasks.map(task => (
                <li key={task.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTaskDone(field.id, task.id)}
                    className="h-4 w-4 text-green-600"
                  />
                  <input
                    type="text"
                    value={task.text}
                    onChange={(e) => updateTaskText(field.id, task.id, e.target.value)}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                    placeholder="Descrição da tarefa"
                  />
                  <button
                    onClick={() => deleteTask(field.id, task.id)}
                    className="text-red-500 text-xs"
                  >
                    Excluir
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => addTask(field.id)}
              className="text-blue-600 text-sm underline mt-2"
            >
              + Nova tarefa
            </button>
          </div>
        );


      case 'textarea':
        return (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {typeof field.value === 'string'
              ? field.value
              : '[Tipo de campo não suportado para exibição direta]'}
          </div>
        );

      default:
        return (
          <span
            className="italic text-gray-400">
            {typeof field.value === 'string'
              ? field.value
              : `Campo não suportado: {field.label}`}
          </span>);
    }
  }

  const handleRatingChange = async (value: number) => {
    const newRating = currentRating === value ? 0 : value;
    setCurrentRating(newRating);

    await updateDoc(doc(db, `users/${uid}/events-history/${id}`), {
      rating: newRating,
    });
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
          {event.zipcode && <p><strong>CEP:</strong> {event.zipcode}</p>}
          {event.address && <p><strong>Endereço:</strong> {event.address}</p>}
          {event.number && <p><strong>Número:</strong> {event.number}</p>}
          {event.complement && <p><strong>Complemento:</strong> {event.complement}</p>}
          {event.district && <p><strong>Bairro:</strong> {event.district}</p>}
          {event.city && <p><strong>Cidade:</strong> {event.city}</p>}
          {event.state && <p><strong>Estado:</strong> {event.state}</p>}
        </div>

        {/* Outras informações */}
        {(event.optionalFields.length > 0 || person) &&
        <div className="bg-white p-4 rounded-lg shadow space-y-2">
          {event.optionalFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-700">Outras informações</h3>
              {event.optionalFields.map((field: OptionalField) => (
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
          {person && (
            <div className="bg-gray-50 rounded border pl-2">
              <p><strong>{person.name}</strong></p>
              <p className="text-sm text-gray-500">{person.phone}</p>
            </div>
          )}
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
