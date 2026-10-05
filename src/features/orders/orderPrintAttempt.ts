import { WAKE_TIMEOUT_MS } from "../diagnostics/androidPrintWakeResume";
import { encodePrintCompanionBase64 } from "../printers/printCompanionClient";
import type { PrinterConfiguration } from "../printers/printerTypes";

export const ORDER_PRINT_ATTEMPT_SESSION_KEY = "web-crm.order-print.attempt.v1";

export type OrderPrintPrinterSnapshot = Pick<
  PrinterConfiguration,
  | "id"
  | "name"
  | "model"
  | "transport"
  | "protocol"
  | "host"
  | "port"
  | "paperWidthMm"
  | "printableWidthDots"
  | "codePage"
  | "active"
>;

export interface OrderPrintAttempt {
  attemptId: string;
  createdAt: number;
  intent: "print";
  orderId: string;
  jobId: string;
  printer: OrderPrintPrinterSnapshot;
  bytesBase64: string;
}

export function createOrderPrintAttemptId() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getSessionStorage(storage?: Storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null) {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(ORDER_PRINT_ATTEMPT_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, value: OrderPrintAttempt) {
  storage?.setItem(ORDER_PRINT_ATTEMPT_SESSION_KEY, JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isValidPrinterSnapshot(value: unknown): value is OrderPrintPrinterSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.model === undefined || typeof value.model === "string") &&
    value.transport === "tcp" &&
    value.protocol === "escpos" &&
    typeof value.host === "string" &&
    Number.isInteger(value.port) &&
    typeof value.paperWidthMm === "number" &&
    (value.printableWidthDots === undefined || typeof value.printableWidthDots === "number") &&
    value.codePage === "cp1252" &&
    typeof value.active === "boolean"
  );
}

function isValidOrderPrintAttempt(value: unknown): value is OrderPrintAttempt {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.attemptId === "string" &&
    value.attemptId.length > 0 &&
    typeof value.createdAt === "number" &&
    Number.isFinite(value.createdAt) &&
    value.intent === "print" &&
    typeof value.orderId === "string" &&
    value.orderId.length > 0 &&
    typeof value.jobId === "string" &&
    value.jobId.length > 0 &&
    isValidPrinterSnapshot(value.printer) &&
    typeof value.bytesBase64 === "string" &&
    value.bytesBase64.length > 0
  );
}

export function createOrderPrintPrinterSnapshot(
  printer: PrinterConfiguration,
): OrderPrintPrinterSnapshot {
  return {
    id: printer.id,
    name: printer.name,
    ...(printer.model === undefined ? {} : { model: printer.model }),
    transport: printer.transport,
    protocol: printer.protocol,
    host: printer.host,
    port: printer.port,
    paperWidthMm: printer.paperWidthMm,
    ...(printer.printableWidthDots === undefined
      ? {}
      : { printableWidthDots: printer.printableWidthDots }),
    codePage: printer.codePage,
    active: printer.active,
  };
}

export function createOrderPrintAttempt({
  attemptId,
  orderId,
  jobId,
  printer,
  bytes,
  createdAt = Date.now(),
}: {
  attemptId: string;
  orderId: string;
  jobId: string;
  printer: PrinterConfiguration;
  bytes: Uint8Array;
  createdAt?: number;
}): OrderPrintAttempt {
  return {
    attemptId,
    createdAt,
    intent: "print",
    orderId,
    jobId,
    printer: createOrderPrintPrinterSnapshot(printer),
    bytesBase64: encodePrintCompanionBase64(bytes),
  };
}

export function decodeOrderPrintAttemptBytes(attempt: OrderPrintAttempt) {
  const binary = globalThis.atob(attempt.bytesBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function loadOrderPrintAttempt(storage?: Storage): OrderPrintAttempt | null {
  const value = readJson(getSessionStorage(storage));
  return isValidOrderPrintAttempt(value) ? value : null;
}

export function loadFreshOrderPrintAttempt(
  storage?: Storage,
  now = Date.now(),
): OrderPrintAttempt | null {
  const attempt = loadOrderPrintAttempt(storage);
  if (!attempt) {
    return null;
  }

  if (Math.max(0, now - attempt.createdAt) >= WAKE_TIMEOUT_MS) {
    clearOrderPrintAttemptIfMatches(attempt.attemptId, storage);
    return null;
  }

  return attempt;
}

export function saveOrderPrintAttempt(
  attempt: OrderPrintAttempt,
  storage?: Storage,
) {
  writeJson(getSessionStorage(storage), attempt);
}

export function clearOrderPrintAttemptIfMatches(
  attemptId: string,
  storage?: Storage,
) {
  const current = loadOrderPrintAttempt(storage);
  if (!current || current.attemptId !== attemptId) {
    return false;
  }

  getSessionStorage(storage)?.removeItem(ORDER_PRINT_ATTEMPT_SESSION_KEY);
  return true;
}
