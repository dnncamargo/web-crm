// hooks/useEventCategories.ts
import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/auth/AuthProvider';

export function useEventCategories() {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const fetchCategories = async () => {
    const EventSettingRef = doc(db, `users/${uid}/settings`, 'userCategories');
    const docSnap = await getDoc(EventSettingRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const availableCategories = data?.category || [];
      setAvailableCategories(availableCategories);
    }
  };

  const handleAddCategory = async (newCategory: string) => {
    if (!uid) return;

    const trimmed = newCategory.trim();
    if (!trimmed || availableCategories.includes(trimmed)) return;

    const updatedCategories = [...availableCategories, trimmed];

    try {
      // Salva no Firestore
      const EventsSettingRef = doc(db, `users/${uid}/settings`, 'userCategories');
      await setDoc(EventsSettingRef, { category: updatedCategories }, { merge: true });

      // Atualiza o estado local
      setAvailableCategories(updatedCategories);

    } catch (error) {
      console.error('Erro ao adicionar nova categoria:', error);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const updated = prev.includes(cat)
        ? prev.filter((c) => c !== cat)
        : [...prev, cat];
      console.log('Toggle category:', cat, 'Result:', updated);
      return updated;
    });
  };

  const clearSelectedCategories = () => {
    setSelectedCategories([]);
  };

  useEffect(() => {
    fetchCategories()
  }, [uid])

  return {
    availableCategories,
    selectedCategories,
    setAvailableCategories,
    setSelectedCategories,
    toggleCategory,
    clearSelectedCategories,
    handleAddCategory,
  }
}
