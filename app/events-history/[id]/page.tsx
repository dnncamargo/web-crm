'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import MainMenu from '@/app/components/MainMenu';
import { Event, Person } from '@/app/utils/interfaces';

const EventDetails = () => {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [person, setPerson] = useState<Person | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const docRef = doc(db, 'events-history', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const eventData = { id: docSnap.id, ...docSnap.data() } as Event;
        setEvent(eventData);

        // Se evento tiver personId, buscar pessoa associada
        if (eventData.personId) {
          const personRef = doc(db, 'people-directory', eventData.personId);
          const personSnap = await getDoc(personRef);
          if (personSnap.exists()) {
            setPerson({ id: personSnap.id, ...personSnap.data() } as Person);
          }
        }
      }
    };

    fetchEvent();
  }, [id]);

  if (!event) return <p className="p-6">Carregando dados do evento...</p>;

  return (
    <div className="p-6 space-y-6">
      <MainMenu />
      <h1 className="text-xl font-semibold">Detalhes do Evento</h1>

      <div className="bg-white p-4 rounded-lg shadow space-y-2">
        <p><strong>Título:</strong> {event.title}</p>
        <p><strong>Data:</strong> {event.date}</p>
        <p><strong>Hora:</strong> {event.hour || 'Dia inteiro'}</p>


        {event.zipcode && <p><strong>CEP:</strong> {event.zipcode}</p>}
        {event.address && <p><strong>Endereço:</strong> {event.address}</p>}
        {event.number && <p><strong>Número:</strong> {event.number}</p>}
        {event.complement && <p><strong>Complemento:</strong> {event.complement}</p>}
        {event.district && <p><strong>Bairro:</strong> {event.district}</p>}
        {event.city && <p><strong>Cidade:</strong> {event.city}</p>}
        {event.state && <p><strong>Estado:</strong> {event.state}</p>}
        {event.description && <p><strong>Notas:</strong> {event.description}</p>}
        {person && (
          <div className="p-3 bg-gray-50 rounded border">
            <p><strong>{person.name}</strong></p>
            <p className="text-sm text-gray-500">{person.phone}</p>
          </div>
        )}
      </div>

      <button onClick={() => router.back()} className="btn-secondary w-full">Voltar</button>
    </div>
  );
};

export default EventDetails;
