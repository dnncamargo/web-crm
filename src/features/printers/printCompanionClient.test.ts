import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPrintCompanionClient,
  encodePrintCompanionBase64,
  sha256Hex,
} from "./printCompanionClient";
import {
  loadPendingPrintCompanionWake,
  savePrintCompanionConfig,
  savePendingPrintCompanionWake,
  savePrintCompanionToken,
} from "./printCompanionStorage";
import { PrintCompanionError } from "./printCompanionTypes";
import type { PrinterConfiguration } from "./printerTypes";
import {
  POLL_INTERVAL_MS,
  WAKE_HEALTH_REQUEST_TIMEOUT_MS,
  WAKE_TIMEOUT_MS,
} from "../diagnostics/androidPrintWakeResume";

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

  it("aborts a wake health probe after one second", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    }));
    const { client } = createClient(fetchImpl);

    const healthPromise = client.health(WAKE_HEALTH_REQUEST_TIMEOUT_MS);
    const rejection = expect(healthPromise).rejects.toMatchObject<Partial<PrintCompanionError>>({
      code: "companion_offline",
    });
    await vi.advanceTimersByTimeAsync(WAKE_HEALTH_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("prepares an explicit Android Intent URI with the persisted nonce", () => {
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

    const wake = client.prepareWakeIntent("test");
    client.activatePreparedWake(wake);

    expect(wake.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(wake.intentUrl).toContain("intent://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=");
    expect(wake.intentUrl).toContain("scheme=https");
    expect(wake.intentUrl).toContain("package=io.webcrm.printcompanion");
    expect(wake.intentUrl).toContain("S.browser_fallback_url=https%3A%2F%2Fdeliciasdoporto.vercel.app%2Fandroid-print-bridge%2Factivate");
    expect(wake.intentUrl).toContain(`nonce=${encodeURIComponent(wake.nonce)}`);
    expect(wake.fallbackUrl).toBe("https://deliciasdoporto.vercel.app/android-print-bridge/activate");
    expect(JSON.parse(sessionStorage.getItem("web-crm.print-companion.wake.v1") as string)).toMatchObject({
      nonce: wake.nonce,
      intent: "test",
    });
    expect(assign).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves the frozen print attempt id in the explicit wake contract", () => {
    const sessionStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>(),
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const wake = client.prepareWakeIntent("print", "attempt-print");
    client.activatePreparedWake(wake);

    expect(wake.attemptId).toBe("attempt-print");
    expect(loadPendingPrintCompanionWake(sessionStorage)).toMatchObject({
      attemptId: "attempt-print",
      intent: "print",
      nonce: wake.nonce,
    });
  });

  it("starts the wake window at activation instead of preparation", () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>(),
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const wake = client.prepareWakeIntent("test");
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();

    vi.advanceTimersByTime(60_000);
    const clickTimestamp = Date.now();
    client.activatePreparedWake(wake);

    expect(JSON.parse(sessionStorage.getItem("web-crm.print-companion.wake.v1") as string)).toEqual({
      attemptId: wake.attemptId,
      nonce: wake.nonce,
      createdAt: clickTimestamp,
      intent: "test",
    });
  });

  it("uses a new nonce and timestamp for each explicit retry", () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>(),
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const firstWake = client.prepareWakeIntent("test");
    client.activatePreparedWake(firstWake);
    const firstPending = JSON.parse(sessionStorage.getItem("web-crm.print-companion.wake.v1") as string) as {
      nonce: string;
      createdAt: number;
    };

    vi.advanceTimersByTime(60_000);
    const retryWake = client.prepareWakeIntent("test");
    client.activatePreparedWake(retryWake);
    const retryPending = JSON.parse(sessionStorage.getItem("web-crm.print-companion.wake.v1") as string) as {
      nonce: string;
      createdAt: number;
    };

    expect(retryWake.nonce).not.toBe(firstWake.nonce);
    expect(retryPending.nonce).toBe(retryWake.nonce);
    expect(retryPending.createdAt).toBeGreaterThan(firstPending.createdAt);
  });

  it("reuses the resume promise for one attempt and scopes it by attemptId", async () => {
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }));
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: vi.fn(),
    });
    const wake = client.prepareWakeIntent("test");
    client.activatePreparedWake(wake);

    const first = client.resumePendingWake();
    const reused = client.resumePendingWake();

    expect(reused).toBe(first);
    await expect(first).resolves.toMatchObject({ appVersion: "1.0.0" });
  });

  it("does not let an invalidated attempt clear a replacement pending wake", async () => {
    const sessionStorage = new MemoryStorage();
    let firstSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn<typeof fetch>((_input, init) => {
      if (fetchImpl.mock.calls.length === 1) {
        firstSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      }

      return Promise.resolve(response(health()));
    });
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      sessionStorage,
      locationAssign: vi.fn(),
    });
    const firstWake = client.prepareWakeIntent("test");
    client.activatePreparedWake(firstWake);
    const firstResume = client.resumePendingWake();
    await Promise.resolve();

    const secondWake = client.prepareWakeIntent("test");
    client.activatePreparedWake(secondWake);
    expect(firstSignal?.aborted).toBe(true);
    expect(loadPendingPrintCompanionWake(sessionStorage)?.attemptId).toBe(secondWake.attemptId);
    await expect(firstResume).rejects.toBeDefined();
    expect(loadPendingPrintCompanionWake(sessionStorage)?.attemptId).toBe(secondWake.attemptId);
  });

  it("starts polling normally after a delayed click instead of expiring immediately", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    const localStorage = new MemoryStorage();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError("offline"))
        .mockResolvedValueOnce(response(health()))
        .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }))
        .mockResolvedValueOnce(response({ ok: true })),
      localStorage,
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const wake = client.prepareWakeIntent("test");
    vi.advanceTimersByTime(60_000);
    client.activatePreparedWake(wake);

    const resumePromise = client.resumePendingWake({ config: { idleTimeoutMinutes: 15 } });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await expect(resumePromise).resolves.toMatchObject({ appVersion: "1.0.0" });
  });

  it("keeps the compatibility wake API synchronous with the explicit Intent URI", () => {
    const assign = vi.fn();
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl: vi.fn<typeof fetch>(),
      sessionStorage: new MemoryStorage(),
      locationAssign: assign,
    });

    const wake = client.startWakeFromUserGesture("test");

    expect(wake.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(assign).toHaveBeenCalledWith(wake.url);
    expect(wake.url).toContain("intent://deliciasdoporto.vercel.app/android-print-bridge/activate?nonce=");
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
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
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
    const request = fetchImpl.mock.calls[1]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(JSON.parse(request.body as string)).toEqual({ nonce: "pending-nonce" });
    expect(headers.get("Origin")).toBeNull();
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
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
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const localStorage = new MemoryStorage();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(response(health({ paired: false })))
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
    const pairRequest = fetchImpl.mock.calls[2]?.[1] as RequestInit;
    expect(JSON.parse(pairRequest.body as string)).toEqual({ nonce: "pending-nonce" });
    expect(new Headers(pairRequest.headers).get("Origin")).toBeNull();
    expect(sessionStorage.getItem("web-crm.print-companion.wake.v1")).toBeNull();
    await client.testPrinter(printer);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(fetchImpl.mock.calls[5]?.[0]).toBe("http://127.0.0.1:17891/v1/test");
  });

  it("clears pending and reports pairing expiration only after the finite timeout", async () => {
    vi.useFakeTimers();
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
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
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
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
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
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

  it("reports the first health result before starting pairing", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const localStorage = new MemoryStorage();
    const events: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health({ paired: false })))
      .mockResolvedValueOnce(response({ ok: true, token: "new-token", apiVersion: "1" }));
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      localStorage,
      sessionStorage,
      locationAssign: vi.fn(),
    });

    await client.resumePendingWake({
      onHealthReady: (value) => events.push(`health:${value.appVersion}`),
      onStageChange: (stage) => events.push(stage),
    });

    expect(events).toEqual(["health", "health:1.0.0", "pair"]);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("http://127.0.0.1:17891/v1/pair");
  });

  it("classifies invalid_request as a protocol error and preserves the companion code", async () => {
    const sessionStorage = new MemoryStorage();
    savePendingPrintCompanionWake({ attemptId: "attempt-a", nonce: "pending-nonce", createdAt: Date.now(), intent: "test" }, sessionStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health({ paired: false })))
      .mockResolvedValueOnce(response({ ok: false, code: "invalid_request", message: "Requisição inválida." }, 400));
    const stageResults: Array<[string, string, string | undefined]> = [];
    const client = createPrintCompanionClient({
      bridgeUrl: "http://127.0.0.1:17891",
      fetchImpl,
      sessionStorage,
      locationAssign: vi.fn(),
    });

    const error = await client.resumePendingWake({
      onStageResult: (stage, result, publicCode) => stageResults.push([stage, result, publicCode]),
    }).catch((value: unknown) => value);

    expect(error).toMatchObject<Partial<PrintCompanionError>>({
      code: "protocol_error",
      companionCode: "invalid_request",
      status: 400,
    });
    expect(stageResults).toEqual([["pair", "failure", "invalid_request"]]);
    expect((error as Error).message).not.toContain("pending-nonce");
    expect((error as Error).message).not.toContain("token");
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

  it("uses the persisted companion config before sending a print", async () => {
    const localStorage = new MemoryStorage();
    savePrintCompanionToken({ token: "valid-token", apiVersion: "1" }, localStorage);
    savePrintCompanionConfig({ idleTimeoutMinutes: 60 }, localStorage);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(health()))
      .mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(response({ ok: true, jobId: "job-config" }));
    const { client } = createClient(fetchImpl, localStorage);

    await client.print(printer, new Uint8Array([1, 2, 3]), "job-config");

    expect(JSON.parse((fetchImpl.mock.calls[1]?.[1] as RequestInit).body as string)).toEqual({
      idleTimeoutMinutes: 60,
    });
    expect(fetchImpl.mock.calls[2]?.[0]).toBe("http://127.0.0.1:17891/v1/print");
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
