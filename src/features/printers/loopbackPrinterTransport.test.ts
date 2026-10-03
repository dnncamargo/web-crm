import { describe, expect, it, vi } from "vitest";

import {
  createLoopbackPrinterTransport,
} from "./loopbackPrinterTransport";
import { PrinterTransportError } from "./printerTransport";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LoopbackPrinterTransport", () => {
  it("checks bridge health and reports when the bridge is unavailable", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("failed to fetch"));
    const transport = createLoopbackPrinterTransport({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      requestTimeoutMs: 100,
    });

    await expect(transport.checkHealth()).rejects.toMatchObject<Partial<PrinterTransportError>>({
      code: "bridge-unavailable",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://127.0.0.1:17891/v1/health",
      expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) }),
    );
  });

  it("serializes the test connection request without ESC/POS data", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true }));
    const transport = createLoopbackPrinterTransport({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
    });

    await transport.testConnection({ host: "192.168.1.99", port: 9100 });

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://127.0.0.1:17891/v1/test");
    expect(request.method).toBe("POST");
    expect(request.headers).toEqual({ "Content-Type": "application/json" });
    expect(request.body).toBe(JSON.stringify({ host: "192.168.1.99", port: 9100 }));
  });

  it("serializes print bytes as base64 and maps bridge printer failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        ok: false,
        code: "printer_timeout",
        message: "A conexão com a impressora excedeu o tempo limite.",
      }, 502),
    );
    const transport = createLoopbackPrinterTransport({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
    });
    const bytes = new Uint8Array([0x00, 0x1b, 0x1d, 0xff]);

    await expect(
      transport.print({ host: "printer.local", port: 9100 }, bytes),
    ).rejects.toMatchObject<Partial<PrinterTransportError>>({
      code: "printer-connection-failed",
      message: "A conexão com a impressora excedeu o tempo limite.",
    });

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("http://127.0.0.1:17891/v1/print");
    expect(request.body).toBe(JSON.stringify({
      host: "printer.local",
      port: 9100,
      data: "ABsd/w==",
    }));
  });

  it("maps rejected and malformed bridge responses to typed errors", async () => {
    const rejectedFetch = vi.fn<typeof fetch>().mockResolvedValue(
      response({ ok: false, code: "origin_not_allowed", message: "Origem rejeitada." }, 403),
    );
    const rejectedTransport = createLoopbackPrinterTransport({ fetchImpl: rejectedFetch });

    await expect(rejectedTransport.checkHealth()).rejects.toMatchObject<Partial<PrinterTransportError>>({
      code: "bridge-rejected",
      status: 403,
    });

    const malformedFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not json", { status: 200 }),
    );
    const malformedTransport = createLoopbackPrinterTransport({ fetchImpl: malformedFetch });

    await expect(malformedTransport.checkHealth()).rejects.toMatchObject<Partial<PrinterTransportError>>({
      code: "bridge-malformed-response",
    });
  });
});
