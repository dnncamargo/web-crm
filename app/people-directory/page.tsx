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
    <main className="p-4">
      <MainMenu />
      <h1 className="text-xl font-semibold mb-4">Diretório de Pessoas</h1>

      <button onClick={() => setIsAddPersonModalOpen(true)} className="btn-primary mb-4">Adicionar Pessoa</button>

      <div className="space-y-3">
        {person.map(p => (
          <PersonCard key={p.id} person={p}
            onAddEvent={openAddEventModal}
            onEditPerson={openEditPersonModal}
          />
        ))}

        {isEditModalOpen && selectedPerson && (
          <EditPersonModal
            personId={selectedPerson.id}
            initialData={selectedPerson}
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
        />
      )}

      {isAddEventModalOpen && (
        <AddEventModal 
          isOpen={isAddEventModalOpen}
          onClose={closeAddEventModal}
          onAdded={fetchEvents} />
      )}
    </main>
  );
};

export default PeopleDirectory;
