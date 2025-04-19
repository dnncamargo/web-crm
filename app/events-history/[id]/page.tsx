'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import MainMenu from '@/app/components/MainMenu';
import { Event } from '@/app/utils/interfaces';

const EventDetails = () => {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const docRef = doc(db, 'events-history', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Event;
        setEvent({ ...data, id: docSnap.id });
      }
    };
    fetchEvent();
  }, [id]);

  if (!event) return <p className="p-6">Carregando dados do evento...</p>;

  return (
    <div className="p-6">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Detalhes do Evento</h1>

      <div className="bg-white p-4 rounded-lg shadow space-y-2">
        <p><strong>Título:</strong> {event.title}</p>
        <p><strong>Data:</strong> {event.date}</p>
        <p><strong>Hora:</strong> {event.hour}</p>
        //todo: adicionar o nome da pessoa associada ao evento
        {event.zipcode && <p><strong>CEP:</strong> {event.zipcode}</p>}
        {event.address && <p><strong>Endereço:</strong> {event.address}</p>}
        {event.number && <p><strong>Número:</strong> {event.number}</p>}
        {event.complement && <p><strong>Complemento:</strong> {event.complement}</p>}
        {event.district && <p><strong>Bairro:</strong> {event.district}</p>}
        {event.city && <p><strong>Cidade:</strong> {event.city}</p>}
        {event.state && <p><strong>Estado:</strong> {event.state}</p>}
        {event.description && <p><strong>Descrição:</strong> {event.description}</p>}

        <button onClick={() => router.back()} className="btn-secondary mt-4">Voltar</button>
      </div>
    </div>
  );
};

export default EventDetails;
