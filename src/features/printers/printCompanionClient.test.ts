import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPrintCompanionClient,
  encodePrintCompanionBase64,
  sha256Hex,
} from "./printCompanionClient";
import { savePendingPrintCompanionWake, savePrintCompanionToken } from "./printCompanionStorage";
import { PrintCompanionError } from "./printCompanionTypes";
import type { PrinterConfiguration } from "./printerTypes";
import { POLL_INTERVAL_MS, WAKE_TIMEOUT_MS } from "../diagnostics/androidPrintWakeResume";

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
  afterEach(() => {
    vi.useRealTimers();
  });

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
    const sessionStorage = new MemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      sessionStorage,
      locationAssign: (url) => {
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toContain("test");
        assign(url);
      },
    });

    const wake = client.startWakeFromUserGesture("test");
    expect(wake.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(assign).toHaveBeenCalledWith(wake.url);
    expect(wake.url).toContain("https://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=");
  });

  it("requires an explicit wake when the companion is online without a local token", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(response(health()));
    const assign = vi.fn();
    const localStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage: new MemoryStorage(),
      locationAssign: assign,
    });

    await expect(client.ensureCompanionReady()).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "pairing_required",
    });

    expect(assign).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("web-crm.print-companion.auth.v1")).toBeNull();
  });

  it("reuses the pending wake nonce after returning from the App Link", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
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

    await client.resumePendingWake({ requiredCapabilities: ["test"] });

    expect(assign).not.toHaveBeenCalled();
    expect(JSON.parse((fetchImpl.mock.calls[1]?.[1] as RequestInit).body as string)).toMatchObject({
      nonce: "pending-nonce",
    });
  });

  it("arms resume after App Link navigation without waiting for lifecycle events", async () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }));
    let resumePromise: Promise<unknown> | undefined;
    const assign = vi.fn(() => {
      queueMicrotask(() => {
        resumePromise = client.resumePendingWake();
      });
    });
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: assign,
    });

    client.startWakeFromUserGesture("test");
    expect(assign).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(resumePromise).toBeDefined();
    await expect(resumePromise!).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
  });

  it("keeps pending through offline polling and completes pair, config, and test", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const localStorage = new MemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }));
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const resumePromise = client.resumePendingWake({
      requiredCapabilities: ["test"],
      config: { idleTimeoutMinutes: 15 },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toContain("pending-nonce");
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await resumePromise;

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
    await client.testPrinter(printer);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(fetchImpl.mock.calls[5]?.[0]).toBe("http://127.0.0.1:17891/v1/test");
  });

  it("clears pending and reports pairing expiration only after the finite timeout", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")),
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const resumePromise = client.resumePendingWake();
    const rejection = expect(resumePromise).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "pairing_expired",
    });
    await vi.advanceTimersByTimeAsync(WAKE_TIMEOUT_MS);
    await rejection;
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
  });

  it("clears pending immediately for a definitive health protocol error", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ ok: true })),
      sessionStorage,
      locationAssign: vi.fn(),
    });

    await expect(client.resumePendingWake()).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "protocol_error",
    });
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
  });

  it("resumes pairing and applies config after returning from the App Link", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }))
      .mockResolvedValueOnce(response({ ok: true }));
    const localStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: vi.fn(),
    });

    await client.resumePendingWake({
      requiredCapabilities: ["test"],
      config: { idleTimeoutMinutes: 15 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[2]?.[0]).toBe("http://127.0.0.1:17891/v1/config");
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
    expect(localStorage.getItem("web-crm.print-companion.auth.v1")).toContain("new-token");
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

  it("requires a new explicit pairing after a 401", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "stale-token", apiVersion: "1" }, localStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: false, code: "invalid_token", message: "token=stale-token" }, 401));
    const { client } = createClient(fetchImpl, localStorage);

    await expect(client.print(printer, new Uint8Array([1, 2, 3]), "job-2")).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "pairing_required",
    });

    const firstPrint = JSON.parse((fetchImpl.mock.calls[2]?.[1] as RequestInit).body as string) as { jobId: string };
    expect(firstPrint.jobId).toBe("job-2");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(localStorage.getItem("web-crm.print-companion.auth.v1")).toBeNull();
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
