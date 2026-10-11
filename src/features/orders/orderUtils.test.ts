import { describe, expect, it } from "vitest";

import {
  getOrderBalanceInfo,
  getOrderCashPaid,
  getOrderGeneratedCreditAmount,
  getPaymentStatus,
} from "./orderUtils";

function financial(overrides: Partial<{
  id: string;
  total: number;
  amountPaid: number;
  payments?: Array<{ id: string; amount: number; receivedAt: string | null }>;
  creditApplied?: number | null;
}> = {}) {
  return {
    id: "order-1",
    total: 100,
    amountPaid: 0,
    ...overrides,
  };
}

describe("order payment calculations", () => {
  it("uses legacy amountPaid when payments are absent", () => {
    expect(getOrderCashPaid(financial({ amountPaid: 30 }))).toBe(30);
  });

  it("uses an empty payment history for a new unpaid order", () => {
    expect(getOrderCashPaid(financial({ amountPaid: 0, payments: [] }))).toBe(0);
  });

  it("sums installments", () => {
    expect(getOrderCashPaid(financial({
      payments: [
        { id: "p1", amount: 30, receivedAt: "2026-10-07T10:00:00.000Z" },
        { id: "p2", amount: 20, receivedAt: "2026-10-07T11:00:00.000Z" },
      ],
    }))).toBe(50);
  });

  it.each([
    [30, 70, "remaining"],
    [50, 50, "remaining"],
    [100, 0, "settled"],
  ] as const)("calculates %s cash as %s %s", (cash, amount, type) => {
    const info = getOrderBalanceInfo(financial({ amountPaid: cash }));

    expect(info.amount).toBe(amount);
    expect(info.type).toBe(type);
  });

  it("derives overpayment credit from effective paid", () => {
    const order = financial({ amountPaid: 130 });

    expect(getOrderGeneratedCreditAmount(order)).toBe(30);
    expect(getPaymentStatus(order)).toBe("paid");
  });

  it("allows applied and generated credit to coexist", () => {
    expect(getOrderGeneratedCreditAmount(financial({ amountPaid: 90, creditApplied: 20 }))).toBe(10);
  });

  it("settles a fully credit-funded order without generating credit", () => {
    const order = financial({ total: 30, amountPaid: 0, payments: [], creditApplied: 30 });

    expect(getPaymentStatus(order)).toBe("paid");
    expect(getOrderGeneratedCreditAmount(order)).toBe(0);
  });

  it("keeps payment status independent from operational order status", () => {
    const completedUnpaidOrder = {
      total: 100,
      amountPaid: 0,
      payments: [],
      creditApplied: 0,
      orderStatus: "completed" as const,
    };

    expect(getPaymentStatus(completedUnpaidOrder)).toBe("unpaid");
  });

  it("gives payments precedence over stale amountPaid", () => {
    const order = financial({
      amountPaid: 999,
      payments: [{ id: "p1", amount: 50, receivedAt: null }],
    });

    expect(getOrderCashPaid(order)).toBe(50);
    expect(getOrderBalanceInfo(order).amount).toBe(50);
    expect(getPaymentStatus(order)).toBe("partial");
  });
});
