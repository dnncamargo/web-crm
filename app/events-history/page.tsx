'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

import MainMenu from '../components/MainMenu';
import EventCard from '../components/EventCard';
import EditEventModal from '../components/EditEventModal';
import AddEventModal from '../components/AddEventModal';
import { Event } from '../utils/interfaces';

const EventsHistoryPage = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
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

  return (
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Histórico de Eventos</h1>

      <button onClick={() => setIsAddEventModalOpen(true)} className="btn-primary mb-4">Novo Evento</button>

      <div className="space-y-3">
        {events.map(e => (
          <EventCard
            key={e.id}
            event={e}
            onEditEvent={openEditEventModal}
          />
        ))}
      </div>

      {isAddEventModalOpen && (
        <AddEventModal
          onClose={() => setIsAddEventModalOpen(false)}
          isOpen={isAddEventModalOpen}  
          />
      )}

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
