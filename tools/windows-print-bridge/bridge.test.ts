import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";

import { startPrintBridge } from "./server.mjs";

const ALLOWED_ORIGIN = "http://localhost:5173";
const DISALLOWED_ORIGIN = "http://evil.example";

interface RunningBridge {
  host: string;
  port: number;
  close: () => Promise<void>;
}

interface TcpCapture {
  port: number;
  data: Promise<Buffer>;
  close: () => Promise<void>;
}

const bridges: RunningBridge[] = [];
const tcpServers: TcpCapture[] = [];

afterEach(async () => {
  await Promise.all(bridges.splice(0).map((bridge) => bridge.close()));
  await Promise.all(tcpServers.splice(0).map((server) => server.close()));
});

async function startBridge(overrides: Record<string, unknown> = {}) {
  const bridge = await startPrintBridge({
    port: 0,
    allowedOrigins: [ALLOWED_ORIGIN],
    ...overrides,
  }) as RunningBridge;

  bridges.push(bridge);
  return bridge;
}

async function startTcpCapture(): Promise<TcpCapture> {
  let resolveData: (data: Buffer) => void = () => undefined;
  const data = new Promise<Buffer>((resolve) => {
    resolveData = resolve;
  });
  const server = net.createServer((socket) => {
    const chunks: Buffer[] = [];

    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("end", () => resolveData(Buffer.concat(chunks)));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, resolve);
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("TCP test server did not expose an address.");
  }

  const capture: TcpCapture = {
    port: address.port,
    data,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };

  tcpServers.push(capture);
  return capture;
}

async function request(bridge: RunningBridge, path: string, init: RequestInit = {}) {
  return fetch(`http://${bridge.host}:${bridge.port}${path}`, {
    ...init,
    headers: {
      Origin: ALLOWED_ORIGIN,
      ...(init.headers ?? {}),
    },
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function jsonPost(payload: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

describe("Windows print bridge", () => {
  it("binds loopback and serves health only to configured origins", async () => {
    const bridge = await startBridge();

    expect(bridge.host).toBe("127.0.0.1");

    const allowedResponse = await request(bridge, "/v1/health");
    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.headers.get("access-control-allow-origin")).toBe(ALLOWED_ORIGIN);
    expect(await json(allowedResponse)).toMatchObject({ ok: true, version: "v1" });

    const rejectedResponse = await fetch(`http://${bridge.host}:${bridge.port}/v1/health`, {
      headers: { Origin: DISALLOWED_ORIGIN },
    });
    expect(rejectedResponse.status).toBe(403);
    expect(rejectedResponse.headers.get("access-control-allow-origin")).toBeNull();
    expect(await json(rejectedResponse)).toMatchObject({ ok: false, code: "origin_not_allowed" });

    const preflightResponse = await fetch(`http://${bridge.host}:${bridge.port}/v1/print`, {
      method: "OPTIONS",
      headers: {
        Origin: ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflightResponse.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  it("validates methods, content type, destination and print payload", async () => {
    const bridge = await startBridge();

    const unsupportedMethod = await request(bridge, "/v1/test", { method: "GET" });
    expect(unsupportedMethod.status).toBe(405);
    expect(await json(unsupportedMethod)).toMatchObject({ ok: false, code: "method_not_allowed" });

    const unsupportedContentType = await request(bridge, "/v1/test", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });
    expect(unsupportedContentType.status).toBe(415);

    const invalidDestination = await request(bridge, "/v1/test", jsonPost({ host: "bad host", port: 9100 }));
    expect(invalidDestination.status).toBe(400);
    expect(await json(invalidDestination)).toMatchObject({ ok: false, code: "invalid_request" });

    const emptyPayload = await request(bridge, "/v1/print", jsonPost({ host: "127.0.0.1", port: 9100, data: "" }));
    expect(emptyPayload.status).toBe(400);
    expect(await json(emptyPayload)).toMatchObject({ ok: false, code: "invalid_request" });

    const malformedBase64 = await request(bridge, "/v1/print", jsonPost({ host: "127.0.0.1", port: 9100, data: "not-base64" }));
    expect(malformedBase64.status).toBe(400);
    expect(await json(malformedBase64)).toMatchObject({ ok: false, code: "invalid_request" });

    const tooLargeBody = await request(bridge, "/v1/test", {
      ...jsonPost({ host: "127.0.0.1", port: 9100, padding: "x".repeat(1_048_577) }),
    });
    expect(tooLargeBody.status).toBe(413);
    expect(await json(tooLargeBody)).toMatchObject({ ok: false, code: "body_too_large" });
  });

  it("rejects malformed JSON without attempting TCP", async () => {
    let tcpAttempts = 0;
    const bridge = await startBridge({
      createConnection: () => {
        tcpAttempts += 1;
        throw new Error("TCP must not be attempted for malformed JSON");
      },
    });
    const response = await request(bridge, "/v1/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"host":',
    });

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ ok: false, code: "malformed_json" });
    expect(tcpAttempts).toBe(0);
  });

  it("rejects an invalid port without attempting TCP", async () => {
    let tcpAttempts = 0;
    const bridge = await startBridge({
      createConnection: () => {
        tcpAttempts += 1;
        throw new Error("TCP must not be attempted for an invalid port");
      },
    });
    const response = await request(
      bridge,
      "/v1/test",
      jsonPost({ host: "127.0.0.1", port: 0 }),
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ ok: false, code: "invalid_request" });
    expect(tcpAttempts).toBe(0);
  });

  it("returns a structured 404 for an unknown path without TCP activity", async () => {
    let tcpAttempts = 0;
    const bridge = await startBridge({
      createConnection: () => {
        tcpAttempts += 1;
        throw new Error("TCP must not be attempted for an unknown path");
      },
    });
    const response = await request(bridge, "/v1/unknown");

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ ok: false, code: "not_found" });
    expect(tcpAttempts).toBe(0);
  });

  it("tests a printer by connecting without sending bytes", async () => {
    const bridge = await startBridge();
    const printer = await startTcpCapture();

    const response = await request(bridge, "/v1/test", jsonPost({ host: "127.0.0.1", port: printer.port }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ ok: true });
    await expect(printer.data).resolves.toHaveLength(0);
  });

  it("sends exact binary bytes through print without mutation", async () => {
    const bridge = await startBridge();
    const printer = await startTcpCapture();
    const bytes = new Uint8Array([0x00, 0x1b, 0x1d, 0xff, 0x0a]);
    const data = Buffer.from(bytes).toString("base64");

    const response = await request(bridge, "/v1/print", jsonPost({ host: "127.0.0.1", port: printer.port, data }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ ok: true });
    await expect(printer.data).resolves.toEqual(Buffer.from(bytes));
  });

  it("reports unavailable printers and applies the configured timeout", async () => {
    const bridge = await startBridge({ printerTimeoutMs: 25 });
    const unavailable = await request(bridge, "/v1/test", jsonPost({ host: "127.0.0.1", port: 1 }));
    expect(unavailable.status).toBe(502);
    expect(await json(unavailable)).toMatchObject({ ok: false, code: "printer_unreachable" });

    const timeoutSocket = {
      setTimeout: (_timeoutMs: number, callback: () => void) => callback(),
      once: () => timeoutSocket,
      end: () => timeoutSocket,
      destroy: () => timeoutSocket,
    };
    const timeoutBridge = await startBridge({
      createConnection: () => timeoutSocket,
    });
    const timeoutResponse = await request(timeoutBridge, "/v1/test", jsonPost({ host: "127.0.0.1", port: 9100 }));
    expect(timeoutResponse.status).toBe(502);
    expect(await json(timeoutResponse)).toMatchObject({ ok: false, code: "printer_timeout" });
  });
});
