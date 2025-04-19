'use client'

import { useState, useEffect } from 'react';
import { collection, doc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Event } from '../utils/interfaces';

import MainMenu from '../components/MainMenu';
import EventCard from '../components/EventCard';
import EditEventModal from '../components/EditEventModal';
import AddEventModal from '../components/AddEventModal';

const EventsHistory = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchEvents = async () => {
    const q = query(collection(db, 'events-history'), orderBy('date', 'asc'), orderBy('hour', 'asc'));
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
    <main className="p-4 space-y-4 bg-gray-50 min-h-screen">
      <MainMenu />
      <h1 className="text-2xl font-bold mb-4">Histórico de Eventos</h1>

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
          onAdded={fetchEvents}
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

<button
  onClick={() => setIsAddEventModalOpen(true)}
  className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-blue-600 transition"
>
  +
</button>



    </main>
  );
};

export default EventsHistory;
