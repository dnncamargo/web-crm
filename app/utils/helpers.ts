/**
* @async
* @function searchAddress
* @description Busca informações de endereço a partir de um CEP usando a API ViaCEP.
* @param {string} zipCode - O código postal a ser pesquisado.
* @returns {Promise<{ address: string; district: string; city: string; state: string } | void>}
*/
export const searchAddress = async (zipCode: string): Promise<{
  address: string;
  district: string;
  city: string;
  state: string
} | void> => {
  if (zipCode.length === 8) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`);
      const data = await response.json();
      if (!data.erro) {
        return {
          address: data.logradouro,
          district: data.bairro,
          city: data.localidade,
          state: data.uf,
        };

      } else {
        alert('CEP não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  }
};


import { format, parseISO, isSameMonth, isSameYear } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react';

/**
 * Formata a data do evento para exibição compacta e legível.
 *
 * @param startDate - Data de início no formato ISO (yyyy-MM-dd)
 * @param endDate - Data de término no formato ISO (yyyy-MM-dd)
 * @param startTime - Hora de início no formato 'HH:mm' (opcional)
 * @param endTime - Hora de término no formato 'HH:mm' (opcional)
 * @param allDay - Indica se o evento é o dia todo
 * @returns string formatada com datas no formato 'dd-MM', ou variações conforme intervalo
 */
export function formatDate(
  startDate: string,
  endDate: string,
  startTime?: string,
  endTime?: string,
  allDay: boolean = false
): string {
  // Transforma as strings em objetos Date
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  const sameDay = format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
  const sameMonth = isSameMonth(start, end)
  const sameYear = isSameYear(start, end)
  const yearDiff = Math.abs(start.getFullYear() - end.getFullYear())

  // Formatos padrão
  const formatDM = (date: Date) => format(date, 'dd-MMM', { locale: ptBR })
  const formatDMY = (date: Date) => format(date, 'dd-MM-yy', { locale: ptBR })

  // Seta → para separação
  const arrow = '➡️'

  // Se evento for o dia todo
  if (allDay) {
    const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)

    // Evento de 1 dia
    if (diffInDays <= 1) return formatDM(start)

    // Mesmo mês e ano
    if (sameMonth && sameYear) {
      return `${format(start, 'dd')} ${arrow} ${formatDM(end)}`
    }

    // Meses diferentes no mesmo ano
    if (!sameMonth && sameYear) {
      return `${formatDM(start)} ${arrow} ${formatDM(end)}`
    }

    // Anos diferentes
    if (yearDiff === 1) {
      return `${formatDM(start)} ${arrow} ${formatDMY(end)}`
    }

    // Anos diferentes e não consecutivos
    return `${formatDMY(start)} ${arrow} ${formatDMY(end)}`
  }

  // Se o evento tiver horário definido
  if (!allDay && startTime && endTime) {
    const startFull = new Date(`${startDate}T${startTime}`)
    const endFull = new Date(`${endDate}T${endTime}`)

    const sameDay = format(startFull, 'yyyy-MM-dd') === format(endFull, 'yyyy-MM-dd')
    const sameMonth = isSameMonth(startFull, endFull)
    const sameYear = isSameYear(startFull, endFull)
    const yearDiff = Math.abs(startFull.getFullYear() - endFull.getFullYear())

    if (sameDay) {
      return formatDM(startFull)
    }

    if (!sameDay && sameMonth && sameYear) {
      return `${format(startFull, 'dd')} ${arrow} ${formatDM(endFull)}`
    }

    if (!isSameMonth && sameYear) {
      return `${formatDM(startFull)} ${arrow} ${formatDM(endFull)}`
    }

    if (!isSameYear && yearDiff === 1) {
      return `${formatDM(startFull)} ${arrow} ${formatDMY(endFull)}`
    }

    return `${formatDMY(startFull)} ${arrow} ${formatDMY(endFull)}`
  }

  // Caso padrão (segurança)
  return formatDM(start)
}
