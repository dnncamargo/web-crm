// hooks/useFetchPeople.ts
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';

/**
 * Hook que busca todas as pessoas do Firestore.
 * @param uid ID do usuário logado.
 * @returns { people } Lista de pessoas.
 */
export function useFetchPeople(uid: string | null): Person[] {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    async function fetchPeople() {
      try {
        if (!uid) return;

        const querySnapshot = await getDocs(collection(db, `users/${uid}/people-directory`));
        const fetched = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Person[];

        setPeople(fetched);
      } catch (error) {
        console.error('Erro ao buscar pessoas:', error);
        // TODO: lidar com erro de forma adequada (ex: toast, fallback, etc.)
      }
    }

    fetchPeople();
  }, [uid]);

  return people;
}

{/* Associação de pessoa ao Evento */ }
/*   export function handleAssociatePerson() {
    if (initialPersonId) {
      setAssociatePerson(true); // Se 'initialPersonId' existir, indica que um contato deve ser associado ao evento.
      setSelectedPersonId(initialPersonId); // Define o ID da pessoa selecionada com o valor de 'event.personId'.
    } else {
      setAssociatePerson(false); // Se 'initialPersonId' não existir, indica que nenhum contato deve ser associado.
      setSelectedPersonId(''); // Limpa o ID da pessoa selecionada.
    }
  }
 */