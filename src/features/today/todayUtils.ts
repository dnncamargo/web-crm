import type { Client, ContactFrequency } from "../clients/clientTypes";
export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}
export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
export function addDaysToDateKey(dateKey: string, days: number) {
  return toDateKey(addDays(parseDateKey(dateKey), days));
}
export function getTodayKey() {
  return toDateKey(new Date());
}
export function getUpcomingDateKeys(daysAhead: number) {
  const today = new Date();
  return Array.from({ length: daysAhead + 1 }, (_, index) => toDateKey(addDays(today, index)));
}
export function formatDateKeyBR(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) {
    return dateKey;
  }
  return `${day}/${month}/${year}`;
}
export function formatDateKeyShort(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(date);
}
export function getDateKeyFromDateTime(value?: string | null) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}
export function getTimeFromDateTime(value?: string | null) {
  if (!value || !value.includes("T")) {
    return "";
  }
  return value.split("T")[1]?.slice(0, 5) ?? "";
}
export function getContactFrequencyDays(frequency: ContactFrequency) {
  const daysByFrequency: Record<ContactFrequency, number | null> = { none: null, weekly: 7, biweekly: 14, monthly: 30 };
  return daysByFrequency[frequency];
}
export function getClientLastInteractionDateKey(client: Client) {
  return getDateKeyFromDateTime(client.lastInteractionAt) || getDateKeyFromDateTime(client.lastContactAt) || getDateKeyFromDateTime(client.lastOrderAt);
}
export function getClientNextContactDateKey(client: Client) {
  const frequencyDays = getContactFrequencyDays(client.contactFrequency);
  if (!frequencyDays) {
    return null;
  }
  const lastInteractionDateKey = getClientLastInteractionDateKey(client);
  if (!lastInteractionDateKey) {
    return getTodayKey();
  }
  return addDaysToDateKey(lastInteractionDateKey, frequencyDays);
}
export function shouldSuggestClientContact(client: Client) {
  if (!client.active || client.contactFrequency === "none") {
    return false;
  }
  const nextContactDateKey = getClientNextContactDateKey(client);
  if (!nextContactDateKey) {
    return false;
  }
  return nextContactDateKey <= getTodayKey();
}
