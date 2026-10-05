import { describe, expect, it } from "vitest";

import type { PrinterConfiguration } from "../printers/printerTypes";
import { createPrintCompanionResumeOwner } from "../printers/printCompanionResumeOwner";
import {
  clearOrderPrintAttemptIfMatches,
  createOrderPrintAttempt,
  decodeOrderPrintAttemptBytes,
  loadFreshOrderPrintAttempt,
  loadOrderPrintAttempt,
  saveOrderPrintAttempt,
} from "./orderPrintAttempt";
import { resumeFrozenOrderPrint } from "./orderPrintFlow";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
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

describe("order print attempt snapshot", () => {
  it("stores the transient printer and encoded bytes without reading live order state", () => {
    const storage = new MemoryStorage();
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-1",
      orderId: "order-1",
      jobId: "job-1",
      printer,
      bytes: new Uint8Array([0, 27, 255]),
      createdAt: 1_000,
    });

    saveOrderPrintAttempt(attempt, storage);

    expect(loadOrderPrintAttempt(storage)).toEqual(attempt);
    expect(decodeOrderPrintAttemptBytes(attempt)).toEqual(new Uint8Array([0, 27, 255]));
  });

  it("clears stale snapshots and preserves replacement ownership", () => {
    const storage = new MemoryStorage();
    const oldAttempt = createOrderPrintAttempt({
      attemptId: "attempt-old",
      orderId: "order-1",
      jobId: "job-old",
      printer,
      bytes: new Uint8Array([1]),
      createdAt: 1_000,
    });
    saveOrderPrintAttempt(oldAttempt, storage);

    expect(loadFreshOrderPrintAttempt(storage, 16_001)).toBeNull();

    const replacement = createOrderPrintAttempt({
      attemptId: "attempt-new",
      orderId: "order-1",
      jobId: "job-new",
      printer,
      bytes: new Uint8Array([2]),
      createdAt: 16_001,
    });
    saveOrderPrintAttempt(replacement, storage);

    expect(clearOrderPrintAttemptIfMatches("attempt-old", storage)).toBe(false);
    expect(loadFreshOrderPrintAttempt(storage, 16_002)?.attemptId).toBe("attempt-new");
  });

  it("clears the snapshot only after a successful resumed print", async () => {
    const storage = new MemoryStorage();
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-1",
      orderId: "order-1",
      jobId: "job-1",
      printer,
      bytes: new Uint8Array([1, 2]),
    });
    saveOrderPrintAttempt(attempt, storage);

    await resumeFrozenOrderPrint({
      attempt,
      owner: createPrintCompanionResumeOwner(),
      isCurrentAttempt: () => true,
      resumeCompanion: async () => undefined,
      preflight: async () => undefined,
      print: async () => undefined,
      onSuccess: () => {
        clearOrderPrintAttemptIfMatches(attempt.attemptId, storage);
      },
    });

    expect(loadOrderPrintAttempt(storage)).toBeNull();
  });
});
