'use client';

import { JSX } from 'react';
import { Event, Person } from '@/app/utils/interfaces';
import { CalendarDaysIcon as CalendarIcon, UserIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * @interface EventSummaryCardProps
 * @description Props para o componente `EventSummaryCard`, que exibe um resumo de um evento.
 * @property {Event} event - O objeto do evento a ser exibido no cartão de resumo.
 * @property {Person | undefined} [person] - O objeto da pessoa associada ao evento (opcional). Se fornecido, informações da pessoa podem ser exibidas.
 */
interface EventSummaryCardProps {
  event: Event;
  person?: Person;
}

const formatDate = (date: string, hour?: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const parsedDate = new Date(year, month - 1, day);
  const dayOfWeek = format(parsedDate, 'EEEE', { locale: ptBR });
  const dayOfMonth = format(parsedDate, "d 'de' MMMM", { locale: ptBR });

  return `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayOfMonth}${hour ? ` às ${hour}` : ''}`;
};

/**
 * @component
 * @description Componente para exibir um cartão de resumo de um evento, incluindo título, data e hora, e opcionalmente o nome da pessoa associada.
 * @param {EventSummaryCardProps} props - As propriedades passadas para o componente.
 * @returns {JSX.Element} Um cartão contendo o resumo do evento.
 */
export default function EventSummaryCard({ event, person }: EventSummaryCardProps): JSX.Element {
  return (
    <div className="card-container">

      {/* Título full-width topo */}
      <div className="card-header">
        <h2 className="card-header-title">{event.title}</h2>
      </div>

      {/* Conteúdo */}
      <div className="card-content">

        {/* Data e Hora */}
        <div className="flex items-center text-sm text-gray-600">
          <CalendarIcon className="w-4 h-4 mr-2" />
          {formatDate(event.date, event.hour)}
        </div>

        {/* Pessoa associada */}
        {person && (
          <div className="flex items-center text-sm text-gray-600">
            <UserIcon className="w-4 h-4 mr-2" />
            {person.name}
          </div>
        )}

        {/* Descrição */}
        {event.description && (
          <div className="flex items-start text-sm text-gray-500">
            <PencilSquareIcon className="w-4 h-4 mr-2 mt-0.5" />
            {event.description}
          </div>
        )}

      </div>
    </div>
  );
}
