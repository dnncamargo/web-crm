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
      onClick={() => router.push(`/events-history/${event.id}`)}
      className="card-container-large">
      <div className="card-header-large">
        <h2 className="card-header-title-large">{event.title}</h2>
        <span className="card-header-right color-event color-event-bg">{event.date}</span>
      </div>
      <p className="card-content-large text-gray-500">{event.hour && `${event.hour} - `}{event.address}</p>
      {event.description && (
        <p className="card-content-large text-gray-400">{event.description}</p>
      )}
      <div className="card-bottom-end">
        <button onClick={(e) => {
            e.stopPropagation();
            onEditEvent(event);
          }} className="color-event">Editar</button>
      </div>
    </div>

  );
};

export default EventCard;
