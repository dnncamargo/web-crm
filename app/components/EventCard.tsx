'use client'

import { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Event } from '../utils/interfaces';
import { ClockIcon, MapPinIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../utils/helpers';

type OptionalField = {
  id: string;                 // UUID para controle único
  label: string;             // Ex: "Descrição", "URL", "Endereço Alternativo"
  value: string;
};

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
  const router = useRouter(); /** @const {NextRouter} router - O roteador do Next.js para navegação entre páginas. */

  return (
    <div
      // information: onClick={() => router.push(`/events-history/${event.id}`)}
      onClick={() => router.push(`/events-history/${event.id}`)}
      className="card-container-large card-container-bg">

      {/* Título do card */}
      <div className="card-header-large card-header-bg">
        <h2 className="card-header-title-large color-eh-dark">{event.title}</h2>
        {/* Data */}
        <span
          className="card-header-far-right color-eh-light">
          {formatDate(event.startDate, event.endDate, event.startTime, event.startTime, event.allDay)}
        </span>
      </div>

      {/* Conteúdo */}
      <div className="card-content-large">
        {/* Hora */}
        {event.startTime && (
          <div className="card-content-info-large text-gray-500 mb-2">
            <ClockIcon className="w-4 h-4 mr-2 mt-0.5" />
            {/* {event.hour && `${event.hour} - `}{event.address} */}
            {event.startTime}
          </div>
        )}
        {/* Endereço */}
        {event.address && (
          <div className="card-content-info-large text-gray-500 mb-2">
            <MapPinIcon className="w-4 h-4 mr-2 mt-0.5" />
            {event.address}
          </div>
        )}
        {/* todo: incluir Pessoa associada no card */}
        {/* Descrição */}


        {/* {event.description && (
          <div className="card-content-info-large text-gray-500 mb-2">
            <PencilSquareIcon className="w-4 h-4 mr-2 mt-0.5" />
            {event.description}
          </div>
        )} */}

        {event.optionalFields && event.optionalFields.length > 0 && (
          <div className="space-y-4">

            {event.optionalFields.map((field: OptionalField) => (
              <div key={field.id} >
                {field.label === 'Descrição' && typeof field.value === 'string' ? (
                  <div className="card-content-info-large text-gray-500 mb-2">
                    <PencilSquareIcon className="w-4 h-4 mr-2 mt-0.5" />
                    {field.value}
                  </div>
                ) : ('')}
              </div>
            ))}
          </div>
        )}

      </div>
      {/* Botão de editar */}
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
    </div >

  );
};

export default EventCard;
