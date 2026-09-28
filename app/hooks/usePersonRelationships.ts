// hooks/usePersonRelationships;
import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/auth/AuthProvider';

export function usePersonRelationships() {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const [availableRelationships, setAvailableRelationships] = useState<string[]>([])
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);

    const fetchRelationships = async () => {
    const PersonSettingRef = doc(db, `users/${uid}/settings`, 'userRelationships');
    const docSnap = await getDoc(PersonSettingRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const availableRelationships = data?.relationship || [];
      setAvailableRelationships(availableRelationships);
    }
  };

  const handleAddRelationship = async (newRelationship: string) => {
    if (!uid) return;

    const trimmed = newRelationship.trim();
    if (!trimmed || availableRelationships.includes(trimmed)) return;

    const updatedRelationships = [...availableRelationships, trimmed];

    try {
      // Salva no Firestore
      const PeopleSettingRef = doc(db, `users/${uid}/settings`, 'userRelationships');
      await setDoc(PeopleSettingRef, { relationship: updatedRelationships }, { merge: true });

      // Atualiza o estado local
      setAvailableRelationships(updatedRelationships);

    } catch (error) {
      console.error('Erro ao adicionar novo relacionamento:', error);
    }
  };

  const toggleRelationship = (rel: string) => {
    setSelectedRelationships((prev) => {
      const updated = prev.includes(rel)
        ? prev.filter((c) => c !== rel)
        : [...prev, rel];
      console.log('Toggle relationship:', rel, 'Result:', updated);
      return updated;
    });
  };

  const clearSelectedRelationships = () => {
    setSelectedRelationships([]);
  };

  useEffect(() => {
    fetchRelationships()
  }, [uid]);

  return {
    availableRelationships,
    selectedRelationships,
    setSelectedRelationships,
    toggleRelationship,
    clearSelectedRelationships,
    handleAddRelationship
  }
}