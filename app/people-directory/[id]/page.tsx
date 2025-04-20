'use client'

import { useState, useEffect, JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, getDocs, query, where, collection } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { Event, Person } from '@/app/utils/interfaces';
import MainMenu from '@/app/components/MainMenu';
import AddEventModal from '@/app/components/AddEventModal'; // certifique-se do caminho correto
import { tr } from 'date-fns/locale';

/**
 * @component
 * @description Componente para exibir os detalhes de uma pessoa específica e a lista de eventos associados a ela. Permite adicionar novos eventos para essa pessoa.
 * @returns {JSX.Element} A interface de detalhes da pessoa.
 */
const PersonDetails = (): JSX.Element => {
  const { id } = useParams(); /** @const {string | undefined} id - O ID da pessoa obtido dos parâmetros da URL. */
  const router = useRouter(); /** @const {object} router - O objeto de roteamento do Next.js. */
  const [person, setPerson] = useState<Person | null>(null); /** @state {Person | null} person - Os detalhes da pessoa buscada do Firestore. Inicialmente null. */
  const [events, setEvents] = useState<Event[]>([]); /** @state {Event[]} events - A lista de eventos associados à pessoa, buscados do Firestore. Inicialmente um array vazio. */
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false); /** @state {boolean} isAddEventModalOpen - Controla a visibilidade do modal para adicionar um novo evento para esta pessoa. */

  useEffect(() => {
    /**
   * @async
   * @function fetchPerson
   * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
   * @returns {Promise<void>}
   */
    const fetchPerson = async (): Promise<void> => {
      try {
        const docRef = doc(db, 'people-directory', id as string);
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
      const q = query(collection(db, 'events-history'), where('personId', '==', id));
      const querySnapshot = await getDocs(q);
      const eventData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Event[];
      setEvents(eventData);
    };

    fetchPerson();
    fetchEvents();
  }, [id]);

  if (!person) return <p className="p-6">Carregando dados...</p>;

  return (

    <div className="p-6 space-y-6">

      {/* Renderiza o menu principal da aplicação. */}
      <MainMenu />
      <h1 className="text-2xl font-semibold">Detalhes da Pessoa</h1>

      {/* Dados principais */}
      <div className="bg-white p-4 rounded-lg shadow space-y-2">
        <p><strong>Nome:</strong> {person.name}</p>
        <p><strong>Telefone:</strong> {person.phone}</p>
        <p><strong>Email:</strong> {person.email}</p>

        {/* Endereço */}
        {person.zipcode && <p><strong>CEP:</strong> {person.zipcode}</p>}
        {person.address && <p><strong>Endereço:</strong> {person.address}</p>}
        {person.number && <p><strong>Número:</strong> {person.number}</p>}
        {person.complement && <p><strong>Complemento:</strong> {person.complement}</p>}
        {person.district && <p><strong>Bairro:</strong> {person.district}</p>}
        {person.city && <p><strong>Cidade:</strong> {person.city}</p>}
        {person.state && <p><strong>Estado:</strong> {person.state}</p>}

        {/* Outras informações */}
        {person.birthday && <p><strong>Aniversário:</strong> {person.birthday}</p>}
        {person.note && <p><strong>Notas:</strong> {person.note}</p>}
      </div>

      {/* Eventos relacionados */}
      {events.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow space-y-3">
          <h2 className="font-semibold mb-2">Eventos Associados</h2>
          {events.map(e => (
            <div key={e.id} className="border p-3 rounded-lg">
              <p className="font-medium">{e.title}</p>
              <p className="text-sm text-gray-500">{e.date} {e.hour && `• ${e.hour}`}</p>
              {e.description && <p className="text-sm mt-1">{e.description}</p>}
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
              const q = query(collection(db, 'events-history'), where('personId', '==', id));
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
        />
      )}
    </div>
  );
};

export default PersonDetails;
