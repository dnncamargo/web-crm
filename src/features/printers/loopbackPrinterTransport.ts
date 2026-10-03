import type { PrinterTransport } from "./printerTransport";
import { PrinterTransportError } from "./printerTransport";

export const DEFAULT_PRINT_BRIDGE_URL = "http://127.0.0.1:17890";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

interface BridgeFailureResponse {
  ok: false;
  code: string;
  message: string;
}

export interface LoopbackPrinterTransportOptions {
  bridgeUrl?: string;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

export interface LoopbackPrinterTransport extends PrinterTransport {
  checkHealth(): Promise<void>;
}

function isBridgeFailureResponse(value: unknown): value is BridgeFailureResponse {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.ok === false &&
    typeof candidate.code === "string" &&
    typeof candidate.message === "string"
  );
}

function isBridgeSuccessResponse(value: unknown): value is { ok: true } {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).ok === true
  );
}

function normalizeBridgeUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("A URL da ponte de impressão é inválida.");
  }

  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("A ponte de impressão deve usar HTTP em 127.0.0.1.");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error("A URL da ponte de impressão não pode conter credenciais ou parâmetros.");
  }

  return url.toString().replace(/\/$/, "");
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function mapBridgeFailure(
  response: BridgeFailureResponse,
  status: number,
): PrinterTransportError {
  if (response.code === "printer_unreachable" || response.code === "printer_timeout") {
    return new PrinterTransportError(
      "printer-connection-failed",
      response.message,
      status,
    );
  }

  return new PrinterTransportError("bridge-rejected", response.message, status);
}

export function createLoopbackPrinterTransport(
  options: LoopbackPrinterTransportOptions = {},
): LoopbackPrinterTransport {
  const bridgeUrl = normalizeBridgeUrl(
    options.bridgeUrl ?? import.meta.env.VITE_PRINT_BRIDGE_URL ?? DEFAULT_PRINT_BRIDGE_URL,
  );
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error("O timeout da ponte de impressão deve ser um inteiro positivo.");
  }

  async function request(path: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response: Response;

    try {
      response = await fetchImpl(`${bridgeUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "A ponte local de impressão excedeu o tempo limite."
          : "A ponte local de impressão está indisponível. Inicie o helper local e tente novamente.";

      throw new PrinterTransportError("bridge-unavailable", message);
    } finally {
      clearTimeout(timeoutId);
    }

    let body: unknown;

    try {
      body = await response.json();
    } catch {
      throw new PrinterTransportError(
        "bridge-malformed-response",
        "A ponte local retornou uma resposta inválida.",
        response.status,
      );
    }

    if (isBridgeFailureResponse(body)) {
      throw mapBridgeFailure(body, response.status);
    }

    if (!response.ok || !isBridgeSuccessResponse(body)) {
      throw new PrinterTransportError(
        "bridge-malformed-response",
        "A ponte local retornou um protocolo inválido.",
        response.status,
      );
    }
  }

  return {
    async checkHealth() {
      await request("/v1/health", { method: "GET" });
    },

    async testConnection(destination) {
      await request("/v1/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(destination),
      });
    },

    async print(destination, bytes) {
      if (bytes.length === 0) {
        throw new PrinterTransportError(
          "bridge-rejected",
          "Não é possível enviar um trabalho de impressão vazio.",
        );
      }

      await request("/v1/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...destination, data: encodeBase64(bytes) }),
      });
    },
  };
}
