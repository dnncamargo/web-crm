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
      className="card-container-large card-container-bg"
    >
      <div className="card-header-large card-header-bg">
        <h2 className="card-header-title-large color-pd-dark">{person.name}</h2>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(person.id, !!person.favorite);
          }}
          className="card-header-far-right color-pd-base"
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
          className="color-pd-base"
        >
          Editar
        </button>
      </div>
    </div>
  );
};

export default PersonCard;
