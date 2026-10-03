import http from "node:http";
import net from "node:net";
import { pathToFileURL } from "node:url";
import process from "node:process";

export const PRINT_BRIDGE_VERSION = "v1";
export const DEFAULT_PRINT_BRIDGE_PORT = 17890;
export const DEFAULT_PRINTER_TIMEOUT_MS = 5_000;
export const MAX_BODY_BYTES = 1_048_576;

const LOOPBACK_HOST = "127.0.0.1";
const JSON_CONTENT_TYPE = "application/json";
const ALLOWED_METHODS = "GET, POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";

class BridgeRequestError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function jsonHeaders(origin, allowedOrigins) {
  const headers = {
    "Content-Type": `${JSON_CONTENT_TYPE}; charset=utf-8`,
    "Cache-Control": "no-store",
  };

  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function sendJson(response, status, body, origin, allowedOrigins) {
  response.writeHead(status, jsonHeaders(origin, allowedOrigins));
  response.end(JSON.stringify(body));
}

function sendSuccess(response, origin, allowedOrigins, extra = {}) {
  sendJson(response, 200, { ok: true, ...extra }, origin, allowedOrigins);
}

function sendFailure(response, error, origin, allowedOrigins) {
  sendJson(
    response,
    error.status ?? 500,
    { ok: false, code: error.code ?? "bridge_internal_error", message: error.message },
    origin,
    allowedOrigins,
  );
}

function ensureOriginAllowed(response, origin, allowedOrigins) {
  if (origin && !allowedOrigins.has(origin)) {
    sendFailure(
      response,
      new BridgeRequestError(
        "origin_not_allowed",
        "A origem do navegador não está autorizada para esta ponte.",
        403,
      ),
      origin,
      allowedOrigins,
    );
    return false;
  }

  return true;
}

function sendPreflight(response, origin, allowedOrigins) {
  response.writeHead(204, {
    ...jsonHeaders(origin, allowedOrigins),
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Max-Age": "600",
  });
  response.end();
}

async function readBody(request) {
  const contentLength = Number(request.headers["content-length"] ?? 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new BridgeRequestError(
      "body_too_large",
      "O corpo da solicitação excede o limite permitido.",
      413,
    );
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;

    if (total > MAX_BODY_BYTES) {
      throw new BridgeRequestError(
        "body_too_large",
        "O corpo da solicitação excede o limite permitido.",
        413,
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const body = await readBody(request);

  try {
    return JSON.parse(body);
  } catch {
    throw new BridgeRequestError("malformed_json", "O corpo JSON é inválido.");
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateDestination(payload) {
  if (!isRecord(payload)) {
    throw new BridgeRequestError("invalid_request", "A solicitação deve ser um objeto JSON.");
  }

  const { host, port } = payload;

  if (typeof host !== "string" || !isValidHost(host)) {
    throw new BridgeRequestError("invalid_request", "O host da impressora é inválido.");
  }

  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new BridgeRequestError(
      "invalid_request",
      "A porta da impressora deve ser um inteiro entre 1 e 65535.",
    );
  }

  return { host, port };
}

function isValidHost(host) {
  if (!host || host.length > 253 || host.trim() !== host || /[\u0000-\u0020]/u.test(host)) {
    return false;
  }

  if (net.isIP(host) !== 0) {
    return true;
  }

  return host.split(".").every((label) => {
    if (!label || label.length > 63 || label.startsWith("-") || label.endsWith("-")) {
      return false;
    }

    return /^[a-zA-Z0-9-]+$/u.test(label);
  });
}

function decodePrintData(payload) {
  if (!isRecord(payload) || typeof payload.data !== "string" || !payload.data) {
    throw new BridgeRequestError(
      "invalid_request",
      "O payload de impressão deve conter dados base64 não vazios.",
    );
  }

  const { data } = payload;

  if (data.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(data)) {
    throw new BridgeRequestError("invalid_request", "Os dados de impressão não são base64 válidos.");
  }

  const bytes = Buffer.from(data, "base64");

  if (bytes.length === 0 || bytes.toString("base64") !== data) {
    throw new BridgeRequestError("invalid_request", "Os dados de impressão não são base64 válidos.");
  }

  return bytes;
}

function printerError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 502;
  return error;
}

function sendToPrinter(destination, payload, timeoutMs, createConnection = net.createConnection) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: destination.host, port: destination.port });
    let settled = false;

    function succeed() {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve();
    }

    function fail(code, message) {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      reject(printerError(code, message));
    }

    socket.setTimeout(timeoutMs, () => {
      fail("printer_timeout", "A conexão com a impressora excedeu o tempo limite.");
    });

    socket.once("connect", () => {
      if (payload) {
        socket.end(payload);
      } else {
        socket.end();
      }
    });

    socket.once("finish", succeed);
    socket.once("error", (error) => {
      if (error.code === "ETIMEDOUT") {
        fail("printer_timeout", "A conexão com a impressora excedeu o tempo limite.");
        return;
      }

      fail("printer_unreachable", "Não foi possível conectar à impressora configurada.");
    });
  });
}

function normalizeOptions(options) {
  const allowedOrigins = new Set(options.allowedOrigins ?? []);

  if (allowedOrigins.size === 0) {
    throw new Error("Informe ao menos uma origem autorizada para a ponte de impressão.");
  }

  const port = options.port ?? DEFAULT_PRINT_BRIDGE_PORT;
  const printerTimeoutMs = options.printerTimeoutMs ?? DEFAULT_PRINTER_TIMEOUT_MS;

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("A porta local deve ser um inteiro entre 0 e 65535.");
  }

  if (!Number.isInteger(printerTimeoutMs) || printerTimeoutMs <= 0) {
    throw new Error("O timeout da impressora deve ser um inteiro positivo.");
  }

  return { allowedOrigins, port, printerTimeoutMs };
}

export async function startPrintBridge(options) {
  const { allowedOrigins, port, printerTimeoutMs } = normalizeOptions(options);
  const createConnection = options.createConnection ?? net.createConnection;
  const server = http.createServer((request, response) => {
    void handleRequest(request, response, allowedOrigins, printerTimeoutMs, createConnection).catch((error) => {
      sendFailure(response, error, request.headers.origin, allowedOrigins);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: LOOPBACK_HOST, port }, resolve);
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;

  return {
    host: LOOPBACK_HOST,
    port: actualPort,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function handleRequest(request, response, allowedOrigins, printerTimeoutMs, createConnection) {
  const origin = request.headers.origin;

  if (!ensureOriginAllowed(response, origin, allowedOrigins)) {
    return;
  }

  if (request.method === "OPTIONS") {
    if (!origin) {
      sendFailure(
        response,
        new BridgeRequestError("origin_required", "A preflight exige uma origem do navegador.", 403),
        origin,
        allowedOrigins,
      );
      return;
    }

    const requestedMethod = request.headers["access-control-request-method"]?.toUpperCase();
    const requestedHeaders = request.headers["access-control-request-headers"]
      ?.split(",")
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean) ?? [];

    if (requestedMethod && !["GET", "POST"].includes(requestedMethod)) {
      sendFailure(
        response,
        new BridgeRequestError("method_not_allowed", "Método HTTP não permitido.", 405),
        origin,
        allowedOrigins,
      );
      return;
    }

    if (requestedHeaders.some((header) => header !== "content-type")) {
      sendFailure(
        response,
        new BridgeRequestError("headers_not_allowed", "Cabeçalho HTTP não permitido.", 403),
        origin,
        allowedOrigins,
      );
      return;
    }

    sendPreflight(response, origin, allowedOrigins);
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${LOOPBACK_HOST}`);

  if (request.method === "GET" && requestUrl.pathname === "/v1/health") {
    sendSuccess(response, origin, allowedOrigins, { version: PRINT_BRIDGE_VERSION });
    return;
  }

  if (requestUrl.pathname !== "/v1/test" && requestUrl.pathname !== "/v1/print") {
    sendFailure(
      response,
      new BridgeRequestError("not_found", "Endpoint não encontrado.", 404),
      origin,
      allowedOrigins,
    );
    return;
  }

  if (request.method !== "POST") {
    sendFailure(
      response,
      new BridgeRequestError("method_not_allowed", "Método HTTP não permitido.", 405),
      origin,
      allowedOrigins,
    );
    return;
  }

  const contentType = request.headers["content-type"] ?? "";

  if (!contentType.toLowerCase().startsWith(JSON_CONTENT_TYPE)) {
    sendFailure(
      response,
      new BridgeRequestError("unsupported_media_type", "Use Content-Type application/json.", 415),
      origin,
      allowedOrigins,
    );
    return;
  }

  const payload = await readJsonBody(request);
  const destination = validateDestination(payload);
  const bytes = requestUrl.pathname === "/v1/print" ? decodePrintData(payload) : undefined;

  try {
    await sendToPrinter(destination, bytes, printerTimeoutMs, createConnection);
  } catch (error) {
    if (error?.code === "printer_timeout") {
      sendFailure(response, error, origin, allowedOrigins);
      return;
    }

    sendFailure(
      response,
      printerError("printer_unreachable", "Não foi possível conectar à impressora configurada."),
      origin,
      allowedOrigins,
    );
    return;
  }

  sendSuccess(response, origin, allowedOrigins);
}

function parseCliOptions(args) {
  const allowedOrigins = [];
  let port = Number(process.env.PRINT_BRIDGE_PORT ?? DEFAULT_PRINT_BRIDGE_PORT);
  let printerTimeoutMs = Number(process.env.PRINT_BRIDGE_TIMEOUT_MS ?? DEFAULT_PRINTER_TIMEOUT_MS);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === "--allowed-origin") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("--allowed-origin exige um valor.");
      }

      allowedOrigins.push(value);
      index += 1;
      continue;
    }

    if (argument === "--port") {
      port = Number(args[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--printer-timeout-ms") {
      printerTimeoutMs = Number(args[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Argumento não reconhecido: ${argument}`);
  }

  const environmentOrigins = process.env.PRINT_BRIDGE_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return {
    allowedOrigins: [...allowedOrigins, ...environmentOrigins],
    port,
    printerTimeoutMs,
  };
}

const isMainModule = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  try {
    const bridge = await startPrintBridge(parseCliOptions(process.argv.slice(2)));
    console.log(`Print bridge listening on http://${LOOPBACK_HOST}:${bridge.port}`);

    const shutdown = async () => {
      await bridge.close();
      process.exit(0);
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Não foi possível iniciar a ponte de impressão.");
    process.exitCode = 1;
  }
}
