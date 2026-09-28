'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../components/auth/AuthProvider'
import ProtectedRoute from '../../components/auth/ProtectedRoute'
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useOptionalFields } from '@/app/hooks/useOptionalFields';
import { usePersonRelationships } from '@/app/hooks/usePersonRelationships';
import { usePersonForm } from '@/app/hooks/usePersonForm';
import { OptionalFieldRenderer } from '@/app/components/optional-fields/OptionalFieldRenderer';
import { PeopleRelationshipsRenderer } from './PeopleRelationshipsRenderer';
import { OptionalFieldModal } from '@/app/components/optional-fields/OptionalFieldModal';
import { PeopleRelationshipsModal } from './PeopleRelationshipsModal';

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
  const { uid } = useAuth(); /** @const {uid | null} uid - O usuário do Firebase autenticado. */
  const modalRef = useRef<HTMLDivElement>(null);  /** @ref {HTMLDivElement} modalRef - Referência ao elemento do modal para manipulação direta. */
  
  const [showMore, setShowMore] = useState(false);  /** @state {boolean} showMore - Controla a visibilidade de campos adicionais. */
  const [showOptionalFieldModal, setShowOptionalFieldModal] = useState(false);
  const [showRelationshipsModal, setShowRelationshipsModal] = useState(false);
  const [isDraggable, setIsDraggable] = useState(true); /** @state {boolean} isDraggable - Controla se o modal pode ser arrastado verticalmente. */

  // Proteção: Se não for open ou sem usuário, nem carrega.
  if (!isOpen || !uid) return null;

  const optionalFieldsControl = useOptionalFields({ context: "person" }); // Hook para gerenciar campos opcionais

  const {
    optionalFields,
    addOptionalField,
    removeOptionalField,
    updateOptionalField,
    updateLabel,
    resetOptionalFields
  } = optionalFieldsControl; // Hook para gerenciar campos opcionais

  const personRelationshipsControl = usePersonRelationships(); // Hook para gerenciar relacionamentos de pessoas

  const {
    availableRelationships,
    selectedRelationships,
    toggleRelationship,
    handleAddRelationship,
    clearSelectedRelationships
  } = personRelationshipsControl; // Hook para gerenciar relacionamentos de pessoas

  const {
    name, setName,
    email, setEmail,
    phone, setPhone,
    birthday, setBirthday,
    error, setError,
    createPerson
  } = usePersonForm({ uid, optionalFieldsControl, personRelationshipsControl }); // Hook para gerenciar o formulário de pessoa

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

  useEffect(() => {
    if (!isOpen) {
      resetOptionalFields(); // nova função no hook
    }
  }, [isOpen]);

  /**
  * @async
  * @function handleSubmit
  * @description Salva as informações do formulário no Firestore.
  * @param {React.FormEvent} e - Objeto do evento de formulário.
  * @returns {Promise<void>}
  */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const success = await createPerson();
    if (success) {
      onAdded();
      onClose();
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
                  <div key={field.id} >
                    <OptionalFieldRenderer
                      field={field}
                      onChange={(updatedValue) => {
                        console.log('[updatedValue]:', updatedValue);
                        updateOptionalField(field.id, { value: updatedValue })
                      }
                      }
                      onLabelChange={(newLabel) => updateLabel(field.id, newLabel)}
                      onRemove={() => removeOptionalField(field.id)}
                    />
                  </div>
                ))}


                <PeopleRelationshipsRenderer selectedRelationships={selectedRelationships} />

                {/* Modal de Campos Personalizados */}
                {showOptionalFieldModal && (
                  <OptionalFieldModal
                    context='person'
                    onAddOptionalField={addOptionalField}
                    onClose={() => setShowOptionalFieldModal(false)}
                  />
                )}

                {showRelationshipsModal && (
                  <PeopleRelationshipsModal
                    onClose={() => {
                      setShowRelationshipsModal(false);
                    }}
                    availableRelationships={availableRelationships}
                    selectedRelationships={selectedRelationships}
                    toggleRelationship={toggleRelationship}
                    handleAddRelationship={handleAddRelationship}
                  />
                )}

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
