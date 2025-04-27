  // utils/googleContacts.ts

export async function fetchAllContacts(accessToken: string): Promise<any[]> {
  let allContacts: any[] = [];
  let nextPageToken: string | undefined = undefined;

  do {
    const response: Response = await fetch(`https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,birthdays,urls&pageSize=1000${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data: { connections?: any[]; nextPageToken?: string } = await response.json();
    if (data.connections) {
      allContacts = [...allContacts, ...data.connections];
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return allContacts;
}
