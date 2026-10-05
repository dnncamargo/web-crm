import { describe, expect, it } from "vitest";

import { getPendingPrintResumeRoute } from "./androidPrintActivation";

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
});
