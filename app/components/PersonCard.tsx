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
      className="bg-white p-4 rounded-xl shadow-sm space-y-2 relative cursor-pointer hover:bg-gray-50 transition"
    >
      <div className="flex justify-between items-start">
        <h2 className="text-lg font-semibold break-words">{person.name}</h2>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(person.id, !!person.favorite);
          }}
          className="text-green-500"
        >
          {person.favorite ? (
            <HeartSolid className="w-6 h-6" />
          ) : (
            <HeartOutline className="w-6 h-6" />
          )}
        </button>
      </div>

      <p className="text-sm text-gray-500">{person.phone}</p>
      {person.email && <p className="text-sm text-gray-400">{person.email}</p>}

      <div className="flex space-x-2 justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditPerson(person);
          }}
          className="text-green-500 text-sm"
        >
          Editar
        </button>
      </div>
    </div>
  );
};

export default PersonCard;
