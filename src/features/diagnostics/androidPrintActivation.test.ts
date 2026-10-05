import { describe, expect, it } from "vitest";

import {
  loadFreshPendingPrintCompanionWake,
  savePendingPrintCompanionWake,
} from "../printers/printCompanionStorage";
import {
  loadFreshOrderPrintAttempt,
  saveOrderPrintAttempt,
} from "../orders/orderPrintAttempt";
import { getPendingPrintResumeRoute } from "./androidPrintActivation";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const printAttempt = {
  attemptId: "attempt-1",
  createdAt: 1,
  intent: "print" as const,
  orderId: "order/1",
  jobId: "job-1",
  printer: {
    id: "printer-1",
    name: "Thermal",
    transport: "tcp" as const,
    protocol: "escpos" as const,
    host: "192.168.0.10",
    port: 9100,
    paperWidthMm: 80,
    codePage: "cp1252" as const,
    active: true,
  },
  bytesBase64: "AQI=",
};

describe("Android print activation routing", () => {
  it("returns the frozen receipt owner for a pending print intent", () => {
    expect(getPendingPrintResumeRoute(
      { attemptId: "attempt-1", nonce: "nonce", createdAt: 1, intent: "print" },
      printAttempt,
    )).toBe("/pedidos/order%2F1/via");
  });

  it("keeps a pending test intent in the diagnostic flow", () => {
    expect(getPendingPrintResumeRoute(
      { attemptId: "attempt-1", nonce: "nonce", createdAt: 1, intent: "test" },
      null,
    )).toBeNull();
  });

  it("preserves the frozen print route across the authentication lifecycle", () => {
    const storage = new MemoryStorage();
    savePendingPrintCompanionWake({
      attemptId: printAttempt.attemptId,
      nonce: "nonce",
      createdAt: 1,
      intent: "print",
    }, storage);
    saveOrderPrintAttempt(printAttempt, storage);

    const pendingWake = loadFreshPendingPrintCompanionWake(storage, 2);
    const pendingAttempt = loadFreshOrderPrintAttempt(storage, 2);

    expect(getPendingPrintResumeRoute(pendingWake, pendingAttempt)).toBe("/pedidos/order%2F1/via");
    expect(loadFreshPendingPrintCompanionWake(storage, 3)?.attemptId).toBe(printAttempt.attemptId);
    expect(loadFreshOrderPrintAttempt(storage, 3)?.jobId).toBe(printAttempt.jobId);
  });
});
