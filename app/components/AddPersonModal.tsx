'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { searchAddress } from '../utils/helpers';
import { motion } from 'framer-motion';
import ProtectedRoute from './ProtectedRoute';
import clsx from 'clsx';

/**
 * @interface AddPersonModalProps
 * @description Props para o componente `AddPersonModal`.
 * @property {boolean} isOpen - Controla a visibilidade do modal.
 * @property {() => void} onClose - Função para fechar o modal.
 * @property {() => void} onAdded - Função chamada após uma nova pessoa ser adicionada com sucesso.
 */
interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

/**
 * @component AddPersonModal
 * @description Modal para adicionar uma nova pessoa ao diretório. Permite inserir informações básicas de contato e detalhes adicionais como endereço, data de nascimento e notas. Utiliza a API ViaCEP para buscar endereços a partir do CEP.
 * @param {AddPersonModalProps} props - As propriedades do componente.
 * @returns {JSX.Element | null} O componente modal, ou `null` se `isOpen` for `false`.
 */
const AddPersonModal: React.FC<AddPersonModalProps> = ({ isOpen, onClose, onAdded }) => {
  const { user } = useAuth(); /** @const {User | null} user - O usuário autenticado. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */
  const [name, setName] = useState(''); /** @state {string} name - Nome da pessoa. */
  const [phone, setPhone] = useState('') /** @state {array of strings} phone - Números de telefone da pessoa. */
  const [email, setEmail] = useState('');  /** @state {string} email - Endereço de e-mail da pessoa. */
  const [showMore, setShowMore] = useState(false);  /** @state {boolean} showMore - Controla a visibilidade de campos adicionais. */
  const [zipcode, setZipcode] = useState('');  /** @state {string} zipcode - Código postal. */
  const [useAddressAPI, setUseAddressAPI] = useState(false);  /** @state {boolean} useAddressAPI - Controla se a busca de endereço via CEP está habilitada. */
  const [address, setAddress] = useState('');  /** @state {string} address - Endereço. */
  const [number, setNumber] = useState('');  /** @state {string} number - Número do endereço. */
  const [complement, setComplement] = useState('');  /** @state {string} complement - Complemento do endereço. */
  const [district, setDistrict] = useState('');  /** @state {string} district - Bairro. */
  const [city, setCity] = useState('');  /** @state {string} city - Cidade. */
  const [state, setState] = useState('');  /** @state {string} state - Estado (UF). */
  const [birthday, setBirthday] = useState('');  /** @state {string} birthday - Data de nascimento. */
  const [note, setNote] = useState('');  /** @state {string} note - Alguma nota sobre a pessoa. */
  const [isDraggable, setIsDraggable] = useState(true); /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */

  // Proteção: Se não for open ou sem usuário, nem carrega.
  if (!isOpen || !user) return null;

  useLayoutEffect(() => {
    adjustModalDraggable(); // Ajusta a propriedade de arrastar do modal com base na altura do conteúdo.
  }, [isOpen, useAddressAPI]);

  useEffect(() => {

    {/* Ações ao abrir ou fechar o modal */ }
    if (isOpen) {

      document.body.classList.add('overflow-hidden'); // Previne scroll da tela de fundo

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
   * @function validatePerson
   * @description Valida os campos obrigarórios do formulário.
   * @returns {string | null} Uma string contendo a mensagem de erro se a validação falhar, ou `null` se a validação for bem-sucedida.
   */
  function validatePerson(): string | null {
    if (name.length === 0) return "Nome da Pessoa é obrigatório.";
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

  /**
  * @async
  * @function handleSubmit
  * @description Salva as informações do formulário no Firestore.
  * @param {React.FormEvent} e - Objeto do evento de formulário.
  * @returns {Promise<void>}
  */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const errorMsg = validatePerson();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }

    try {
      await addDoc(collection(db, `users/${user.uid}/people-directory`), {
        name,
        phone,
        email,
        ...(showMore && {
          zipcode,
          address,
          number,
          complement,
          district,
          city,
          state,
          birthday,
          note,
        }),
        createdAt: new Date().toISOString(),
      });
      onAdded();
      onClose();
    } catch (error) {
      console.error('Erro ao adicionar pessoa: ', error);
    }
  };

  function adjustModalDraggable() {
    {/* Conflito drag vs. scroll vertical */ }
    const modal = document.getElementById('add-person-modal');
    // Verifica se o modal é maior que a altura da tela e ajusta a propriedade 'isDraggable' do modal.
    if (modal && modal.scrollHeight > window.innerHeight) {
      // Se o conteúdo do modal for maior que a tela, desabilita a funcionalidade de arrastar (draggable).
      setIsDraggable(false);
    } else {
      // Caso contrário, habilita a funcionalidade de arrastar.
      setIsDraggable(true);
    }
  }

  return (

    <ProtectedRoute>
      <motion.div
        // Framer-Motion
        id="add-person-modal"
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
        <form onSubmit={handleSubmit}>
          <div className="p-4">
            {/* Topo do Modal de Inclusão de Pessoa */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={onClose}
                className="color-pd-base text-lg">
                Cancelar
              </button>
              <h3 className="text-lg font-semibold">
                Novo Cadastro
              </h3>
              <button type="submit"
                className="color-pd-base text-lg">
                Salvar
              </button>
            </div>

            {/* Informações de Contato */}
            <div className="bg-gray-50 rounded-lg overflow-hidden border">
              <input
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
              <input
                type="number"
                placeholder="Telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-4 bg-transparent focus:outline-none" />
            </div>

            {/* Switch Mostrar Mais */}
            <div className="flex justify-between items-center py-4 border-gray-200">
              <span>Mostrar mais campos</span>
              <button
                type="button"
                onClick={() => setShowMore(!showMore)}
                className={clsx('w-12 h-6 rounded-full transition flex items-center p-1',
                  showMore ? 'color-pd-base-bg' : 'bg-gray-300')}
              >
                <div className={clsx('bg-white w-4 h-4 rounded-full shadow transform transition', showMore ? 'translate-x-6' : 'translate-x-0')} />
              </button>
            </div>
            {/* Switch habilitado */}
            {showMore && (
              <>
                {/* Checkbox Para Usar API de Endereço */}
                <div className="border-gray-200 pt-4 mb-6">
                  <div className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={useAddressAPI}
                      className="accent-green-600 focus:ring-2 focus:ring-green-500"
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

                {/* Data de Nascimento */}
                <div className="relative mb-2">
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full p-3 pr-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <svg
                    className="absolute right-3 top-1/2 w-5 h-5 text-gray-400 pointer-events-none -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3M16 7V3M4 11h16M4 19h16M4 15h16"
                    />
                  </svg>
                </div>

                {/* Notas */}
                <div className="bg-gray-50 rounded-lg overflow-hidden border">
                  <textarea
                    placeholder="Notas"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-4 bg-transparent focus:outline-none resize-none"
                    rows={4}
                  />
                </div>
              </>
            )}
          </div>
        </form>

      </motion.div >

    </ProtectedRoute>
  );
};

export default AddPersonModal;
