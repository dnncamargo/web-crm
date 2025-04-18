'use client'

import { useRouter } from 'next/navigation';

interface EventCardProps {
  evento: any;
}

const EventCard = ({ evento }: EventCardProps) => {
  const router = useRouter();

  return (
    <div className="bg-white p-4 rounded-lg shadow flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{evento.endereco}</h2>
      <p>{evento.data} às {evento.hora}</p>
      <p className="text-gray-500">{evento.observacoes}</p>
      <button onClick={() => router.push(`/edit-event/${evento.id}`)} className="btn-secondary">Editar</button>
    </div>
  );
};

export default EventCard;
