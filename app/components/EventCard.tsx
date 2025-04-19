'use client'

import { useRouter } from 'next/navigation';
import { Event } from '../utils/interfaces';

interface EventCardProps {
  event: Event;
  onEditEvent: (event: Event) => void;
}

const EventCard = ({ event, onEditEvent }: EventCardProps) => {
  const router = useRouter();

  return (
    <div
      className="bg-white p-4 rounded-lg shadow flex flex-col gap-2 cursor-pointer"
      onClick={() => router.push(`/events-history/${event.id}`)}
    >
      <h2 className="text-lg font-semibold">{event.address}</h2>
      <p className="text-gray-500">{event.date} às {event.hour}</p>
      <p>{event.notes}</p>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditEvent(event);
          }}
          className="btn-primary"
        >
          Editar
        </button>
      </div>
    </div>
  );
};

export default EventCard;
