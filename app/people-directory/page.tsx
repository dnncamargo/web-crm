'use client';

import { useState, useEffect, JSX } from 'react';
import { doc, getDocs, updateDoc, collection, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { Person } from '../utils/interfaces';
import ProtectedRoute from '../components/ProtectedRoute';
import MainMenu from '../components/MainMenu';
import PersonCard from '../components/PersonCard';
import AddPersonModal from '../components/AddPersonModal';
import EditPersonModal from '../components/EditPersonModal';
import { UserPlusIcon } from '@heroicons/react/24/outline';
import { ListFilterIcon } from 'lucide-react';
import PersonFilterModal from '../components/PersonFilterModal';
import type { PersonFilter } from '../components/PersonFilterModal';
import Masonry from 'react-masonry-css'

const defaultFilters: PersonFilter = {
  enabled: true,
  hasPhone: false,
  hasEmail: false,
  hasBirthday: false,
  hasAddressByCep: false,
  hasNote: false,
  isFavorite: false,
  hasContactFrequency: false,
  selectedRelationships: [],
};


/**
 * @component
 * @description Componente para exibir e gerenciar o diretório de pessoas. Permite adicionar, editar e excluir pessoas.
 * @returns {JSX.Element} A interface do diretório de pessoas.
 */
const PeopleDirectory = (): JSX.Element => {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const [people, setPeople] = useState<Person[]>([]);  /** @state {Person[]} people - Array de pessoas buscadas do Firestore. */
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);  /** @state {boolean} isAddPersonModalOpen - Controla a visibilidade do modal de adicionar uma nova pessoa. */
  const [isEditPersonModalOpen, setIsEditPersonModalOpen] = useState(false);  /** @state {boolean} isEditModalOpen - Controla a visibilidade do modal de edição de uma pessoa existente. */
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);  /** @state {Person | null} selectedPerson - A pessoa selecionada para edição. */
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false); // para evitar renderização prematura
  const [filters, setFilters] = useState<PersonFilter>({
    ...defaultFilters,
    selectedRelationships: [],
  });
  const [availableRelationships, setAvailableRelationships] = useState<string[]>([]);

  const [menuCloseTrigger, setMenuCloseTrigger] = useState<boolean>(false)  /** @state {boolean} closeMenu - Controla a visibilidade do menu principal. */

  useEffect(() => {
    // Chama a função fetchPeople quando o componente é montado.
    // Isso garante que a lista de pessoas seja carregada assim que o componente for exibido.
    if (uid) {
      fetchPeople();
    }
  }, [uid]);

  useEffect(() => {
    const init = async () => {
      if (!uid) return;

      try {
        const PeopleSettingRef = doc(db, `users/${uid}/settings`, 'userPeopleFilters');
        const snapshot = await getDoc(PeopleSettingRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setFilters({
            ...defaultFilters,
            ...data,
            selectedRelationships: Array.isArray(data?.selectedRelationships) ? data.selectedRelationships : [],
          });
        }
      } catch (error) {
        console.error('Erro ao carregar filtros:', error);
      } finally {
        setFiltersLoaded(true);
      }
    };


    const fetchRelationships = async () => {
      const docRef = doc(db, `users/${uid}/settings`, 'userRelationships');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const availableRelationships = data?.relationship || [];
        setAvailableRelationships(availableRelationships);

        // Atualiza os filtros apenas se ainda estiverem vazios
        setFilters(prev => ({
          ...prev,
          selectedRelationships: Array.isArray(prev.selectedRelationships) && prev.selectedRelationships.length === 0
            ? availableRelationships
            : (Array.isArray(prev.selectedRelationships) ? prev.selectedRelationships : [])
        }));

      }
    };

    fetchRelationships();

    init();
  }, [uid]);

  /**
 * @async
 * @function fetchPeople
 * @description Busca a lista de pessoas do Firestore na coleção 'people-directory'.
 * @returns {Promise<void>}
 */
  const fetchPeople = async (): Promise<void> => {
    try {
      // Obtém todos os documentos da coleção 'people-directory' no banco de dados 'db'.
      const querySnapshot = await getDocs(collection(db, `users/${uid}/people-directory`));
      // Mapeia os documentos para um array de objetos 'Person', incluindo o ID do documento.
      const peopleData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Person[];

      // Favoritos primeiro
      const sorted = peopleData.sort((a, b) => {
        // Ordenação primária: favoritos primeiro
        const favDiff = Number(b.favorite) - Number(a.favorite);
        if (favDiff !== 0) {
          return favDiff;
        }
        return a.name.localeCompare(b.name); // Ordenação secundária: por nome
      });
      // Atualiza o estado 'person' com os dados ordenados.
      setPeople(sorted);
    } catch (error) {
      console.error('Erro ao buscar pessoas:', error);
      //todo: Lide com o erro de forma apropriada (ex: exibir uma mensagem ao usuário)
    }
  };

  /**
 * @function openEditPersonModal
 * @description Abre o modal de edição para a pessoa fornecida.
 * @param {Person} person - O objeto da pessoa a ser editada.
 * @returns {void}
 */
  const openEditPersonModal = (person: Person) => {
    setSelectedPerson(person);
    setIsEditPersonModalOpen(true);
  };

  /**
 * @function handlePersonDeleted
 * @description Limpa a pessoa selecionada para edição e recarrega a lista de pessoas.
 * @returns {void}
 */
  const handlePersonDeleted = () => {
    setSelectedPerson(null);
    fetchPeople();
  };

  /**
 * @async
 * @function toggleFavorite
 * @description Alterna o status de favorito de uma pessoa no Firestore e recarrega a lista de pessoas.
 * @param {string} personId - O ID da pessoa cujo status de favorito deve ser alterado.
 * @param {boolean} currentValue - O valor atual do status de favorito da pessoa.
 * @returns {Promise<void>}
 */
  const toggleFavorite = async (personId: string, currentValue: boolean) => {
    const docRef = doc(db, `users/${uid}/people-directory`, personId);
    await updateDoc(docRef, { favorite: !currentValue });
    fetchPeople();
  };

  const filteredPeople = (!filters.enabled || !filtersLoaded)
    ? people
    : people.filter((person) => {
      const optionalFields = person.optionalFields ?? [];

      // Filtro: telefone principal presente
      const matchesPhone = !filters.hasPhone || !!person.phone;

      // Filtro: e-mail principal presente
      const matchesEmail = !filters.hasEmail || !!person.email;

      // Filtro: data de nascimento presente
      const matchesBirthday = !filters.hasBirthday || !!person.birthday;

      // Filtro: favorito marcado
      const matchesFavorite = !filters.isFavorite || !!person.favorite;

      // Filtro: frequência de contato definida
      const matchesFrequency = !filters.hasContactFrequency || !!person.contactFrequency;

      // Filtro: possui endereço com CEP via API nos optionalFields
      const hasAddressByCep =
        Array.isArray(optionalFields) &&
        optionalFields.some(
          (field) =>
            field.type === 'address' &&
            field.value.useAddressAPI &&
            typeof field.value.zipcode === 'string' &&
            field.value.zipcode.trim() !== ''
        );
      const matchesAddress = !filters.hasAddressByCep || hasAddressByCep;

      // Filtro: possui nota (anotação)
      const hasNote =
        Array.isArray(optionalFields) &&
        optionalFields.some(
          (field) =>
            field.type === 'note' &&
            typeof field.value === 'string' &&
            field.value.trim() !== ''
        );
      const matchesNote = !filters.hasNote || hasNote;

      // Filtro: possui pelo menos um dos tipos de relacionamento definidos

      const matchesRelationship =
        (filters.selectedRelationships?.length ?? 0) === 0 ||
        (Array.isArray(person.relationship)
          ? person.relationship
          : []
        ).some((rel) => filters.selectedRelationships.includes(rel));

      return (
        matchesPhone &&
        matchesEmail &&
        matchesBirthday &&
        matchesFavorite &&
        matchesFrequency &&
        matchesAddress &&
        matchesNote &&
        matchesRelationship
      );
    });

  const handleAddRelationship = async (newRelationship: string) => {
    if (!uid) return;

    const trimmed = newRelationship.trim();
    if (!trimmed || availableRelationships.includes(trimmed)) return;

    const updatedRelationships = [...availableRelationships, trimmed];

    try {
      // Salva no Firestore
      const docRef = doc(db, `users/${uid}/settings`, 'userRelationships');
      await setDoc(docRef, { relationship: updatedRelationships }, { merge: true });

      // Atualiza o estado local
      setAvailableRelationships(updatedRelationships);

      // (Opcional) Atualiza o filtro para já incluir o novo relacionamento
      setFilters(prev => ({
        ...prev,
        selectedRelationships: [...prev.selectedRelationships, trimmed],
      }));
    } catch (error) {
      console.error('Erro ao adicionar novo relacionamento:', error);
    }
  };

  const updateFilters = async (updated: PersonFilter) => {
    setFilters(updated);
    if (uid) {
      const PeopleSettingRef = doc(db, `users/${uid}/settings`, 'userPeopleFilters')
      setDoc(PeopleSettingRef, updated)
    }
  };

  const filtersAreActive =
    filters.enabled
  //&& (key !== 'whatRelationshipType' || val.value.length > 0)

  return (

    <ProtectedRoute>

      <main className="main-container-body main-container-bg">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu externalCloseTrigger={menuCloseTrigger} />

        <div className="flex justify-between">
          <h1 className="title-1">Diretório de Pessoas</h1>

          <ListFilterIcon
            className={`flex items-center w-6 h-6 mr-2 cursor-pointer transition 
              ${filtersAreActive ?
                'text-green-600' :
                'text-gray-300'}`} // Adicione cursor-pointer para indicar que é clicável
            onClick={() => setShowFilterModal(true)} // Abre o modal ao clicar
          />
        </div>

        <PersonFilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          filters={filters}
          setFilters={updateFilters}
          availableRelationships={availableRelationships}
        />


        {Object.values(people).flat().length === 0 && (
          <p className="text-gray-600">Nenhuma pessoa registrada.</p>
        )}

        {/* Renderiza os cards de cada pessoa. */}
        <div className="card-spacing-bellow">
          <Masonry
            breakpointCols={{ default: 3, 1024: 2, 640: 1 }}
            className="flex gap-4"
            columnClassName="flex flex-col gap-4"
          >
            {filteredPeople.map(p => (
              <PersonCard
                key={p.id}
                person={p}
                onEditPerson={openEditPersonModal}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </Masonry>
        </div>

        {/* Modal de adição de nova pessoa. Abre quando isAddPersonModalOpen é verdadeiro. */}
        {isAddPersonModalOpen && (
          <AddPersonModal
            onClose={() => setIsAddPersonModalOpen(false)}
            onAdded={fetchPeople}
            isOpen={isAddPersonModalOpen}
            availableRelationships={availableRelationships}
            setAvailableRelationships={setAvailableRelationships}
            onAddRelationship={handleAddRelationship}
          />
        )}

        {/* Modal de edição de pessoa. Abre quando isEditModalOpen é verdadeiro e uma pessoa está selecionada. */}
        {isEditPersonModalOpen && selectedPerson && (
          <EditPersonModal
            person={selectedPerson}
            isOpen={isEditPersonModalOpen}
            onClose={() => setIsEditPersonModalOpen(false)}
            onUpdated={fetchPeople}
            onDeleted={handlePersonDeleted}
            availableRelationships={availableRelationships}
            setAvailableRelationships={setAvailableRelationships}
            onAddRelationship={handleAddRelationship}
          />
        )}

        {/* Botão flutuante para adicionar uma nova pessoa. Ao clicar, abre o modal de adição. */}
        <button
          onClick={() => {
            setIsAddPersonModalOpen(true); // Abre o modal de adição
            setMenuCloseTrigger(true)
          } // Fecha o menu principal ao abrir o modal de adição
          }
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg text-3xl hover:bg-green-600 transition"
        >
          <UserPlusIcon className="w-6 h-6" />
        </button>
      </main>

    </ProtectedRoute>
  );
};

export default PeopleDirectory;
