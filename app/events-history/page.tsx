'use client'

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import EventCard from '../components/EventCard';
import MainMenu from '../components/MainMenu';

const EventsHistoryPage = () => {
  const [eventos, setEventos] = useState<any[]>([]);
  const router = useRouter();

  const fetchEventos = async () => {
    const q = query(collection(db, 'events'), orderBy('data', 'asc'), orderBy('hora', 'asc'));
    const querySnapshot = await getDocs(q);
    const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEventos(eventosData);
  };

  useEffect(() => {
    fetchEventos();
  }, []);

  return (
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Histórico de Eventos</h1>

      <div className="space-y-3">
        {eventos.map(evento => (
          <EventCard key={evento.id} evento={evento} />
        ))}
      </div>
    </main>
  );
};

export default EventsHistoryPage;
