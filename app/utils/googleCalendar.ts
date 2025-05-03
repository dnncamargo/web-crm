function formatOptionalFields(optionalFieldsArray: any[]) {
  if (!Array.isArray(optionalFieldsArray)) return '';

  let description = '';
  let tasks: { text: string; done: boolean }[] = [];

  for (const field of optionalFieldsArray) {
    if (field.type === 'text' && typeof field.value === 'string') {
      description = field.value.trim();
    } else if (field.type === 'tasks' && Array.isArray(field.value)) {
      tasks = field.value;
    }
  }

  let output = '';

  if (description) {
    output += `Descrição do Evento\n${description}\n`;
  }

  if (tasks.length > 0) {
    if (output) output += '\n';
    output += 'Lista de Tarefas\n';
    output += tasks
      .map((task) => `${task.done ? '☑' : '☐'} ${task.text.trim()}`)
      .join('\n');
  }

  return output;
}

function formatForGoogleCalendar(event: any) {
  const padTime = (time: string) => (time.length === 5 ? `${time}:00` : time);
  const tzOffset = '-03:00'; // Brasil

  console.log('[Event Object]', JSON.stringify(event, null, 2))
  const description = formatOptionalFields(event.optionalFields) || '';

  console.log('[Description]', JSON.stringify(description, null, 2)) // [Description] ""

  if (event.allDay) {
    return {
      summary: event.title.trim(),
      start: { date: event.startDate },
      end: { date: event.endDate },
      description,
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
      description,
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

  if (!response.ok) {
    const errorData = await response.json();

    console.log('[Google Event]', JSON.stringify(formatedEvent, null, 2))
    throw new Error("🚧 Erro detalhado da API Google Calendar:", errorData.error.message);
  } else {
    console.log("🚀 Evento enviado ao Google Calendar")
  }

  return await response.json();
}
