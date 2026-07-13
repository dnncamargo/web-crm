import type { Client, ContactFrequency } from "./clientTypes";

export const frequencyLabels: Record<ContactFrequency, string> = {
  none: "Sem frequência",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

export function formatClientDateTimeBR(value?: string | null) {
  if (!value) {
    return "Sem interação registrada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function toDateTimeLocalInputValue(value?: string | null) {
  const sourceDate = value ? new Date(value) : new Date();
  const date = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;

  const timezoneOffset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - timezoneOffset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

export function filterVisibleClients(
  clients: Client[],
  filters: {
    showOnlyFavorites: boolean;
    showOnlyActive: boolean;
    showOnlyWithContactFrequency: boolean;
    showOnlyWithBirthDate: boolean;
  }
) {
  return clients.filter((client) => {
    if (filters.showOnlyFavorites && !client.favorite) return false;
    if (filters.showOnlyActive && !client.active) return false;

    if (
      filters.showOnlyWithContactFrequency &&
      client.contactFrequency === "none"
    ) {
      return false;
    }

    if (filters.showOnlyWithBirthDate && !client.birthDate) return false;

    return true;
  });
}