'use client';

import { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Person } from '../utils/interfaces';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutline, CalendarDaysIcon as CalendarIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

/**
 * @interface PersonCardProps
 * @description Props para o componente `PersonCard`, que exibe informações resumidas de uma pessoa e oferece ações de edição e favoritar.
 * @property {Person} person - O objeto da pessoa a ser exibido no cartão.
 * @property {(person: Person) => void} onEditPerson - Função chamada ao solicitar a edição da pessoa. Recebe o objeto da pessoa como argumento.
 * @property {(personId: string, currentValue: boolean) => void} onToggleFavorite - Função chamada ao solicitar a alteração do status de favorito da pessoa. Recebe o ID da pessoa e o valor atual do status como argumentos.
 */
interface PersonCardProps {
  person: Person;
  onEditPerson: (person: Person) => void;
  onToggleFavorite: (personId: string, currentValue: boolean) => void;
}

/**
 * @component
 * @description Componente para exibir um cartão resumido de uma pessoa, incluindo nome, telefone, email (opcional), ação de favoritar e botão de editar. Ao clicar no cartão, navega para a página de detalhes da pessoa.
 * @param {PersonCardProps} { person, onEditPerson, onToggleFavorite } - Props para o componente.
 * @returns {JSX.Element} Um cartão representando as informações da pessoa.
 */
const PersonCard = ({ person, onEditPerson, onToggleFavorite }: PersonCardProps): JSX.Element => {
  const router = useRouter();

  return (
    <div
      // information: onClick={() => router.push(`/people-directory/${person.id}`)}
      onClick={() => router.push(`/people-directory/${person.id}`)}
      className="card-container-large card-container-bg">

      {/* Título do card */}
      <div className="card-header-large card-header-bg">
        <h2 className="card-header-title-large color-pd-dark">{person.name}</h2>
        {/* Favorito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(person.id, !!person.favorite);
          }}
          className="card-header-far-right color-pd-base">
          {person.favorite ? (
            <HeartSolid className="w-6 h-6" />
          ) : (
            <HeartOutline className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="card-content-large">
        {/* Telefone */}
        {person.phone && (
          <div className="card-content-info-large text-gray-500 mb-2">
            <PhoneIcon className="w-4 h-4 mr-2 mt-0.5" />
            {person.phone}
          </div>
        )}
        {/* E-mail */}
        {person.email && (
          <div className="card-content-info-large text-gray-500">
            <EnvelopeIcon className="w-4 h-4 mr-2 mt-0.5" />
            {person.email}
          </div>
        )}
      </div>

      {/* Botão de editar */}
      <div className="card-bottom-end">
        <button
          className="color-pd-base"
          onClick={(e) => {
            e.stopPropagation();
            onEditPerson(person);
          }}>
          Editar
        </button>
      </div>
    </div>
  );
};

export default PersonCard;
