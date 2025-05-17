'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { addDoc, collection, doc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../components/AuthProvider';
import { motion } from 'framer-motion';
import { OptionalField } from '../utils/interfaces';
import ProtectedRoute from './ProtectedRoute';
import clsx from 'clsx';
import OptionalFieldAddressInput from './OptionalFieldAddressInput';

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
  availableRelationships: string[];
  setAvailableRelationships: React.Dispatch<React.SetStateAction<string[]>>;
  onAddRelationship: (newCategory: string) => void;
}

/**
 * @component AddPersonModal
 * @description Modal para adicionar uma nova pessoa ao diretório. Permite inserir informações básicas de contato e detalhes adicionais como endereço, data de nascimento e notas. Utiliza a API ViaCEP para buscar endereços a partir do CEP.
 * @param {AddPersonModalProps} props - As propriedades do componente.
 * @returns {JSX.Element | null} O componente modal, ou `null` se `isOpen` for `false`.
 */
const AddPersonModal: React.FC<AddPersonModalProps> = ({ isOpen, onClose, onAdded, availableRelationships, setAvailableRelationships, onAddRelationship }) => {
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */
  const [name, setName] = useState(''); /** @state {string} name - Nome da pessoa. */
  const [phone, setPhone] = useState('') /** @state {array of strings} phone - Números de telefone da pessoa. */
  const [email, setEmail] = useState('');  /** @state {string} email - Endereço de e-mail da pessoa. */
  const [showMore, setShowMore] = useState(false);  /** @state {boolean} showMore - Controla a visibilidade de campos adicionais. */
  const [optionalFields, setOptionalFields] = useState<OptionalField[]>([]);
  const [showOptionalFieldModal, setShowOptionalFieldModal] = useState(false);
  const [birthday, setBirthday] = useState('');  /** @state {string} birthday - Data de nascimento. */
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);
  const [showRelationshipsModal, setShowRelationshipsModal] = useState(false);
  const [isDraggable, setIsDraggable] = useState(true); /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */

  // Proteção: Se não for open ou sem usuário, nem carrega.
  if (!isOpen || !uid) return null;

  useLayoutEffect(() => {
    adjustModalDraggable(); // Ajusta a propriedade de arrastar do modal com base na altura do conteúdo.
  }, [isOpen]);

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
  /*   const handleSearchAddress = async (zipCode: string): Promise<void> => {
      const data = await searchAddress(zipCode);
      if (data) {
        setAddress(data?.address || ''); // Garante que o estado seja atualizado mesmo se a propriedade for undefined
        setDistrict(data?.district || '');
        setCity(data?.city || '');
        setState(data?.state || '');
      }
    }; */

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
      const personRef = {
        name,
        phone,
        email,
        ...(showMore && {
          birthday,
          optionalFields,
        }),
        relationship: selectedRelationships,
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, `users/${uid}/people-directory`), personRef);
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
        <div className="h-1.5 w-14 bg-gray-300 rounded-full mx-auto my-4"></div>
        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-4 mb-16">
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

            {/* Modal de Relacionamentos */}
            {showRelationshipsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-black p-4 rounded-lg w-full max-w-sm shadow-lg">
                  <h2 className="text-lg text-white font-semibold mb-4">Selecionar relacionamento</h2>

                  {availableRelationships.map((rel) => (
                    <button
                      key={rel}
                      type="button"
                      onClick={() => {
                        setSelectedRelationships((prev) =>
                          prev.includes(rel)
                            ? prev.filter((r) => r !== rel) // Deseleciona
                            : [...prev, rel]                // Seleciona
                        );
                      }}
                      className={`relative inline-flex rounded-full px-3 py-1 mb-2 ml-1
            ${selectedRelationships.includes(rel)
                          ? 'bg-green-700 text-white'
                          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}
          `}
                    >
                      {rel}
                    </button>
                  ))}
                  <div className='flex items-center'>
                    <button
                      type="button"
                      onClick={async () => {
                        const newRel = prompt('Novo relacionamento:')?.trim();
                        if (newRel && !availableRelationships.includes(newRel)) {
                          await onAddRelationship(newRel); // <- salva no Firestore e atualiza estado global
                          setSelectedRelationships((prev) => [...prev, newRel]); // <- associa a pessoa atual
                        }
                      }}
                      className="text-white px-4 py-2 mb-2"
                    >
                      + Novo relacionamento
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        setShowRelationshipsModal(false)
                      }
                      className="text-green-600 hover:underline text-sm"
                    >
                      Fechar
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* Modal de Campos Personalizados */}
            {showOptionalFieldModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white p-4 rounded-lg w-full max-w-sm shadow-lg">
                  <h2 className="text-lg font-semibold mb-4">Adicionar campo opcional</h2>

                  <button
                    type="button"
                    onClick={() => {
                      const newField: OptionalField = {
                        id: crypto.randomUUID(),
                        type: 'address',
                        label: 'Endereço',
                        value: {
                          useAddressAPI: false,
                          location: '',
                          zipcode: '',
                          address: '',
                          number: '',
                          district: '',
                          city: '',
                          state: ''
                        }
                      }
                      setOptionalFields(prev => [...prev, newField])
                      setShowOptionalFieldModal(false)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
                  >
                    Endereço
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newField: OptionalField = {
                        id: crypto.randomUUID(),
                        type: 'note',
                        label: 'Anotações',
                        value: ''
                      }
                      setOptionalFields(prev => [...prev, newField])
                      setShowOptionalFieldModal(false)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
                  >
                    Anotações
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newField: OptionalField = {
                        id: crypto.randomUUID(),
                        type: 'url',
                        label: 'URL',
                        value: ''
                      }
                      setOptionalFields(prev => [...prev, newField])
                      setShowOptionalFieldModal(false)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
                  >
                    URL
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newField: OptionalField = {
                        id: crypto.randomUUID(),
                        type: 'phone',
                        label: 'Telefone adicional',
                        value: ''
                      }
                      setOptionalFields(prev => [...prev, newField])
                      setShowOptionalFieldModal(false)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
                  >
                    Telefone adicional
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newField: OptionalField = {
                        id: crypto.randomUUID(),
                        type: 'email',
                        label: 'E-mail adicional',
                        value: ''
                      }
                      setOptionalFields(prev => [...prev, newField])
                      setShowOptionalFieldModal(false)
                    }}
                    className="w-full bg-blue-600 text-white px-4 py-2 mb-2 rounded hover:bg-blue-700"
                  >
                    E-mail adicional
                  </button>

                  <button
                    onClick={() => setShowOptionalFieldModal(false)}
                    className="mt-3 w-full px-4 py-2 text-sm text-gray-500 hover:text-black"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Informações de Contato */}
            <div className="bg-gray-50 rounded-lg overflow-hidden border">
              <input
                type="text"
                placeholder="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-4 bg-transparent border-b border-gray-200 focus:outline-none" />
              <input
                type="tel"
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

                {/* Campos Personalizados Adicionados   */}
                {optionalFields.map((field) => (
                  <div key={field.id} className="mt-6 p-2 bg-gray-50 rounded-lg overflow-hidden border">
                    <div className="mb-4">
                      {/* Input para editar a label do campo */}
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          setOptionalFields(prev =>
                            prev.map(f =>
                              f.id === field.id
                                ? { ...f, label: e.target.value }
                                : f
                            )
                          )
                        }
                        className="font-semibold text-sm bg-gray-50  text-gray-700 mb-2 p-1 "
                        placeholder="Nome do campo"
                      />

                      {field.type === 'address' && (
                        <OptionalFieldAddressInput
                          id={field.id}
                          label={field.label}
                          value={field.value}
                          onRemove={(id) =>
                            setOptionalFields(prev => prev.filter(f => f.id !== id))
                          }
                          onChange={(id, updatedValue) =>
                            setOptionalFields(prev =>
                              prev.map(f =>
                                f.id === id && f.type === 'address'
                                  ? { ...f, value: updatedValue }
                                  : f
                              )
                            )
                          }
                        />
                      )}

                      {field.type === 'note' && (
                        <textarea
                          rows={4}
                          value={field.value}
                          onChange={(e) =>
                            setOptionalFields(prev =>
                              prev.map(f =>
                                f.id === field.id && f.type === 'note'
                                  ? { ...f, value: e.target.value }
                                  : f
                              )
                            )
                          }
                          className="w-full border p-2 rounded"
                        />
                      )}

                      {field.type === 'url' && (
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) =>
                            setOptionalFields(prev =>
                              prev.map(f =>
                                f.id === field.id && f.type === 'url'
                                  ? { ...f, value: e.target.value }
                                  : f
                              )
                            )
                          }
                          className="w-full border p-2 rounded"
                        />
                      )}
                    </div>

                    {field.type === 'phone' && (
                      <input
                        type="tel"
                        value={field.value}
                        onChange={(e) =>
                          setOptionalFields(prev =>
                            prev.map(f =>
                              f.id === field.id && f.type === 'phone'
                                ? { ...f, value: e.target.value }
                                : f
                            )
                          )
                        }
                        className="w-full border p-2 rounded"
                      />
                    )}

                    {field.type === 'email' && (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) =>
                          setOptionalFields(prev =>
                            prev.map(f =>
                              f.id === field.id && f.type === 'email'
                                ? { ...f, value: e.target.value }
                                : f
                            )
                          )
                        }
                        className="w-full border p-2 rounded"
                      />
                    )}

                    <button
                      onClick={() =>
                        setOptionalFields(prev => prev.filter(f => f.id !== field.id))
                      }
                      className="text-xs text-red-500 mt-2"
                    >
                      Remover
                    </button>
                  </div>
                ))}

                <div className='flex flex-col items-start'>
                  {/* Adicionar Relacionamento */}
                  <button
                    type="button"
                    onClick={() => setShowRelationshipsModal(true)}
                    className="text-green-600 font-medium text-sm underline mb-2"
                  >
                    + Adicionar relacionamento
                  </button>

                  {/* Adicionar Campo Personalizado */}
                  <button
                    type="button"
                    onClick={() => setShowOptionalFieldModal(true)}
                    className="text-green-600 font-medium text-sm underline mb-2"
                  >
                    + Adicionar campo
                  </button>
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
