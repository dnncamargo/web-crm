'use client'

import { useRouter } from 'next/navigation';

interface EventCardProps {
  event: any;
}

const EventCard = ({ event }: EventCardProps) => {
  const router = useRouter();

  return (
    <div className="bg-white p-4 rounded-lg shadow flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{event.endereco}</h2>
      <p>{event.data} às {event.hora}</p>
      <p className="text-gray-500">{event.observacoes}</p>
      <button onClick={() => router.push(`/edit-event/${event.id}`)} className="btn-secondary">Editar</button>
    </div>
  );
};

export default EventCard;
