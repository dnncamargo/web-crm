'use client'

import { Person } from '../utils/interfaces';
import { useRouter } from 'next/navigation';

interface PersonCardProps {
  person: Person;
  onAddEvent: (personId: string) => void;
  onEditPerson: (person: Person) => void;
}

const PersonCard = ({ person, onAddEvent, onEditPerson }: PersonCardProps) => {
  const router = useRouter();

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center">
      <div>
        <h2 className="text-lg font-semibold">{person.name}</h2>
        <p className="text-sm text-gray-500">{person.phone}</p>
        <p className="text-sm text-gray-400">{person.email}</p>
      </div>
      <div className="flex space-x-2">
        <button onClick={() => onEditPerson(person)} className="text-blue-500 text-sm">Editar</button>
        <button onClick={() => onAddEvent(person.id)} className="text-green-500 text-sm">Evento</button>
      </div>
    </div>

  );
};

export default PersonCard;
