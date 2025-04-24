'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { searchAddress } from '../utils/helpers';
import { Person } from '../utils/interfaces';
import { motion } from 'framer-motion';
import ProtectedRoute from './ProtectedRoute';
import clsx from 'clsx';

/**
 * @interface EditPersonModalProps
 * @description Props para o componente `EditPersonModal`. Este modal permite editar as informações de uma pessoa existente.
 * @property {Person} person - O objeto `Person` contendo os dados da pessoa a ser editada.
 * @property {boolean} isOpen - Controla a visibilidade do modal de edição. Se `true`, o modal é exibido.
 * @property {() => void} onClose - Função para fechar o modal de edição. Geralmente chamada ao clicar em um botão de cancelar ou fora do modal.
 * @property {() => void} onUpdated - Função chamada após as informações da pessoa serem atualizadas com sucesso.
 * @property {() => void} onDeleted - Função chamada após a pessoa ser excluída com sucesso.
 */
interface EditPersonModalProps {
  person: Person;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

/**
 * @component EditPersonModal
 * @description Modal para editar as informações de uma pessoa existente. Preenche os campos com os dados da pessoa fornecida e permite a modificação e exclusão. Utiliza a API ViaCEP para buscar endereços a partir do CEP.
 * @param {EditPersonModalProps} props - As propriedades do componente.
 * @returns {JSX.Element | null} O componente modal de edição, ou `null` se `isOpen` for `false`.
 */
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
  const [contactFrequency, setContactFrequency] = useState<Person['contactFrequency']>(person.contactFrequency || null); /** @state {string | null} contactFrequency - Frequência de contato. */
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
  * @function handleUpdate
  * @description Salva as alterações do formulário no Firestore.
  * @returns {Promise<void>}
  */
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const errorMsg = validatePerson();
    if (errorMsg) {
      alert(errorMsg);
      return;
    }

    try {
      const personRef = doc(db, 'people-directory', person.id);
      await updateDoc(personRef, {
        name,
        phone,
        email,
        favorite,
        contactFrequency,
        ...(showMore && {
          zipcode,
          address,
          number,
          complement,
          district,
          city,
          state,
          birthday,
          note
        }),
      });
      onUpdated();
      onClose();
    } catch (error) {
      console.error("Erro ao atualizar o cadastro da pessoa: ", error);
    }
  };

  /**
    * @async
    * @function handleDelete
    * @description Exclui o documento atual do Firestore.
    * @returns {Promise<void>}
    */
  const handleDelete = async (): Promise<void> => {
    try {
      const personRef = doc(db, 'people-directory', person.id);
      await deleteDoc(personRef);
      onDeleted(); // Chama a função onDeleted para indicar sucesso na exclusão
      onClose();
    } catch (error) {
      console.error("Erro ao excluir o cadastro da pessoa: ", error);
    }
  };

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
          <div className="p-4">
            {/* Topo do Modal de Edição da Pessoa */}
            <div className="flex justify-between items-center mb-6">
              <button onClick={onClose}
                className="color-pd-base text-lg">
                Cancelar
              </button>
              <h3 className="text-lg font-semibold">
                Editar Cadastro
              </h3>
              <button type="submit"
                className="color-pd-base text-lg">
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
            {/* Frequência de Contato */}
            <div className="flex justify-between items-center mb-4">
              <span>Frequência de contato</span>
              <select
                value={contactFrequency ?? ''}
                onChange={(e) => setContactFrequency(e.target.value as Person['contactFrequency'])}
                className="p-2 border border-gray-300 rounded"
              >
                <option value="">Sem frequência</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </div>

            {/* Excluir Pessoa */}
            <div className="flex justify-end mt-6">
              <button onClick={handleDelete} className="text-red-500">
                Excluir Cadastro
              </button>
            </div>
          </div>
        </form>

      </motion.div>

    </ProtectedRoute >
  );
};

export default EditPersonModal;
