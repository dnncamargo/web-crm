'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

import MainMenu from '../components/MainMenu';
import EventCard from '../components/EventCard';

const EventsHistoryPage = () => {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);

  const fetchEvents = async () => {
    const q = query(collection(db, 'events'), orderBy('data', 'asc'), orderBy('hora', 'asc'));
    const querySnapshot = await getDocs(q);
    const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setEvents(eventosData);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Histórico de Eventos</h1>

      <div className="space-y-3">
        {events.map(e => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </main>
  );
};

export default EventsHistoryPage;
