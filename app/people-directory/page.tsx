'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';

import MainMenu from '../components/MainMenu';
import PersonCard from '../components/PersonCard';
import AddEventModal from '../components/AddEventModal';
import AddPersonModal from '../components/AddPersonModal';
import EditPersonModal from '../components/EditPersonModal';

const PeopleDirectory = () => {
  const router = useRouter();

  /* state de controle */
  const [person, setPerson] = useState<Person[]>([]);
  const [selectedClientIdForEvent, setSelectedClientIdForEvent] = useState('');
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleMenu = (personId: string) => {
    setOpenMenuId((prevId) => (prevId === personId ? null : personId));
  };

  const fetchPeople = async () => {
    const querySnapshot = await getDocs(collection(db, 'people-directory'));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Person[];
    setPerson(data);
  };

  const fetchEvents = async () => {
    const querySnapshot = await getDocs(collection(db, 'events-history'));
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(data);
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const openAddEventModal = (personId: string) => {
    setSelectedClientIdForEvent(personId);
    setIsAddEventModalOpen(true);
  };

  const closeAddEventModal = () => {
    setIsAddEventModalOpen(false);
    setSelectedClientIdForEvent('');
    setSelectedPerson(null);
  };

  const openEditPersonModal = (person: Person) => {
    setSelectedPerson(person);
    setIsEditModalOpen(true);
  };

  const handlePersonDeleted = () => {
    setSelectedPerson(null);
    fetchPeople();
  };

  return (

    <main className="p-4 space-y-4 bg-gray-50 min-h-screen">
      <MainMenu />
      <h1 className="text-2xl font-bold mb-4">Diretório de Pessoas</h1>

      <div className="space-y-3">
        {person.map(p => (
          <PersonCard key={p.id} person={p}
            openMenuId={openMenuId}
            toggleMenu={toggleMenu}
            onAddEvent={openAddEventModal}
            onEditPerson={openEditPersonModal}
          />
        ))}

        {isEditModalOpen && selectedPerson && (
          <EditPersonModal
            personId={selectedPerson.id}
            initialData={selectedPerson}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onUpdated={fetchPeople}
            onDeleted={handlePersonDeleted}
          />
        )}
      </div>

      {isAddPersonModalOpen && (
        <AddPersonModal
          onClose={() => setIsAddPersonModalOpen(false)}
          onAdded={fetchPeople}
          isOpen={isAddPersonModalOpen}
        />
      )}

      {isAddEventModalOpen && (
        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={closeAddEventModal}
          onAdded={fetchEvents}
          initialPersonId={selectedClientIdForEvent}
        />
      )}

      <button
        onClick={() => setIsAddPersonModalOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-green-600 transition"
      >
        +
      </button>


    </main>
  );
};

export default PeopleDirectory;
