'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface EditPersonModalProps {
  person: Person;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const EditPersonModal = ({ person, isOpen, onClose, onUpdated, onDeleted }: EditPersonModalProps) => {
  const [name, setName] = useState(person.name); /** @state {string} name - Nome da pessoa. */
  const [phone, setPhone] = useState(person.phone); /** @state {string} phone - Número de telefone da pessoa. */
  const [email, setEmail] = useState(person.email); /** @state {string} email - Endereço de e-mail da pessoa. */
  const [showMore, setShowMore] = useState(!!person.address); /** @state {boolean} showMore - Controla a visibilidade de campos adicionais. */
  const [useAddressAPI, setUseAddressAPI] = useState(false);  /** @state {boolean} useAddressAPI - Controla se a busca de endereço via CEP está habilitada. */
  const [zipcode, setZipcode] = useState(person.zipcode || ''); /** @state {string} zipcode - Código postal. */
  const [address, setAddress] = useState(person.address || ''); /** @state {string} address - Endereço. */
  const [number, setNumber] = useState(person.number || ''); /** @state {string} number - Número do endereço. */
  const [complement, setComplement] = useState(person.complement || ''); /** @state {string} complement - Complemento do endereço. */
  const [district, setDistrict] = useState(person.district || ''); /** @state {string} district - Bairro. */
  const [city, setCity] = useState(person.city || ''); /** @state {string} city - Cidade. */
  const [state, setState] = useState(person.state || ''); /** @state {string} state - Estado (UF). */
  const [birthday, setBirthday] = useState(person.birthday || ''); /** @state {string} birthday - Data de nascimento. */
  const [note, setNote] = useState(''); /** @state {string} note - Alguma nota sobre a pessoa. */
  const [favorite, setFavorite] = useState(person.favorite || false); /** @state {boolean} favorite - Indica se a pessoa é favorita. */
  const [isDraggable, setIsDraggable] = useState(true); /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */

  if (!isOpen) return null;

  useLayoutEffect(() => {
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
 * @returns {Promise<void>}
 */
  const handleUpdate = async (): Promise<void> => {
    const personRef = doc(db, 'people-directory', person.id);
    await updateDoc(personRef, {
      name, phone, email, favorite,
      ...(showMore && {
        zipcode, address, number, complement, district, city, state, birthday, note
      }),
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
    const personRef = doc(db, 'people-directory', person.id);
    await deleteDoc(personRef);
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
      {/* Topo do Modal de Edição da Pessoa */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onClose} className="color-pd-base text-lg">
            Cancelar
          </button>
          <h3 className="text-lg font-semibold">
            Editar Cadastro
          </h3>
          <button onClick={handleUpdate} className="color-pd-base text-lg">
            Salvar
          </button>
        </div>

        {/* Favorito */}
        <div className="flex justify-between items-center mb-4">
          <span>Favorito</span>
          <button
            type="button"
            onClick={() => setFavorite(!favorite)}
            className={clsx(
              'w-12 h-6 rounded-full transition flex items-center p-1',
              favorite ? 'color-pd-base-bg' : 'bg-gray-300'
            )}
          >
            <div
              className={clsx(
                'bg-white w-4 h-4 rounded-full shadow transform transition',
                favorite ? 'translate-x-6' : 'translate-x-0'
              )}
            />
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
            type="text"
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

            {/* Data de Nascimento */}
            <div className="relative">
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

        {/* Excluir Pessoa */}
        <div className="flex justify-end mt-6">
          <button onClick={handleDelete} className="text-red-500">
            Excluir Cadastro
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditPersonModal;
