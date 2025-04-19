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
    <div className="bg-white p-4 rounded-lg shadow flex flex-col gap-2 cursor-pointer"
    onClick={() => router.push(`/people-directory/${person.id}`)}
    >
      <h2 className="text-lg font-semibold">{person.name}</h2>
      <p className="text-gray-500">{person.phone}</p>
      <div className="flex gap-2">
      <button onClick={(e) => {
          e.stopPropagation();
          onEditPerson(person)
          }} className="btn-primary">Editar</button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddEvent(person.id);
          }}
          className="btn-secondary">Novo Evento</button>
        
      </div>
    </div>
  );
};

export default PersonCard;
