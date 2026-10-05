import type {
  PrintCompanionConfig,
  PrintCompanionIntent,
  PrintCompanionToken,
} from "./printCompanionTypes";
import { PRINT_COMPANION_API_VERSION } from "./printCompanionTypes";
import { WAKE_TIMEOUT_MS } from "../diagnostics/androidPrintWakeResume";

export const PRINT_COMPANION_TOKEN_STORAGE_KEY = "web-crm.print-companion.auth.v1";
export const PRINT_COMPANION_CONFIG_STORAGE_KEY = "web-crm.print-companion.config.v1";
export const PRINT_COMPANION_WAKE_SESSION_KEY = "web-crm.print-companion.wake.v1";

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 15 as const;
export const MIN_IDLE_TIMEOUT_MINUTES = 1 as const;
export const MAX_IDLE_TIMEOUT_MINUTES = 120 as const;

export interface PendingPrintCompanionWake {
  attemptId: string;
  nonce: string;
  createdAt: number;
  intent: PrintCompanionIntent;
}

export interface FreshPendingPrintCompanionWake {
  pending: PendingPrintCompanionWake | null;
  staleAgeMs?: number;
}

function getStorage(
  storage: Storage | undefined,
  kind: "localStorage" | "sessionStorage",
) {
  if (storage) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown) {
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function isValidPrintCompanionToken(value: unknown): value is PrintCompanionToken {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    candidate.apiVersion === PRINT_COMPANION_API_VERSION
  );
}

export function loadPrintCompanionToken(storage?: Storage): PrintCompanionToken | null {
  const value = readJson(
    getStorage(storage, "localStorage"),
    PRINT_COMPANION_TOKEN_STORAGE_KEY,
  );

  return isValidPrintCompanionToken(value) ? value : null;
}

export function savePrintCompanionToken(
  token: PrintCompanionToken,
  storage?: Storage,
) {
  if (!isValidPrintCompanionToken(token)) {
    throw new Error("O token do companion é inválido.");
  }

  writeJson(
    getStorage(storage, "localStorage"),
    PRINT_COMPANION_TOKEN_STORAGE_KEY,
    token,
  );
}

export function clearPrintCompanionToken(storage?: Storage) {
  getStorage(storage, "localStorage")?.removeItem(PRINT_COMPANION_TOKEN_STORAGE_KEY);
}

export function isValidPrintCompanionConfig(value: unknown): value is PrintCompanionConfig {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const idleTimeoutMinutes = (value as Record<string, unknown>).idleTimeoutMinutes;
  return (
    typeof idleTimeoutMinutes === "number" &&
    Number.isInteger(idleTimeoutMinutes) &&
    idleTimeoutMinutes >= MIN_IDLE_TIMEOUT_MINUTES &&
    idleTimeoutMinutes <= MAX_IDLE_TIMEOUT_MINUTES
  );
}

export function loadPrintCompanionConfig(storage?: Storage): PrintCompanionConfig {
  const value = readJson(
    getStorage(storage, "localStorage"),
    PRINT_COMPANION_CONFIG_STORAGE_KEY,
  );

  return isValidPrintCompanionConfig(value)
    ? value
    : { idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES };
}

export function savePrintCompanionConfig(
  config: PrintCompanionConfig,
  storage?: Storage,
) {
  if (!isValidPrintCompanionConfig(config)) {
    throw new Error("A configuração de inatividade do companion é inválida.");
  }

  writeJson(
    getStorage(storage, "localStorage"),
    PRINT_COMPANION_CONFIG_STORAGE_KEY,
    config,
  );
}

export function loadPendingPrintCompanionWake(storage?: Storage): PendingPrintCompanionWake | null {
  const value = readJson(
    getStorage(storage, "sessionStorage"),
    PRINT_COMPANION_WAKE_SESSION_KEY,
  );

  if (
    value === null ||
    typeof value !== "object" ||
    typeof (value as Record<string, unknown>).nonce !== "string" ||
    (value as Record<string, unknown>).nonce === "" ||
    typeof (value as Record<string, unknown>).createdAt !== "number" ||
    !Number.isFinite((value as Record<string, unknown>).createdAt)
  ) {
    return null;
  }

  const intent = (value as Record<string, unknown>).intent;
  const attemptId = (value as Record<string, unknown>).attemptId;
  if (
    typeof attemptId !== "string" ||
    attemptId.length === 0 ||
    (intent !== "test" && intent !== "print")
  ) {
    return null;
  }

  return {
    attemptId,
    nonce: (value as Record<string, unknown>).nonce as string,
    createdAt: (value as Record<string, unknown>).createdAt as number,
    intent: intent === "print" ? "print" : "test",
  };
}

export function clearPendingPrintCompanionWakeIfMatches(
  attemptId: string,
  storage?: Storage,
) {
  const current = loadPendingPrintCompanionWake(storage);
  if (!current || current.attemptId !== attemptId) {
    return false;
  }

  getStorage(storage, "sessionStorage")?.removeItem(PRINT_COMPANION_WAKE_SESSION_KEY);
  return true;
}

export function inspectFreshPendingPrintCompanionWake(
  storage?: Storage,
  now = Date.now(),
): FreshPendingPrintCompanionWake {
  const pending = loadPendingPrintCompanionWake(storage);
  if (!pending) {
    return { pending: null };
  }

  const ageMs = Math.max(0, now - pending.createdAt);
  if (ageMs >= WAKE_TIMEOUT_MS) {
    clearPendingPrintCompanionWakeIfMatches(pending.attemptId, storage);
    return { pending: null, staleAgeMs: ageMs };
  }

  return { pending };
}

export function loadFreshPendingPrintCompanionWake(
  storage?: Storage,
  now = Date.now(),
) {
  return inspectFreshPendingPrintCompanionWake(storage, now).pending;
}

export function savePendingPrintCompanionWake(
  wake: PendingPrintCompanionWake,
  storage?: Storage,
) {
  writeJson(
    getStorage(storage, "sessionStorage"),
    PRINT_COMPANION_WAKE_SESSION_KEY,
    wake,
  );
}
