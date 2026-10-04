import type { PrinterConfiguration } from "./printerTypes";
import type { PendingPrintCompanionWake } from "./printCompanionStorage";
import {
  clearPendingPrintCompanionWake,
  clearPrintCompanionToken,
  loadPendingPrintCompanionWake,
  loadPrintCompanionConfig,
  loadPrintCompanionToken,
  savePendingPrintCompanionWake,
  savePrintCompanionToken,
} from "./printCompanionStorage";
import {
  PRINT_COMPANION_API_VERSION,
  PRINT_COMPANION_APP_LINK,
  PRINT_COMPANION_ORIGIN,
  PRINT_COMPANION_PACKAGE,
  PrintCompanionError,
  type PrintCompanionCapability,
  type PrintCompanionConfig,
  type PrintCompanionHealth,
  type PrintCompanionIntent,
  type PrintCompanionOperationResult,
  type PrintCompanionToken,
} from "./printCompanionTypes";
import {
  WAKE_HEALTH_REQUEST_TIMEOUT_MS,
  WAKE_TIMEOUT_MS,
  waitForWakeResume,
  type WakePollProgress,
  type WakePollResult,
} from "../diagnostics/androidPrintWakeResume";

export const DEFAULT_PRINT_COMPANION_URL = "http://127.0.0.1:17890";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

interface CompanionFailure {
  ok: false;
  code: string;
  message?: string;
}

export interface PrintCompanionClientOptions {
  bridgeUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
  localStorage?: Storage;
  sessionStorage?: Storage;
  locationAssign?: (url: string) => void;
}

export interface PrintCompanionReadyOptions {
  requiredCapabilities?: PrintCompanionCapability[];
  config?: PrintCompanionConfig;
  onPollAttempt?: (progress: WakePollProgress) => void;
  onPollResult?: (result: WakePollResult) => void;
  onStageChange?: (stage: "health" | "pair" | "config") => void;
  onStageResult?: (
    stage: "pair" | "config",
    result: "success" | "failure",
    publicCode?: string,
  ) => void;
  onHealthReady?: (health: PrintCompanionHealth) => void;
}

export interface PrintCompanionWakeIntent {
  nonce: string;
  intentUrl: string;
  fallbackUrl: string;
  pending: Omit<PendingPrintCompanionWake, "createdAt">;
}

export interface PrintCompanionClient {
  health(timeoutMs?: number): Promise<PrintCompanionHealth>;
  prepareWakeIntent(intent?: PrintCompanionIntent): PrintCompanionWakeIntent;
  activatePreparedWake(wakeIntent: PrintCompanionWakeIntent): void;
  startWakeFromUserGesture(intent?: PrintCompanionIntent): { nonce: string; url: string };
  resumePendingWake(options?: PrintCompanionReadyOptions): Promise<PrintCompanionHealth>;
  wake(): { nonce: string; url: string };
  pair(nonce: string): Promise<PrintCompanionToken>;
  configure(config?: PrintCompanionConfig): Promise<PrintCompanionOperationResult>;
  testPrinter(printer: PrinterConfiguration): Promise<PrintCompanionOperationResult>;
  print(
    printer: PrinterConfiguration,
    bytes: Uint8Array,
    jobId?: string,
  ): Promise<PrintCompanionOperationResult>;
  ensureCompanionReady(options?: PrintCompanionReadyOptions): Promise<PrintCompanionHealth>;
}

function normalizeBridgeUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("A URL do companion é inválida.");
  }

  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("O companion deve usar HTTP em 127.0.0.1.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("A URL do companion não pode conter credenciais ou parâmetros.");
  }

  return url.toString().replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isCompanionFailure(value: unknown): value is CompanionFailure {
  return (
    isRecord(value) &&
    value.ok === false &&
    typeof value.code === "string"
  );
}

function sanitizeMessage(message: string, secrets: string[]) {
  let sanitized = message;

  for (const secret of secrets) {
    if (secret) {
      sanitized = sanitized.split(secret).join("[redacted]");
    }
  }

  return sanitized.replace(/(bearer\s+|token\s*[=:]\s*|nonce\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]");
}

function getPublicErrorCode(error: unknown) {
  if (error instanceof PrintCompanionError) {
    return error.companionCode ?? error.code;
  }

  return "unknown_error";
}

function mapCompanionCode(code: string, status?: number) {
  if (status === 401 || code === "invalid_token") {
    return "invalid_token" as const;
  }

  if (code === "origin_not_allowed" || code === "invalid_origin") {
    return "invalid_origin" as const;
  }

  if (code === "pairing_required") {
    return "pairing_required" as const;
  }

  if (code === "pairing_expired" || code === "nonce_expired") {
    return "pairing_expired" as const;
  }

  if (code === "queue_full") {
    return "queue_full" as const;
  }

  if (code === "job_in_progress") {
    return "job_in_progress" as const;
  }

  if (code === "job_id_conflict") {
    return "job_id_conflict" as const;
  }

  if (code === "printer_timeout") {
    return "printer_timeout" as const;
  }

  if (code === "printer_unreachable" || code === "printer_connection_failed") {
    return "printer_connection_failed" as const;
  }

  if (code === "payload_too_large") {
    return "payload_too_large" as const;
  }

  if (code === "service_stopping") {
    return "service_stopping" as const;
  }

  return "companion_offline" as const;
}

function createNonce() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPrintJobId() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function encodePrintCompanionBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary);
}

export async function sha256Hex(bytes: Uint8Array) {
  const input = new Uint8Array(bytes.byteLength);
  input.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidHealth(value: unknown): value is PrintCompanionHealth {
  return (
    isRecord(value) &&
    value.ok === true &&
    typeof value.state === "string" &&
    typeof value.appVersion === "string" &&
    typeof value.appVersionCode === "number" &&
    typeof value.apiVersion === "string" &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === "string") &&
    typeof value.paired === "boolean"
  );
}

function isValidOperationResult(value: unknown): value is PrintCompanionOperationResult {
  return isRecord(value) && value.ok === true;
}

function isValidPairResponse(value: unknown): value is { ok: true; token: string; apiVersion: string } {
  return (
    isRecord(value) &&
    value.ok === true &&
    typeof value.token === "string" &&
    typeof value.apiVersion === "string"
  );
}

export function createPrintCompanionClient(
  options: PrintCompanionClientOptions = {},
): PrintCompanionClient {
  const bridgeUrl = normalizeBridgeUrl(
    options.bridgeUrl ?? import.meta.env.VITE_PRINT_BRIDGE_URL ?? DEFAULT_PRINT_COMPANION_URL,
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const origin = PRINT_COMPANION_ORIGIN;
  const localStorage = options.localStorage;
  const sessionStorage = options.sessionStorage;
  const locationAssign = options.locationAssign ?? ((url: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(url);
    }
  });
  let resumePromise: Promise<PrintCompanionHealth> | null = null;

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error("O timeout do companion deve ser um inteiro positivo.");
  }

  function getFreshPendingWake() {
    const pendingWake = loadPendingPrintCompanionWake(sessionStorage);
    if (!pendingWake || Date.now() - pendingWake.createdAt > WAKE_TIMEOUT_MS) {
      if (pendingWake) {
        clearPendingPrintCompanionWake(sessionStorage);
      }
      return null;
    }

    return pendingWake;
  }

  async function request(
    path: string,
    init: RequestInit = {},
    token?: string,
    extraSecrets: string[] = [],
    timeoutMs = requestTimeoutMs,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;

    try {
      response = await fetchImpl(`${bridgeUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "O companion excedeu o tempo limite."
        : "O companion está offline.";
      throw new PrintCompanionError("companion_offline", message, {
        cause: error,
        companionCode: error instanceof DOMException && error.name === "AbortError"
          ? "local_timeout"
          : undefined,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PrintCompanionError(
        "protocol_error",
        "O companion retornou uma resposta inválida.",
        { status: response.status },
      );
    }

    if (!response.ok || isCompanionFailure(body)) {
      const companionCode = isCompanionFailure(body) ? body.code : `http_${response.status}`;
      const message = isCompanionFailure(body) && typeof body.message === "string"
        ? body.message
        : "O companion recusou a operação.";
      throw new PrintCompanionError(
        mapCompanionCode(companionCode, response.status),
        sanitizeMessage(message, [token ?? "", ...extraSecrets]),
        { companionCode, status: response.status },
      );
    }

    return body;
  }

  function validateHealth(health: PrintCompanionHealth, requiredCapabilities: string[]) {
    if (health.apiVersion !== PRINT_COMPANION_API_VERSION) {
      throw new PrintCompanionError(
        "companion_incompatible",
        "A versão da API do companion não é compatível.",
      );
    }

    if (health.state !== "RUNNING") {
      throw new PrintCompanionError(
        "service_stopping",
        "O companion está encerrando o serviço.",
      );
    }

    const missingCapability = requiredCapabilities.find(
      (capability) => !health.capabilities.includes(capability),
    );
    if (missingCapability) {
      throw new PrintCompanionError(
        "missing_capability",
        `O companion não oferece a capacidade necessária: ${missingCapability}.`,
        { companionCode: missingCapability },
      );
    }
  }

  async function health(timeoutMs = requestTimeoutMs) {
    const body = await request("/v1/health", { method: "GET" }, undefined, [], timeoutMs);
    if (!isValidHealth(body)) {
      throw new PrintCompanionError(
        "protocol_error",
        "A resposta de health do companion é inválida.",
      );
    }

    return body;
  }

  function prepareWakeIntent(intent: PrintCompanionIntent = "test"): PrintCompanionWakeIntent {
    const nonce = createNonce();
    const pending = { nonce, intent };
    const fallbackUrl = PRINT_COMPANION_APP_LINK;
    const intentUrl = `intent://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=${encodeURIComponent(nonce)}#Intent;scheme=https;package=${PRINT_COMPANION_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
    return { nonce, intentUrl, fallbackUrl, pending };
  }

  function activatePreparedWake(wakeIntent: PrintCompanionWakeIntent) {
    savePendingPrintCompanionWake({
      nonce: wakeIntent.nonce,
      createdAt: Date.now(),
      intent: wakeIntent.pending.intent,
    }, sessionStorage);
  }

  function startWakeFromUserGesture(intent: PrintCompanionIntent = "test") {
    const wakeIntent = prepareWakeIntent(intent);
    activatePreparedWake(wakeIntent);
    locationAssign(wakeIntent.intentUrl);
    return { nonce: wakeIntent.nonce, url: wakeIntent.intentUrl };
  }

  function wake() {
    return startWakeFromUserGesture("test");
  }

  async function pair(nonce: string, clearPending = true) {
    if (!nonce) {
      throw new PrintCompanionError("pairing_expired", "A ativação do companion expirou.");
    }

    const body = await request(
      "/v1/pair",
      {
        method: "POST",
        headers: { Origin: origin },
        body: JSON.stringify({ nonce, origin }),
      },
      undefined,
      [nonce],
    );

    if (!isValidPairResponse(body) || body.apiVersion !== PRINT_COMPANION_API_VERSION) {
      throw new PrintCompanionError(
        "protocol_error",
        "A resposta de pairing do companion é inválida.",
      );
    }

    const pairedToken: PrintCompanionToken = {
      token: body.token,
      apiVersion: PRINT_COMPANION_API_VERSION,
    };
    savePrintCompanionToken(pairedToken, localStorage);
    if (clearPending) {
      clearPendingPrintCompanionWake(sessionStorage);
    }
    return pairedToken;
  }

  async function ensureCompanionReady(readyOptions: PrintCompanionReadyOptions = {}) {
    const requiredCapabilities = readyOptions.requiredCapabilities ?? [];
    const healthResult = await health();
    validateHealth(healthResult, requiredCapabilities);

    if (!loadPrintCompanionToken(localStorage)) {
      throw new PrintCompanionError(
        "pairing_required",
        "O companion precisa ser pareado. Toque em ativar para abrir o aplicativo.",
      );
    }

    if (readyOptions.config) {
      await requestConfigWithRecovery(readyOptions.config);
    }

    return healthResult;
  }

  async function resumePendingWake(readyOptions: PrintCompanionReadyOptions = {}) {
    if (resumePromise) {
      return resumePromise;
    }

    resumePromise = (async () => {
      try {
        const pendingWake = getFreshPendingWake();
        if (!pendingWake) {
          throw new PrintCompanionError(
            "pairing_expired",
            "A ativação do companion expirou.",
            { companionCode: "wake_timeout" },
          );
        }

        readyOptions.onStageChange?.("health");
        const healthResult = await waitForWakeResume(
          async () => {
            const remainingMs = Math.max(1, pendingWake.createdAt + WAKE_TIMEOUT_MS - Date.now());
            const value = await health(Math.min(WAKE_HEALTH_REQUEST_TIMEOUT_MS, remainingMs));
            if (value.apiVersion !== PRINT_COMPANION_API_VERSION) {
              throw new PrintCompanionError(
                "companion_incompatible",
                "A versão da API do companion não é compatível.",
              );
            }
            return value;
          },
          (value) => value.state === "RUNNING",
          {
            clearPendingWakeOnSuccess: false,
            onPollAttempt: readyOptions.onPollAttempt,
            onPollResult: readyOptions.onPollResult,
            startedAt: pendingWake.createdAt,
            isTransientError: (error) =>
              !(error instanceof PrintCompanionError &&
                (error.code === "protocol_error" || error.code === "companion_incompatible")),
          },
        );
        readyOptions.onHealthReady?.(healthResult);
        validateHealth(healthResult, readyOptions.requiredCapabilities ?? []);

        if (!loadPrintCompanionToken(localStorage)) {
          readyOptions.onStageChange?.("pair");
          try {
            await pair(pendingWake.nonce, false);
            readyOptions.onStageResult?.("pair", "success");
          } catch (error) {
            readyOptions.onStageResult?.("pair", "failure", getPublicErrorCode(error));
            throw error;
          }
        }

        if (readyOptions.config) {
          readyOptions.onStageChange?.("config");
          try {
            await requestConfigWithRecovery(readyOptions.config);
            readyOptions.onStageResult?.("config", "success");
          } catch (error) {
            readyOptions.onStageResult?.("config", "failure", getPublicErrorCode(error));
            throw error;
          }
        }

        clearPendingPrintCompanionWake(sessionStorage);
        return healthResult;
      } catch (error) {
        clearPendingPrintCompanionWake(sessionStorage);
        if (error instanceof Error && error.message === "A ativação do companion expirou.") {
          throw new PrintCompanionError(
            "pairing_expired",
            "A ativação do companion expirou.",
            { cause: error, companionCode: "wake_timeout" },
          );
        }
        throw error;
      } finally {
        resumePromise = null;
      }
    })();

    return resumePromise;
  }

  async function withAuthRecovery<T>(operation: (token: string) => Promise<T>) {
    const token = loadPrintCompanionToken(localStorage);
    if (!token) {
      throw new PrintCompanionError("pairing_required", "O companion precisa ser pareado.");
    }

    try {
      return await operation(token.token);
    } catch (error) {
      if (!(error instanceof PrintCompanionError) || error.code !== "invalid_token") {
        throw error;
      }

      clearPrintCompanionToken(localStorage);
      throw new PrintCompanionError(
        "pairing_required",
        "O pareamento do companion expirou. Toque em ativar para parear novamente.",
        { companionCode: "invalid_token" },
      );
    }
  }

  async function requestConfigWithRecovery(config: PrintCompanionConfig) {
    return withAuthRecovery(async (token) => {
      const body = await request(
        "/v1/config",
        { method: "PUT", body: JSON.stringify(config) },
        token,
      );
      if (!isValidOperationResult(body)) {
        throw new PrintCompanionError("protocol_error", "A resposta de config do companion é inválida.");
      }
      return body;
    });
  }

  return {
    health,
    prepareWakeIntent,
    activatePreparedWake,
    startWakeFromUserGesture,
    resumePendingWake,
    wake,
    pair,
    async configure(config = loadPrintCompanionConfig(localStorage)) {
      await ensureCompanionReady({ requiredCapabilities: ["config"] });
      return requestConfigWithRecovery(config);
    },
    async testPrinter(printer) {
      await ensureCompanionReady({ requiredCapabilities: ["test"] });
      return withAuthRecovery(async (token) => {
        const body = await request(
          "/v1/test",
          {
            method: "POST",
            body: JSON.stringify({ host: printer.host, port: printer.port }),
          },
          token,
        );
        if (!isValidOperationResult(body)) {
          throw new PrintCompanionError("protocol_error", "A resposta de test do companion é inválida.");
        }
        return body;
      });
    },
    async print(printer, bytes, jobId = createPrintJobId()) {
      await ensureCompanionReady({
        requiredCapabilities: ["config", "print"],
      });

      const data = encodePrintCompanionBase64(bytes);
      const sha256 = await sha256Hex(bytes);
      const config = loadPrintCompanionConfig(localStorage);

      return withAuthRecovery(async (token) => {
        const configBody = await request(
          "/v1/config",
          { method: "PUT", body: JSON.stringify(config) },
          token,
        );
        if (!isValidOperationResult(configBody)) {
          throw new PrintCompanionError("protocol_error", "A resposta de config do companion é inválida.");
        }

        const body = await request(
          "/v1/print",
          {
            method: "POST",
            body: JSON.stringify({
              jobId,
              host: printer.host,
              port: printer.port,
              data,
              sha256,
            }),
          },
          token,
        );
        if (!isValidOperationResult(body)) {
          throw new PrintCompanionError("protocol_error", "A resposta de print do companion é inválida.");
        }
        return body;
      });
    },
    ensureCompanionReady,
  };
}
