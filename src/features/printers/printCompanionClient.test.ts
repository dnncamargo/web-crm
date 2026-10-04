import { describe, expect, it, vi } from "vitest";

import {
  createPrintCompanionClient,
  encodePrintCompanionBase64,
  sha256Hex,
} from "./printCompanionClient";
import { savePendingPrintCompanionWake, savePrintCompanionToken } from "./printCompanionStorage";
import { PrintCompanionError } from "./printCompanionTypes";
import type { PrinterConfiguration } from "./printerTypes";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const printer: PrinterConfiguration = {
  id: "printer-1",
  name: "Balcão",
  transport: "tcp",
  protocol: "escpos",
  host: "192.168.0.50",
  port: 9100,
  paperWidthMm: 80,
  codePage: "cp1252",
  active: true,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function health(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ok: true,
    state: "RUNNING",
    appVersion: "1.0.0",
    appVersionCode: 1,
    apiVersion: "1",
    capabilities: ["test", "config", "print"],
    paired: true,
    ...overrides,
  };
}

function createClient(fetchImpl: typeof fetch, localStorage = new MemoryStorage()) {
  return {
    client: createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage: new MemoryStorage(),
      locationAssign: vi.fn(),
    }),
    localStorage,
  };
}

describe("PrintCompanionClient", () => {
  it("validates health compatibility and required capabilities", async () => {
    const incompatible = createClient(vi.fn<typeof fetch>().mockResolvedValue(response(health({ apiVersion: "2" }))));
    await expect(incompatible.client.ensureCompanionReady()).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "companion_incompatible",
    });

    const missing = createClient(vi.fn<typeof fetch>().mockResolvedValue(response(health({ capabilities: ["test"] }))));
    await expect(missing.client.ensureCompanionReady({ requiredCapabilities: ["print"] })).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "missing_capability",
    });
  });

  it("reports an offline companion without attempting pairing", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    const { client } = createClient(fetchImpl);

    await expect(client.health()).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "companion_offline",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("creates a 32-byte URL-safe wake nonce and opens the exact App Link", () => {
    const assign = vi.fn();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>(),
      sessionStorage: new MemoryStorage(),
      locationAssign: assign,
    });

    const wake = client.wake();
    expect(wake.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(assign).toHaveBeenCalledWith(wake.url);
    expect(wake.url).toContain("https://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=");
  });

  it("pairs only after a new wake when the companion is online without a local token", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }));
    const assign = vi.fn();
    const localStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage: new MemoryStorage(),
      locationAssign: assign,
    });

    await client.ensureCompanionReady();

    expect(assign).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("web-crm.print-companion.auth.v1")).toContain("new-token");
    const pairBody = JSON.parse((fetchImpl.mock.calls[2]?.[1] as RequestInit).body as string) as { nonce: string; origin: string };
    expect(pairBody.origin).toBe("https://deliciasdoporto.vercel.app");
    expect(pairBody.nonce).toHaveLength(43);
  });

  it("reuses the pending wake nonce after returning from the App Link", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now() }, sessionStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }));
    const assign = vi.fn();
    const localStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: assign,
    });

    await client.ensureCompanionReady();

    expect(assign).not.toHaveBeenCalled();
    expect(JSON.parse((fetchImpl.mock.calls[1]?.[1] as RequestInit).body as string)).toMatchObject({
      nonce: "pending-nonce",
    });
  });

  it("sends test with the canonical printer destination and bearer token", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "valid-token", apiVersion: "1" }, localStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }));
    const { client } = createClient(fetchImpl, localStorage);

    await client.testPrinter(printer);

    const request = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe("Bearer valid-token");
    expect(JSON.parse(request.body as string)).toEqual({ host: printer.host, port: printer.port });
  });

  it("sends exact base64 and SHA-256 print fields, preserving jobId", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "valid-token", apiVersion: "1" }, localStorage);
    const bytes = new Uint8Array([0x00, 0x1b, 0xff]);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: true, replayed: true, jobId: "job-1" }));
    const { client } = createClient(fetchImpl, localStorage);

    const result = await client.print(printer, bytes, "job-1");
    const request = fetchImpl.mock.calls[2]?.[1] as RequestInit;
    const body = JSON.parse(request.body as string) as Record<string, unknown>;

    expect(result.replayed).toBe(true);
    expect(body).toEqual({
      jobId: "job-1",
      host: printer.host,
      port: printer.port,
      data: encodePrintCompanionBase64(bytes),
      sha256: await sha256Hex(bytes),
    });
  });

  it("recovers exactly once from 401 and retries the same logical print", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "stale-token", apiVersion: "1" }, localStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: false, code: "invalid_token", message: "token=stale-token" }, 401))
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "fresh-token", apiVersion: "1" }))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: true, jobId: "job-2" }));
    const { client } = createClient(fetchImpl, localStorage);

    await client.print(printer, new Uint8Array([1, 2, 3]), "job-2");

    const firstPrint = JSON.parse((fetchImpl.mock.calls[2]?.[1] as RequestInit).body as string) as { jobId: string };
    const retryPrint = JSON.parse((fetchImpl.mock.calls[6]?.[1] as RequestInit).body as string) as { jobId: string };
    expect(firstPrint.jobId).toBe("job-2");
    expect(retryPrint.jobId).toBe("job-2");
    expect(fetchImpl).toHaveBeenCalledTimes(7);
    expect(localStorage.getItem("web-crm.print-companion.auth.v1")).toContain("fresh-token");
  });

  it("preserves conflict semantics and never exposes a token in the error", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "secret-token", apiVersion: "1" }, localStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: false, code: "job_id_conflict", message: "secret-token" }, 409));
    const { client } = createClient(fetchImpl, localStorage);

    const error = await client.print(printer, new Uint8Array([1]), "conflict").catch((value: unknown) => value);
    expect(error).toMatchObject<Partial<PrintCompanionError>>({ code: "job_id_conflict" });
    expect((error as Error).message).not.toContain("secret-token");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
