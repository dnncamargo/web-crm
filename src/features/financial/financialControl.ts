import type { Order } from "../orders/orderTypes.js";

export type FinancialControlSort = "date" | "client" | "value";

export interface FinancialControlPeriod {
  from: string;
  through: string;
}

export type FinancialControlEventKind = "receipt" | "refund";

function isValidCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidFinancialControlPeriod(period: FinancialControlPeriod): boolean {
  return isValidCivilDate(period.from)
    && isValidCivilDate(period.through)
    && period.from <= period.through;
}

export function canPrintFinancialReport(
  loading: boolean,
  error: string,
  period: FinancialControlPeriod,
): boolean {
  return !loading && !error && isValidFinancialControlPeriod(period);
}

export function getFinancialEventRowKey(orderId: string, kind: FinancialControlEventKind, eventId: string): string {
  return JSON.stringify([orderId, kind, eventId]);
}

interface FirestoreTimestampLike {
  seconds?: unknown;
  nanoseconds?: unknown;
  toMillis?: () => unknown;
  toDate?: () => unknown;
}

export function getOrderCreationDate(order: Pick<Order, "createdAt">): string | null {
  const value = order.createdAt;
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : toLocalDateInput(date);
  }
  if (value === null || typeof value !== "object") return null;
  if (value instanceof Date) return toLocalDateInput(value);

  const timestamp = value as FirestoreTimestampLike;
  try {
    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return toLocalDateInput(date);
    }
    if (typeof timestamp.toMillis === "function") {
      const millis = timestamp.toMillis();
      if (typeof millis === "number" && Number.isFinite(millis)) return toLocalDateInput(new Date(millis));
    }
  } catch {
    return null;
  }

  if (typeof timestamp.seconds !== "number" || !Number.isFinite(timestamp.seconds)) return null;
  const nanoseconds = typeof timestamp.nanoseconds === "number" && Number.isFinite(timestamp.nanoseconds)
    ? timestamp.nanoseconds
    : 0;
  return toLocalDateInput(new Date(timestamp.seconds * 1000 + nanoseconds / 1_000_000));
}

function toLocalDateInput(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function filterOrdersByCreationPeriod<T extends Pick<Order, "createdAt">>(
  orders: readonly T[],
  period: FinancialControlPeriod,
): T[] {
  if (!isValidFinancialControlPeriod(period)) return [];
  return orders.filter((order) => {
    const createdOn = getOrderCreationDate(order);
    return createdOn !== null && createdOn >= period.from && createdOn <= period.through;
  });
}

export function compareFinancialControlValues(
  first: { clientName: string; date: string | null; valueCents: number },
  second: { clientName: string; date: string | null; valueCents: number },
  sort: FinancialControlSort,
): number {
  if (sort === "client") return first.clientName.localeCompare(second.clientName);
  if (sort === "value") return second.valueCents - first.valueCents || first.clientName.localeCompare(second.clientName);
  return (second.date ?? "").localeCompare(first.date ?? "") || first.clientName.localeCompare(second.clientName);
}

export function normalizeFinancialSearch(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function matchesFinancialSearch(query: string, clientName: string, orderId: string): boolean {
  const normalizedQuery = normalizeFinancialSearch(query).replace(/^#/, "");
  if (!normalizedQuery) return true;
  return normalizeFinancialSearch(clientName).includes(normalizedQuery)
    || normalizeFinancialSearch(orderId).includes(normalizedQuery);
}
