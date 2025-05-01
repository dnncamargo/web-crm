'use client';

import { useState, useEffect, useLayoutEffect, useRef, JSX } from 'react';
import { doc, getDocs, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { searchAddress } from '../utils/helpers';
import { Event, Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
import ProtectedRoute from './ProtectedRoute';
import clsx from 'clsx';

/**
 * @interface EditEventModalProps
 * @description Props para o componente `EditEventModal`.
 * @property {Event} event - O objeto do evento a ser editado.
 * @property {boolean} isOpen - Controla a visibilidade do modal.
 * @property {() => void} onClose - Função para fechar o modal.
 * @property {() => void} onUpdated - Função chamada após a atualização ou exclusão do evento.
 */
interface EditEventModalProps {
  event: Event;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

/**
 * @component
 * @description Modal para editar os detalhes de um evento existente. Permite modificar título, data, hora, endereço, notas e associar a uma pessoa. Também oferece a opção de excluir o evento.
 * @param {EditEventModalProps} props - As propriedades passadas para o componente.
 * @returns {JSX.Element | null} O componente renderizado ou null se `isOpen` for falso.
 */
const EditEventModal = ({ event, isOpen, onClose, onUpdated }: EditEventModalProps) => {
  const { user } = useAuth(); /** @const {User | null} user - O usuário autenticado. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */

  const defaultTime = new Date().toTimeString().slice(0, 5); // "14:00"

  const [title, setTitle] = useState(event.title); /** @state {string} title - Título do evento. */
  const [startDate, setStartDate] = useState(event.startDate); /** @state {string} startDate - Data de início do evento no formato 'YYYY-MM-DD'. */
  const [endDate, setEndDate] = useState(event.endDate); /** @state {string} endDate - Data de término do evento no formato 'YYYY-MM-DD'. */
  const [startTime, setStartTime] = useState(event.startTime || defaultTime); /** @state {string} startTime - Hora de início do evento no formato 'HH:MM'. */
  const [endTime, setEndTime] = useState(event.endTime || defaultTime); /** @state {string} endTime - Hora de término do evento no formato 'HH:MM'. */
  const [allDay, setAllDay] = useState(event.allDay); /** @state {boolean} allDay - Indica se o evento é de dia inteiro (sem hora específica). */  const [useAddressAPI, setUseAddressAPI] = useState(false);   /** @state {boolean} useAddressAPI - Controla se a busca de endereço via CEP está habilitada. */
  const [zipcode, setZipcode] = useState(event.zipcode || '');   /** @state {string} zipcode - Código postal do local do evento. */
  const [address, setAddress] = useState(event.address || '');   /** @state {string} address - Endereço do local do evento. */
  const [number, setNumber] = useState(event.number || '');  /** @state {string} number - Número do local do evento. */
  const [district, setDistrict] = useState(event.district || '');  /** @state {string} district - Bairro do local do evento. */
  const [city, setCity] = useState(event.city || '');  /** @state {string} city - Cidade do local do evento. */
  const [state, setState] = useState(event.state || '');  /** @state {string} state - Estado (UF) do local do evento. */
  const [description, setDescription] = useState(event.description || '');  /** @state {string} description - Notas ou descrição adicional do evento. */
  const [associatePerson, setAssociatePerson] = useState(false);  /** @state {boolean} associatePerson - Controla a seção de associação de uma pessoa ao evento. */
  const [selectedPersonId, setSelectedPersonId] = useState('');  /** @state {string} selectedPersonId - ID da pessoa selecionada para associar ao evento. */
  const [person, setPerson] = useState<Person[]>([]);  /** @state {Person[]} person - Array de pessoas buscadas do Firestore para a opção de associação. */
  const [error, setError] = useState('');
  const [isDraggable, setIsDraggable] = useState(true);  /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */

  // Proteção: Se não for open ou sem usuário, nem carrega.
  if (!isOpen || !user) return null;

  useLayoutEffect(() => {
    adjustModalDraggable(); // Ajusta a propriedade de arrastar do modal com base na altura do conteúdo.
  }, [isOpen, useAddressAPI]);

  useEffect(() => {
    {/* Ações ao abrir ou fechar o modal */ }
    if (isOpen) {

      document.body.classList.add('overflow-hidden'); // Previne scroll da tela de fundo

      fetchPeople(); // Chama a função para buscar os dados das pessoas.

      handleAssociatePerson(); // Chama a função para lidar com a associação de pessoas ao evento.

    } else {
      // Se 'isOpen' for falso (modal fechado), remove a classe 'overflow-hidden' do body
      // para permitir o scroll novamente na tela de fundo.
      document.body.classList.remove('overflow-hidden'); // Libera scroll da tela de fundo
    }

    dateControl(); // Chama a função de controle de data para garantir que as datas estejam corretas.

    /**
     * @function cleanup
     * @description Função de limpeza executada quando o componente é desmontado ou as dependências mudam. Remove a classe 'overflow-hidden' do body.
     * @returns {void}
     */
    return (): void => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen, startDate, startTime, endDate, endTime, allDay]);

  /**
   * @async
   * @function fetchPeople
   * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
   * @returns {Promise<void>}
   */
  const fetchPeople = async (): Promise<void> => {
    try {
      // Obtém todos os documentos da coleção 'people-directory' no banco de dados 'db'.
      const querySnapshot = await getDocs(collection(db, `users/${user.uid}/people-directory`));
      // Mapeia os documentos para um array de objetos 'Person', incluindo o ID do documento.
      const personData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Person[];
      // Atualiza o estado 'person' com os dados das pessoas buscadas.
      setPerson(personData);
    } catch (error) {
      console.error('Erro ao buscar pessoas:', error);
      //todo: Lide com o erro de forma apropriada (ex: exibir uma mensagem ao usuário)
    }
  };

  function dateControl() {
    // Só faz a checagem se não for all-day (ou seja, está lidando com horário)
    if (allDay) {
      // All-day: endDate sempre ≥ startDate
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        setEndDate(startDate);
      }
      setStartTime('');
      setEndTime('');
      setError('');
      return;
    }

    // Horário: monta as datas completas
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);

    if (start >= end) {
      // Se end está inválido, define end para +30min após start
      const newEnd = new Date(start.getTime() + 30 * 60000);
      setEndDate(newEnd.toISOString().split('T')[0]);
      setEndTime(newEnd.toTimeString().slice(0, 5));
      setError('');
    } else {
      setError('');
    }
  }

  /**
  * @function validateEvent
  * @description Valida os campos obrigarórios do formulário.
  * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
  */
  function validateEvent(): string | null {
    if (!title.trim()) return 'O título do evento é obrigatório';
    if (!startDate || !endDate) return 'Informe as datas de início e término';

    if (!allDay) {
      if (!startTime || !endTime) return 'Informe os horários de início e término';

      const start = new Date(`${startDate}T${startTime}`);
      const end = new Date(`${endDate}T${endTime}`);
      if (start >= end) return 'O horário de término deve ser após o horário de início';
    }
    return null;
  }

  /**
   * @async
   * @function handleSearchAddress
   * @description Busca o endereço a partir do CEP informado.
   * @param {string} zipCode - O código postal a ser pesquisado.
   * @returns {Promise<void>}
   */
  const handleSearchAddress = async (zipCode: string): Promise<void> => {
    const data = await searchAddress(zipCode);
    if (data) {
      setAddress(data?.address || ''); // Garante que o estado seja atualizado mesmo se a propriedade for undefined
      setDistrict(data?.district || '');
      setCity(data?.city || '');
      setState(data?.state || '');
    }
  };

  function formatEvent(): any {
    const base = {
      title: title.trim(),
      allDay,
      startDate,
      endDate,
      startTime,
      endTime,
      zipcode,
      address,
      number,
      district,
      city,
      state,
      location: [address, number, city, state].filter(Boolean).join(', ') || "",
      description: description?.trim() || '',
      createdAt: new Date(),
    }

    if (associatePerson && selectedPersonId) {
      (base as any).personId = selectedPersonId
    }

    if (allDay) {
      return {
        ...base,
        start: { date: startDate },
        end: { date: getNextDay(endDate) }, // precisa somar um dia inteiro para eventos allDay
      }
    } else {
      return {
        ...base,
        start: {
          dateTime: `${startDate}T${startTime.padEnd(5, '0')}`,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: `${endDate}T${endTime.padEnd(5, '0')}`,
          timeZone: 'America/Sao_Paulo',
        },
      }
    }
  }

  function getNextDay(dateStr: string): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  }

  /**
   * @async
   * @function handleUpdate
   * @description Salva as alterações do formulário no Firestore.
   * @param {React.FormEvent} e - Objeto do evento de formulário.
   * @returns {Promise<void>}
   */
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const errorMsg = validateEvent();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }

    try {
      const eventRef: any = formatEvent(); // Formata os dados do evento para o Firestore
      await updateDoc(doc(db, `users/${user.uid}/events-history/${event.id}`), eventRef);
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar o evento: ', error);
    };
  };

  /**
   * @async
   * @function handleDelete
   * @description Exclui o documento atual do Firestore.
   * @returns {Promise<void>}
   */
  const handleDelete = async (): Promise<void> => {
    try {
      const eventRef = doc(db, 'users', user.uid, 'events-history', event.id);
      await deleteDoc(eventRef);
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Erro ao excluir o evento: ', error);
    }
  };

  function adjustModalDraggable() {
    {/* Conflito drag vs. scroll vertical */ }
    const modal = document.getElementById('edit-event-modal');
    // Verifica se o modal é maior que a altura da tela e ajusta a propriedade 'isDraggable' do modal.
    if (modal && modal.scrollHeight > window.innerHeight) {
      // Se o conteúdo do modal for maior que a tela, desabilita a funcionalidade de arrastar (draggable).
      setIsDraggable(false);
    } else {
      // Caso contrário, habilita a funcionalidade de arrastar.
      setIsDraggable(true);
    }
  }

  function handleAssociatePerson() {
    {/* Associação de pessoa ao Evento */ }
    if (event.personId) {
      setAssociatePerson(true); // Se 'personId' existir, indica que um contato deve ser associado ao evento.
      setSelectedPersonId(event.personId); // Define o ID da pessoa selecionada com o valor de 'event.personId'.
    } else {
      setAssociatePerson(false); // Se 'personId' não existir, indica que nenhum contato deve ser associado.
      setSelectedPersonId(''); // Limpa o ID da pessoa selecionada.
    }
  }

  return (

    <ProtectedRoute>

      <motion.div
        // Framer-Motion
        id="edit-event-modal"
        ref={modalRef}
        className="fixed inset-0 bg-white overflow-y-auto h-full w-full z-50"
        //drag={isDraggable ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(event, info) => {
          if (info.point.y > 400) onClose();
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Formulário */}
        <form onSubmit={handleUpdate}>
          <div className="p-4 space-y-4 mb-4">
            {/* Topo do Modal de Edição de Evento */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={onClose} className="color-eh-base text-lg">
                Cancelar
              </button>
              <h3 className="text-lg font-semibold">
                Editar Evento
              </h3>
              <button
                type='submit'
                disabled={!!error}
                className="color-eh-base text-lg hover:bg-blue-700 disabled:opacity-50">
                Salvar
              </button>
            </div>
            {/* Título e Local */}
            {!useAddressAPI && (
              <>
                <div className="bg-gray-50 rounded-lg overflow-hidden border">
                  <input
                    type="text"
                    placeholder="Título"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Local ou chamada de vídeo"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-4 bg-transparent focus:outline-none"
                  />
                </div>
              </>
            )}
            {/* Título com API de Endereço */}
            {useAddressAPI && (
              <>
                <div className="bg-gray-50 rounded-lg overflow-hidden border">
                  <input
                    type="text"
                    placeholder="Título"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-4 bg-transparent focus:outline-none resize-none"
                  />
                </div>
              </>
            )}

            {/* All-day e Data */}
            <div className="mt-6 p-2 bg-gray-50 rounded-lg overflow-hidden border">
              {/* Switch All-day */}
              <div className="flex justify-between items-center">
                <span>Dia inteiro</span>
                <button
                  type="button"
                  onClick={() => setAllDay(!allDay)}
                  className={`w-12 h-6 rounded-full transition flex items-center p-1 ${allDay ? 'bg-blue-500' : 'bg-gray-300'}`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow transform transition ${allDay ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Data e Hora */}
              <div className="flex items-center mt-2 gap-2">
                {/* Data de Início */}
                <span className="w-20">Início</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                  }}
                  className="flex-1 p-2 border rounded"
                />
                {/* Hora de Início */}
                {!allDay && (
                  <input
                    type="time"
                    step="300" // 5 minutos
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                    }}
                    className="w-24 p-2 border rounded"
                  />
                )}
              </div>
              {/* Data de Término */}
              <div className="flex items-center mt-2 mb-2 gap-2">
                <span className="w-20">Término</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                  }}
                  className={`flex-1 p-2 border rounded ${error && 'border-red-500'}`}
                />
                {/* Hora de Término */}
                {!allDay && (
                  <input
                    type="time"
                    step="300"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                    }}
                    className={`w-24 p-2 border rounded ${error && 'border-red-500'}`}
                  />
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className="border-gray-200 pt-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <input type="checkbox"
                  checked={useAddressAPI}
                  onChange={() => setUseAddressAPI(!useAddressAPI)} />
                <span>Usar CEP</span>
              </div>
              {/* Usar API de Endereço */}
              {useAddressAPI && (
                <div className="bg-gray-50 rounded-lg overflow-hidden border">
                  <input
                    type="text"
                    placeholder="CEP"
                    value={zipcode}
                    onChange={(e) => setZipcode(e.target.value)}
                    onBlur={() => handleSearchAddress(zipcode)}
                    className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Endereço"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Número"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Bairro"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-4 bg-transparent focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Descrição */}
            <div className="bg-gray-50 rounded-lg overflow-hidden border">
              <textarea
                placeholder="Notas"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-4 bg-transparent focus:outline-none resize-none"
                rows={4}
              />
            </div>

            {/* Associar Pessoa */}
            <div className="border-gray-200 pt-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span>Associar a uma pessoa</span>
                <button
                  type="button"
                  onClick={() => {
                    setAssociatePerson(!associatePerson);
                    if (!associatePerson) setSelectedPersonId('');
                  }}
                  className={clsx(
                    'w-12 h-6 rounded-full transition flex items-center p-1',
                    associatePerson ? 'color-eh-base-bg' : 'bg-gray-300'
                  )}
                >
                  <div
                    className={clsx(
                      'bg-white w-4 h-4 rounded-full shadow transform transition',
                      associatePerson ? 'translate-x-6' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
              {/* Selecionar e Salvar Pessoa */}
              {associatePerson && (
                <div className="mt-2">
                  <select
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none"
                  >
                    <option value="">Selecione a pessoa</option>
                    {person.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}

            {/* Excluir Evento */}
            <div className="flex justify-end mt-6">
              <button onClick={handleDelete} className="text-red-500">
                Excluir Evento
              </button>
            </div>
          </div>
        </form>

      </motion.div>

    </ProtectedRoute>

  );
};

export default EditEventModal;