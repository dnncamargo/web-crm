'use client'

import { useState, useEffect, JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, getDocs, query, where, collection, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { useAuth } from '@/app/components/AuthProvider';
import { Event, Person } from '@/app/utils/interfaces';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import MainMenu from '@/app/components/MainMenu';
import AddEventModal from '@/app/components/AddEventModal'; // certifique-se do caminho correto

/**
 * @component
 * @description Componente para exibir os detalhes de uma pessoa específica e a lista de eventos associados a ela. Permite adicionar novos eventos para essa pessoa.
 * @returns {JSX.Element} A interface de detalhes da pessoa.
 */
const PersonDetails = (): JSX.Element => {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const { id } = useParams();  /** @const {string} id - O ID do evento a ser exibido, extraído da URL. */
  const router = useRouter(); /** @const {object} router - O objeto de roteamento do Next.js. */
  const [person, setPerson] = useState<Person | null>(null); /** @state {Person | null} person - Os detalhes da pessoa buscada do Firestore. Inicialmente null. */
  const [events, setEvents] = useState<Event[]>([]); /** @state {Event[]} events - A lista de eventos associados à pessoa, buscados do Firestore. Inicialmente um array vazio. */
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false); /** @state {boolean} isAddEventModalOpen - Controla a visibilidade do modal para adicionar um novo evento para esta pessoa. */
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    if (uid && id) {
      fetchPerson();
      fetchEvents();
      fetchCategories();
    }
  }, [uid, id]);

  /**
   * @async
   * @function fetchPerson
   * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
   * @returns {Promise<void>}
   */
  const fetchPerson = async (): Promise<void> => {
    try {
      const docRef = doc(db, `users/${uid}/people-directory/${id}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPerson({ id: docSnap.id, ...docSnap.data() } as Person);
      }
    }
    catch (error) {
      console.error('Erro ao buscar pessoa:', error);
    }
  };

  const fetchEvents = async () => {
    const q = query(collection(db, `users/${uid}/events-history`), where('personId', '==', `${id}`));
    const querySnapshot = await getDocs(q);
    const eventData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Event[];
    setEvents(eventData);
  };

  const fetchCategories = async () => {
    const EventsSettingRef = doc(db, `users/${uid}/settings`, 'userCategories');
    const docSnap = await getDoc(EventsSettingRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      setAvailableCategories(data.category ?? []);
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

  if (!person) return <div className="animate-pulse text-gray-500 m-6">Carregando as informações da Pessoa...</div>;

  return (

    <ProtectedRoute>

      <div className="p-6 space-y-6">

        {/* Renderiza o menu principal da aplicação. */}
        <MainMenu />
        <h1 className="text-2xl font-semibold">Detalhes da Pessoa</h1>

        {/* Dados principais */}
        <div className="bg-white p-4 rounded-lg shadow space-y-2">
          <p><strong>Nome:</strong> {person.name}</p>
          {person.phone && <p><strong>Telefone:</strong> {person.phone}</p>}
          {person.email && <p><strong>Email:</strong> {person.email}</p>}

          {/* Outras informações */}
          {person.birthday && <p><strong>Aniversário:</strong> {person.birthday}</p>}
          {person.note && <p><strong>Notas:</strong> {person.note}</p>}
          {person.relationship && <p><strong>Relacionamento:</strong> {person.relationship}</p>}
        </div>

        {/* Campos Opcionais */}
        {Array.isArray(person.optionalFields) && person.optionalFields.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow space-y-4">
            <h2 className="font-semibold text-lg mb-2">Informações adicionais</h2>
            {person.optionalFields.map((field: any) => (
              <div key={field.id}>
                <p className="font-semibold">{field.label}</p>

                {field.type === 'note' && (
                  <p className="text-gray-700 whitespace-pre-wrap">{field.value}</p>
                )}

                {field.type === 'url' && (
                  <a href={field.value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {field.value}
                  </a>
                )}

                {field.type === 'phone' && (
                  <p className="text-gray-700">{field.value}</p>
                )}

                {field.type === 'email' && (
                  <a href={`mailto:${field.value}`} className="text-blue-600 underline">
                    {field.value}
                  </a>
                )}

                {field.type === 'address' && typeof field.value === 'object' && (
                  <div className="text-gray-700 text-sm space-y-1">
                    {field.value.location && <p><strong>Localidade:</strong> {field.value.location}</p>}
                    {field.value.zipcode && <p><strong>CEP:</strong> {field.value.zipcode}</p>}
                    {field.value.address && <p><strong>Endereço:</strong> {field.value.address}</p>}
                    {field.value.number && <p><strong>Número:</strong> {field.value.number}</p>}
                    {field.value.district && <p><strong>Bairro:</strong> {field.value.district}</p>}
                    {field.value.city && <p><strong>Cidade:</strong> {field.value.city}</p>}
                    {field.value.state && <p><strong>Estado:</strong> {field.value.state}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


        {/* Frequência de Contato */}
        <div className="bg-white p-4 rounded-lg shadow space-y-2">
          <span className="font-semibold mb-2">Frequência de Contato: </span>
          {person.contactFrequency ? (
            <span>
              {
                {
                  weekly: 'Semanal',
                  biweekly: 'Quinzenal',
                  monthly: 'Mensal',
                  quarterly: 'Trimestral',
                }[person.contactFrequency]
              }
            </span>) : (
            <span className="text-gray-500">Nenhuma frequência definida.</span>
          )}
        </div>

        {/* Eventos relacionados */}
        {events.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow space-y-3">
            <h2 className="font-semibold mb-2">Eventos Associados</h2>
            {events.map(e => (
              <div key={e.id} className="border p-3 rounded-lg">
                <p className="font-medium">{e.title}</p>
                <p className="text-sm text-gray-500">{e.startDate} {e.startTime && `• ${e.startTime}`}</p>
                {e.title && <p className="text-sm mt-1">{e.title}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Botão Adicionar Evento */}
        <button
          onClick={() => setIsAddEventModalOpen(true)}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 rounded transition"
        >
          Adicionar Evento
        </button>

        {/* Botão Voltar */}
        <button onClick={() => router.back()} className="w-full items-center rounded-md border py-2  border-gray-300 bg-white">
          Voltar
        </button>

        {/* Modal de Novo Evento */}
        {isAddEventModalOpen && person && (
          <AddEventModal
            isOpen={isAddEventModalOpen}
            onClose={() => setIsAddEventModalOpen(false)}
            onAdded={() => {
              setIsAddEventModalOpen(false);
              // Refaz a lista de eventos depois de adicionar
              const fetchEvents = async () => {
                const q = query(collection(db, `users/${uid}/events-history`), where('personId', '==', id));
                const querySnapshot = await getDocs(q);
                const eventData = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Event[];
                setEvents(eventData);
              };
              fetchEvents();
            }}
            initialPersonId={person.id}
            availableCategories={availableCategories}
            setAvailableCategories={setAvailableCategories}
            onAddCategory={handleAddCategory}
          />
        )}
      </div>
    </ProtectedRoute>

  );
};

export default PersonDetails;
