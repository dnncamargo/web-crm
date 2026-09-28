import { useState } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

export interface Person {
  id: string;
  name: string;
  // outros campos se existirem
}

interface UseAssociatePersonProps {
  uid: string;
}

export function useAssociatePerson({ uid }: UseAssociatePersonProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [associatedPersonIds, setAssociatedPersonIds] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  // 🔹 Fetch de pessoas no Firestore
  const fetchPeople = async () => {
    setError(''); // Limpa o erro antes de buscar
    try {
      const snapshot = await getDocs(collection(db, `users/${uid}/people-directory`));
      const peopleData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Person, 'id'>),
      }));
      //console.log(JSON.stringify(peopleData, null, 2));
      setPeople(peopleData);
      setError('');
    } catch (err) {
      console.error('Erro ao buscar pessoas:', err);
      setError('Erro ao carregar pessoas');
    }
  };

  // 🔸 Associa uma pessoa
  const associatePerson = (personId: string) => {
    if (!associatedPersonIds.includes(personId)) {
      setAssociatedPersonIds(prev => [...prev, personId]);
    }
  };

  // 🔸 Remove uma pessoa associada
  const disassociatePerson = (personId: string) => {
    setAssociatedPersonIds(prev => prev.filter(id => id !== personId));
  };

  // 🔸 Limpa associações
  const resetAssociatedPeople = () => {
    setAssociatedPersonIds([]);
  };

  const getFirstAssociatedPersonName = () => {
    const firstPersonId = associatedPersonIds[0];
    const person = people.find(p => p.id === firstPersonId);
    return person ? person.name : '';
  };

  return {
    // Dados
    people,
    associatedPersonIds,

    // Estados auxiliares

    error,

    // Ações
    fetchPeople,
    associatePerson,
    disassociatePerson,
    getFirstAssociatedPersonName,
    setAssociatedPersonIds,
    resetAssociatedPeople,
  };
}
