function formatForGoogleCalendar(event : any) {
  const padTime = (time: string) => (time.length === 5 ? `${time}:00` : time);
  const tzOffset = '-03:00'; // Brasil (horário padrão, pode ser dinâmico se quiser)

  if (event.allDay) {
    return {
      summary: event.title.trim(),
      start: { date: event.startDate },
      end: { date: event.endDate },
      description: event.description?.trim() || '',
      ...(event.address && {
        location: [event.address, event.number, event.city, event.state].filter(Boolean).join(', ')
      })
    };
  } else {
    return {
      summary: event.title.trim(),
      start: {
        dateTime: `${event.startDate}T${padTime(event.startTime)}${tzOffset}`,
        timeZone: 'America/Sao_Paulo'
      },
      end: {
        dateTime: `${event.endDate}T${padTime(event.endTime)}${tzOffset}`,
        timeZone: 'America/Sao_Paulo'
      },
      description: event.description?.trim() || '',
      ...(event.address && {
        location: [event.address, event.number, event.city, event.state].filter(Boolean).join(', ')
      })
    };
  }
}


export async function createGoogleCalendarEvent(event: any) {
  const accessToken = localStorage.getItem('googleAccessToken');
  if (!accessToken) throw new Error('Token de acesso do Google não encontrado');

  const formatedEvent = formatForGoogleCalendar(event); // Formata o evento para o Google Calendar

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(formatedEvent),
  });

  console.log('[Google Event]', JSON.stringify(formatedEvent, null, 2))

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Erro detalhado da API Google Calendar:', errorData);
    throw new Error(errorData.error.message || 'Erro ao criar evento');
  }

  return await response.json();
}
