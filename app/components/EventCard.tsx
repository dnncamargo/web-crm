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
    <div className="bg-white p-4 rounded-xl shadow-sm space-y-2">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{event.title}</h2>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{event.date}</span>
      </div>
      <p className="text-sm text-gray-500">{event.hour && `${event.hour} - `}{event.address}</p>
      {event.description && (
        <p className="text-sm text-gray-400">{event.description}</p>
      )}
      <div className="flex space-x-2 justify-end">
        <button onClick={() => onEditEvent(event)} className="text-blue-500 text-sm">Editar</button>
      </div>
    </div>

  );
};

export default EventCard;
