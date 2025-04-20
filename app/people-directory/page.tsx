'use client';

import { useState, useEffect, JSX } from 'react';
import { doc, getDocs, updateDoc, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';
import MainMenu from '../components/MainMenu';
import PersonCard from '../components/PersonCard';
import AddPersonModal from '../components/AddPersonModal';
import EditPersonModal from '../components/EditPersonModal';

/**
 * @component
 * @description Componente para exibir e gerenciar o diretório de pessoas. Permite adicionar, editar e excluir pessoas.
 * @returns {JSX.Element} A interface do diretório de pessoas.
 */
const PeopleDirectory = (): JSX.Element => {

  const [person, setPerson] = useState<Person[]>([]);  /** @state {Person[]} person - Array de pessoas buscadas do Firestore. */
  const [isAddPersonModalOpen, setIsAddPersonModalOpen] = useState(false);  /** @state {boolean} isAddPersonModalOpen - Controla a visibilidade do modal de adicionar uma nova pessoa. */
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);  /** @state {boolean} isEditModalOpen - Controla a visibilidade do modal de edição de uma pessoa existente. */
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);  /** @state {Person | null} selectedPerson - A pessoa selecionada para edição. */

  useEffect(() => {
    // Chama a função fetchPeople quando o componente é montado.
    // Isso garante que a lista de pessoas seja carregada assim que o componente for exibido.
    fetchPeople();
  }, []);

  /**
 * @async
 * @function fetchPeople
 * @description Busca a lista de pessoas do Firestore na coleção 'people-directory'.
 * @returns {Promise<void>}
 */
  const fetchPeople = async (): Promise<void> => {
    try {
      // Obtém todos os documentos da coleção 'people-directory' no banco de dados 'db'.
      const querySnapshot = await getDocs(collection(db, 'people-directory'));
      // Mapeia os documentos para um array de objetos 'Person', incluindo o ID do documento.
      const personData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Person[];

      // Favoritos primeiro
      const sorted = personData.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
      // Atualiza o estado 'person' com os dados ordenados.
      setPerson(sorted);
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
    setIsEditModalOpen(true);
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
    const docRef = doc(db, 'people-directory', personId);
    await updateDoc(docRef, { favorite: !currentValue });
    fetchPeople();
  };

  return (

    <main className="p-4 space-y-4 bg-gray-50 min-h-screen">

      {/* Renderiza o menu principal da aplicação. */}
      <MainMenu />
      <h1 className="text-2xl font-bold mb-4">Diretório de Pessoas</h1>

      {/* Renderiza os cards de cada pessoa. */}
      <div className="space-y-3">
        {person.map(p => (
          <PersonCard key={p.id} person={p}
            onEditPerson={openEditPersonModal}
            onToggleFavorite={toggleFavorite}
          />
        ))}

        {/* Modal de adição de nova pessoa. Abre quando isAddPersonModalOpen é verdadeiro. */}
        {isAddPersonModalOpen && (
          <AddPersonModal
            onClose={() => setIsAddPersonModalOpen(false)}
            onAdded={fetchPeople}
            isOpen={isAddPersonModalOpen}
          />
        )}

        {/* Modal de edição de pessoa. Abre quando isEditModalOpen é verdadeiro e uma pessoa está selecionada. */}
        {isEditModalOpen && selectedPerson && (
          <EditPersonModal
            person={selectedPerson}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onUpdated={fetchPeople}
            onDeleted={handlePersonDeleted}
          />
        )}
      </div>

      {/* Botão flutuante para adicionar uma nova pessoa. Ao clicar, abre o modal de adição. */}
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
