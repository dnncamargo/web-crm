'use client'

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import MainMenu from '@/app/components/MainMenu';

const EventDetails = () => {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const docRef = doc(db, 'events', id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEvent(docSnap.data());
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
        <p><strong>Data:</strong> {event.data}</p>
        <p><strong>Hora:</strong> {event.hora}</p>
        <p><strong>Endereço:</strong> {event.endereco}</p>
        <p><strong>Observações:</strong> {event.observacoes}</p>

        <button onClick={() => router.back()} className="btn-secondary mt-4">Voltar</button>
      </div>
    </div>
  );
};

export default EventDetails;
