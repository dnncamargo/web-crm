'use client'

import { Person } from '../utils/interfaces';
import { useRouter } from 'next/navigation';

interface PersonCardProps {
  person: Person;
  openMenuId: string | null;
  toggleMenu: (personId: string) => void;
  onAddEvent: (personId: string) => void;
  onEditPerson: (person: Person) => void;
}

const PersonCard = ({ person, onAddEvent, onEditPerson, openMenuId, toggleMenu }: PersonCardProps) => {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl shadow p-4 flex justify-between items-start">
      <div>
        <h2 className="text-lg font-medium">{person.name}</h2>
        <p className="text-sm text-gray-500">{person.phone}</p>
        <p className="text-sm text-gray-500">{person.email}</p>
      </div>

      {/* Menu de opções */}
      <div className="relative">
        <button onClick={() => toggleMenu(person.id)} className="text-gray-400 hover:text-gray-600">
          ⋯
        </button>

        {openMenuId === person.id && (
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border">
            <button
              onClick={() => onEditPerson(person)}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              ✏️ Editar
            </button>
            <button
              onClick={() => onAddEvent(person.id)}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
            >
              📆 Novo evento
            </button>
          </div>
        )}
      </div>
    </div>


  );
};

export default PersonCard;
