export async function createGoogleCalendarEvent(accessToken: string, event: any) {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Erro detalhado da API Google Calendar:', errorData);
      throw new Error('Erro ao criar evento no Google Calendar');
    }
  
    return await response.json();
  }
  