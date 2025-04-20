'use client';

import { useState, useEffect, useLayoutEffect, useRef, JSX } from 'react';
import { doc, getDocs, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Event, Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
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
const EditEventModal = ({ event, isOpen, onClose, onUpdated }: EditEventModalProps): JSX.Element | null => {

  const [title, setTitle] = useState(event.title); /** @state {string} title - Título do evento. */
  const [date, setDate] = useState(event.date); /** @state {string} date - Data do evento no formato 'YYYY-MM-DD'. */
  const [hour, setHour] = useState(event.hour); /** @state {string} hour - Hora do evento no formato 'HH:MM'. Vazio se `allDay` for true. */
  const [allDay, setAllDay] = useState(!event.hour); /** @state {boolean} allDay - Indica se o evento é de dia inteiro (sem hora específica). */
  const [useAddressAPI, setUseAddressAPI] = useState(false);   /** @state {boolean} useAddressAPI - Controla se a busca de endereço via CEP está habilitada. */
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
  const [isDraggable, setIsDraggable] = useState(true);  /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */

  if (!isOpen) return null;

  useLayoutEffect(() => {
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
  }, [isOpen, useAddressAPI]);

  useEffect(() => {
    /**
     * @async
     * @function fetchPeople
     * @description Busca os dados de todas as pessoas da coleção 'people-directory' no Firestore.
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
        // Atualiza o estado 'person' com os dados das pessoas buscadas.
        setPerson(personData);
      } catch (error) {
        console.error('Erro ao buscar pessoas:', error);
        //todo: Lide com o erro de forma apropriada (ex: exibir uma mensagem ao usuário)
      }
    };

    {/* Ações ao abrir ou fechar o modal */ }
    if (isOpen) {

      document.body.classList.add('overflow-hidden'); // Previne scroll da tela de fundo

      fetchPeople(); // Chama a função para buscar os dados das pessoas.

      {/* Associação de pessoa ao Evento */ }
      if (event.personId) {
        setAssociatePerson(true); // Se 'personId' existir, indica que um contato deve ser associado ao evento.
        setSelectedPersonId(event.personId); // Define o ID da pessoa selecionada com o valor de 'event.personId'.
      } else {
        setAssociatePerson(false); // Se 'personId' não existir, indica que nenhum contato deve ser associado.
        setSelectedPersonId(''); // Limpa o ID da pessoa selecionada.
      }

    } else {
      // Se 'isOpen' for falso (modal fechado), remove a classe 'overflow-hidden' do body
      // para permitir o scroll novamente na tela de fundo.
      document.body.classList.remove('overflow-hidden'); // Libera scroll da tela de fundo
    }

    /**
     * @function cleanup
     * @description Função de limpeza executada quando o componente é desmontado ou as dependências mudam. Remove a classe 'overflow-hidden' do body.
     * @returns {void}
     */
    return (): void => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  /**
   * @async
   * @function searchAddress
   * @description Busca informações de endereço a partir de um CEP usando a API ViaCEP.
   * @param {string} zipCode - O código postal a ser pesquisado.
   * @returns {Promise<void>}
   */
  const searchAddress = async (zipCode: string): Promise<void> => {
    if (zipCode.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setAddress(data.logradouro);
          setDistrict(data.bairro);
          setCity(data.localidade);
          setState(data.uf);
        } else {
          alert('CEP não encontrado.');
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  /**
   * @async
   * @function handleUpdate
   * @description Salva as alterações do formulário no Firestore.
   * @param {React.FormEvent} e - Objeto do evento de formulário.
   * @returns {Promise<void>}
   */
  const handleUpdate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await updateDoc(doc(db, 'events-history', event.id), {
      title,
      date,
      hour: allDay ? '' : hour,
      zipcode,
      address,
      number,
      district,
      city,
      state,
      description,
      ...(associatePerson && selectedPersonId && { personId: selectedPersonId }),
    });
    onUpdated();
    onClose();
  };

  /**
   * @async
   * @function handleDelete
   * @description Exclui o documento atual do Firestore.
   * @returns {Promise<void>}
   */
  const handleDelete = async (): Promise<void> => {
    const eventRef = doc(db, 'events-history', event.id);
    await deleteDoc(eventRef);
    onUpdated();
    onClose();
  };

  return (
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
      {/* Topo do Modal de Edição de Evento */}
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="text-blue-500 text-lg">
            Cancelar
          </button>
          <h3 className="text-lg font-semibold">
            Editar Evento
          </h3>
          <button onClick={handleUpdate} className="text-blue-500 text-lg">
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

        {/* All-day + Data e Hora */}
        <div className="border-gray-200 pt-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span>Dia inteiro</span>
            <button
              type="button"
              onClick={() => {
                setAllDay(!allDay);
                if (!allDay) setHour('');
                else setHour('12:00');
              }}
              className={clsx(
                'w-12 h-6 rounded-full transition flex items-center p-1',
                allDay ? 'bg-blue-500' : 'bg-gray-300'
              )}
            >
              <div
                className={clsx(
                  'bg-white w-4 h-4 rounded-full shadow transform transition',
                  allDay ? 'translate-x-6' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          <div className="flex space-x-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input bg-gray-50 rounded-lg border flex-1"
            />
            {/* Incluir Hora */}
            {!allDay && (
              <input
                type="time"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                className="form-input bg-gray-50 rounded-lg border w-28"
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
                onBlur={() => searchAddress(zipcode)}
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
                associatePerson ? 'bg-blue-500' : 'bg-gray-300'
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

        {/* Excluir Evento */}
        <div className="flex justify-end mt-6">
          <button onClick={handleDelete} className="text-red-500">
            Excluir Evento
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditEventModal;