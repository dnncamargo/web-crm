import { useEffect, useMemo, useState } from "react";
import type { Client, NewClientData, UpdateClientData } from "./clientTypes";
import { createClient, listenClients, toggleClientActive, toggleClientFavorite, updateClient } from "./clientsService";

export function filterClientsBySearch(clients: Client[], search: string, tagLabelsById: Record<string, string> = {}) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return clients;
  }

  return clients.filter((client) => {
    const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
    const clientTagLabels = (client.tagIds ?? []).map((tagId) => tagLabelsById[tagId] ?? tagId);

    const searchableText = [client.name, primaryContact?.value, client.notes, ...clientTagLabels, ...(client.tagIds ?? [])].filter(Boolean).join(" ").toLowerCase();
    return searchableText.includes(normalizedSearch);
  });
}

export function useClients(tagLabelsById: Record<string, string> = {}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = listenClients(
      (loadedClients) => {
        setClients(loadedClients);
        setLoading(false);
      },
      (firebaseError) => {
        setError(firebaseError.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const filteredClients = useMemo(() => {
    const favoriteClients = showOnlyFavorites ? clients.filter((client) => client.favorite) : clients;

    return filterClientsBySearch(favoriteClients, search, tagLabelsById);
  }, [clients, search, showOnlyFavorites, tagLabelsById]);

  async function addClient(data: NewClientData) {
    await createClient(data);
  }

  async function editClient(clientId: string, data: UpdateClientData) {
    await updateClient(clientId, data);
  }

  async function setFavorite(client: Client, favorite: boolean) {
    await toggleClientFavorite(client.id, favorite);
  }

  async function setActive(client: Client, active: boolean) {
    await toggleClientActive(client.id, active);
  }

  return { clients, filteredClients, search, setSearch, showOnlyFavorites, setShowOnlyFavorites, loading, error, addClient, editClient, setFavorite, setActive };
}
