'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

import MainMenu from '../components/MainMenu';
import EventCard from '../components/EventCard';
import EditEventModal from '../components/EditEventModal';
import { Event } from '../utils/interfaces';

const EventsHistoryPage = () => {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchEvents = async () => {
    const q = query(collection(db, 'events'), orderBy('data', 'asc'), orderBy('hora', 'asc'));
    const querySnapshot = await getDocs(q);
    const eventosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
    setEvents(eventosData);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openEditEventModal = (event: Event) => {
    setSelectedEvent(event);
    setIsEditModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteDoc(doc(db, 'events', eventId));
    fetchEvents();
  };

  return (
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Histórico de Eventos</h1>

      <div className="space-y-3">
        {events.map(e => (
          <EventCard
            key={e.id}
            event={e}
            onEditEvent={openEditEventModal}
            onDeleteEvent={handleDeleteEvent}
          />
        ))}
      </div>

      {isEditModalOpen && selectedEvent && (
        <EditEventModal
          event={selectedEvent}
          onClose={() => setIsEditModalOpen(false)}
          isOpen={isEditModalOpen}
          onUpdated={fetchEvents}
        />
      )}
    </main>
  );
};

export default EventsHistoryPage;
