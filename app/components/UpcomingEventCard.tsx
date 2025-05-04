'use client';

import { JSX } from 'react';
import { Event, Person } from '@/app/utils/interfaces';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDaysIcon as CalendarIcon, UserIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

type OptionalField = {
  id: string;                 // UUID para controle único
  label: string;             // Ex: "Descrição", "URL", "Endereço Alternativo"
  value: string;
};

/**
 * @interface EventSummaryCardProps
 * @description Props para o componente `EventSummaryCard`, que exibe um resumo de um evento.
 * @property {Event} event - O objeto do evento a ser exibido no cartão de resumo.
 * @property {Person | undefined} [person] - O objeto da pessoa associada ao evento (opcional). Se fornecido, informações da pessoa podem ser exibidas.
 */
interface UpcomingEventCardProps {
  event: Event;
  person?: Person;
}

/**
 * @function formatDate
 * @description Formata uma string de data no formato 'YYYY-MM-DD' para uma representação textual em português brasileiro, incluindo o dia da semana capitalizado e o dia do mês com o mês por extenso. Opcionalmente, inclui a hora fornecida.
 * @param {string} date - A string da data no formato 'YYYY-MM-DD'.
 * @param {string | undefined} [hour] - Uma string opcional representando a hora (ex: 'HH:mm').
 * @returns {string} A data formatada como 'DiaDaSemana, Dia de Mês' ou 'DiaDaSemana, Dia de Mês às Hora'.
 */
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
 * @param {UpcomingEventCardProps} props - As propriedades passadas para o componente.
 * @returns {JSX.Element} Um cartão contendo o resumo do evento.
 */
export default function UpcomingEventCard({ event, person }: UpcomingEventCardProps): JSX.Element {
  return (
    <div className="card-container card-container-bg">

      {/* Título do card */}
      <div className="card-header card-header-bg">
        <h2 className="card-header-title">{event.title}</h2>
      </div>

      {/* Conteúdo */}
      <div className="card-content">
        {/* Data e Hora */}
        <div className="card-content-info text-gray-600">
          <CalendarIcon className="w-4 h-4 mr-2" />
          {formatDate(event.startDate, event.startTime)}
        </div>
        {/* Pessoa associada */}
        {person && (
          <div className="card-content-info text-gray-600">
            <UserIcon className="w-4 h-4 mr-2" />
            {person.name}
          </div>
        )}
        {/* Descrição */}
        {/*         {event.description && (
          <div className="card-content-info text-gray-500">
            <PencilSquareIcon className="w-4 h-4 mr-2 mt-0.5" />
            {event.description}
          </div>
        )} */}


        {event.optionalFields && event.optionalFields.length > 0 && (
          <div className="space-y-4">

            {event.optionalFields.map((field: OptionalField) => (
              <div key={field.id} >
                {field.label === 'Descrição' && typeof field.value === 'string' ? (
                  <div className="card-content-info text-gray-500">
                    <PencilSquareIcon className="w-4 h-4 mr-2 mt-0.5" />
                    {field.value}
                  </div>
                ) : ('')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
