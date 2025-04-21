'use client';

import { Person } from '../utils/interfaces';
import { useRouter } from 'next/navigation';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline';

interface PersonCardProps {
  person: Person;
  onEditPerson: (person: Person) => void;
  onToggleFavorite: (personId: string, currentValue: boolean) => void;
}

const PersonCard = ({ person, onEditPerson, onToggleFavorite }: PersonCardProps) => {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push(`/people-directory/${person.id}`)}
      className="card-container-large"
    >
      <div className="card-header-large">
        <h2 className="card-header-title-large">{person.name}</h2>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(person.id, !!person.favorite);
          }}
          className="card-header-right color-people"
        >
          {person.favorite ? (
            <HeartSolid className="w-6 h-6" />
          ) : (
            <HeartOutline className="w-6 h-6" />
          )}
        </button>
      </div>

      <p className="card-content-large text-gray-500">{person.phone}</p>
      {person.email && <p className="card-content-large text-gray-400">{person.email}</p>}

      <div className="card-bottom-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditPerson(person);
          }}
          className="color-people text-sm"
        >
          Editar
        </button>
      </div>
    </div>
  );
};

export default PersonCard;
