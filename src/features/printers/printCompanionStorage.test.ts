import { describe, expect, it } from "vitest";

import {
  clearPrintCompanionToken,
  clearPendingPrintCompanionWakeIfMatches,
  DEFAULT_IDLE_TIMEOUT_MINUTES,
  inspectFreshPendingPrintCompanionWake,
  loadPrintCompanionConfig,
  loadPrintCompanionToken,
  savePendingPrintCompanionWake,
  savePrintCompanionConfig,
  savePrintCompanionToken,
  MAX_IDLE_TIMEOUT_MINUTES,
  MIN_IDLE_TIMEOUT_MINUTES,
} from "./printCompanionStorage";

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

describe("Print Companion local storage", () => {
  it("loads, saves and clears the browser-only token", () => {
    const storage = new MemoryStorage();
    const token = { token: "secret-token", apiVersion: "1" as const };

    expect(loadPrintCompanionToken(storage)).toBeNull();
    savePrintCompanionToken(token, storage);
    expect(loadPrintCompanionToken(storage)).toEqual(token);
    clearPrintCompanionToken(storage);
    expect(loadPrintCompanionToken(storage)).toBeNull();
  });

  it("uses a validated 15-minute config default and enforces the Android range", () => {
    const storage = new MemoryStorage();

    expect(DEFAULT_IDLE_TIMEOUT_MINUTES).toBe(15);
    expect(MIN_IDLE_TIMEOUT_MINUTES).toBe(1);
    expect(MAX_IDLE_TIMEOUT_MINUTES).toBe(120);
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES });

    for (const idleTimeoutMinutes of [1, 15, 120]) {
      storage.setItem("web-crm.print-companion.config.v1", JSON.stringify({ idleTimeoutMinutes }));
      expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes });
    }

    savePrintCompanionConfig({ idleTimeoutMinutes: 30 }, storage);
    expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: 30 });

    for (const idleTimeoutMinutes of [0, 121, 1440]) {
      storage.setItem("web-crm.print-companion.config.v1", JSON.stringify({ idleTimeoutMinutes }));
      expect(loadPrintCompanionConfig(storage)).toEqual({ idleTimeoutMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES });
    }

    expect(() => savePrintCompanionConfig({ idleTimeoutMinutes: 0 }, storage)).toThrow();
  });

  it("discards stale pending wake and preserves a replacement", () => {
    const storage = new MemoryStorage();
    savePendingPrintCompanionWake({
      attemptId: "attempt-a",
      nonce: "nonce-a",
      createdAt: 1_000,
      intent: "test",
    }, storage);

    const stale = inspectFreshPendingPrintCompanionWake(storage, 16_001);

    expect(stale.pending).toBeNull();
    expect(stale.staleAgeMs).toBe(15_001);
    expect(storage.getItem("web-crm.print-companion.wake.v1")).toBeNull();

    savePendingPrintCompanionWake({
      attemptId: "attempt-b",
      nonce: "nonce-b",
      createdAt: 16_001,
      intent: "test",
    }, storage);
    expect(clearPendingPrintCompanionWakeIfMatches("attempt-a", storage)).toBe(false);
    expect(inspectFreshPendingPrintCompanionWake(storage, 16_002).pending?.attemptId).toBe("attempt-b");
  });
});
