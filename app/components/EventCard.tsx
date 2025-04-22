'use client'

import { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Event } from '../utils/interfaces';

/**
 * @interface EventCardProps
 * @description Props para o componente `EventCard`, que exibe informações resumidas de um evento e oferece ação de edição.
 * @property {Event} event - O objeto do evento a ser exibido no cartão.
 * @property {(event: Event) => void} onEditEvent - Função chamada ao solicitar a edição do evento. Recebe o objeto do evento como argumento.
 */
interface EventCardProps {
  event: Event;
  onEditEvent: (event: Event) => void;
}

/**
 * @component
 * @description Componente para exibir um cartão resumido de um evento, incluindo título, data, hora (opcional), endereço e descrição (opcional). Ao clicar no cartão, navega para a página de detalhes do evento.
 * @param {EventCardProps} { event, onEditEvent } - Props para o componente.
 * @returns {JSX.Element} Um cartão representando as informações do evento.
 */
const EventCard = ({ event, onEditEvent }: EventCardProps): JSX.Element => {
  const router = useRouter();

  return (
    <div
      // information: onClick={() => router.push(`/events-history/${event.id}`)}
      onClick={() => router.push(`/events-history/${event.id}`)}
      className="card-container-large card-container-bg">

      {/* Título full-width topo */}
      <div className="card-header-large card-header-bg">
        <h2 className="card-header-title-large color-eh-dark">{event.title}</h2>
        {/* Elemento à direita */}
        <span
          className="card-header-far-right color-eh-light">
          {event.date}
        </span>
      </div>

      {/* Conteúdo */}
      <p className="card-content-large text-gray-500">{event.hour && `${event.hour} - `}{event.address}</p>
      {event.description && (
        <p className="card-content-large text-gray-400">{event.description}</p>
      )}
      <div className="card-bottom-end">
      <button
          className="color-eh-base"
          onClick={(e) => {
            e.stopPropagation();
            onEditEvent(event);
          }}>
          Editar
        </button>
      </div>
    </div>

  );
};

export default EventCard;
