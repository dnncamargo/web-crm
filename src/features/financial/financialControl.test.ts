import { describe, expect, it } from "vitest";

import {
  compareFinancialControlValues,
  canPrintFinancialReport,
  filterOrdersByCreationPeriod,
  getFinancialEventRowKey,
  getOrderCreationDate,
  isValidFinancialControlPeriod,
  matchesFinancialSearch,
} from "./financialControl";

describe("financial control selectors", () => {
  it("uses order creation time for the orders period, never the delivery date", () => {
    const orders = [
      { createdAt: new Date(2026, 8, 30, 12), deliveryDateTime: "2026-10-02T12:00" },
      { createdAt: new Date(2026, 9, 1, 12), deliveryDateTime: "2026-09-15T12:00" },
      { createdAt: null, deliveryDateTime: "2026-10-02T12:00" },
    ];

    expect(filterOrdersByCreationPeriod(orders, { from: "2026-10-01", through: "2026-10-31" })).toHaveLength(1);
    expect(getOrderCreationDate(orders[2])).toBeNull();
  });

  it("normalizes customer search and supports order ids", () => {
    expect(matchesFinancialSearch("JOAO", "João da Silva", "order-1")).toBe(true);
    expect(matchesFinancialSearch("#order-1", "Maria", "order-1")).toBe(true);
    expect(matchesFinancialSearch("xyz", "Maria", "order-1")).toBe(false);
  });

  it("sorts by client, value, or date with a deterministic tie breaker", () => {
    const first = { clientName: "Ana", date: "2026-10-01", valueCents: 1200 };
    const second = { clientName: "Bruna", date: "2026-10-03", valueCents: 800 };

    expect(compareFinancialControlValues(first, second, "client")).toBeLessThan(0);
    expect(compareFinancialControlValues(first, second, "value")).toBeLessThan(0);
    expect(compareFinancialControlValues(first, second, "date")).toBeGreaterThan(0);
  });

  it("keeps same payment IDs on separate orders as distinct stable rows", () => {
    const firstOrderKey = getFinancialEventRowKey("order-a", "receipt", "payment-1");
    const secondOrderKey = getFinancialEventRowKey("order-b", "receipt", "payment-1");

    expect(firstOrderKey).not.toBe(secondOrderKey);
    expect(new Set([firstOrderKey, secondOrderKey]).size).toBe(2);
  });

  it("only permits printing for loaded data with a complete valid period", () => {
    const validPeriod = { from: "2026-10-01", through: "2026-10-31" };
    expect(isValidFinancialControlPeriod(validPeriod)).toBe(true);
    expect(canPrintFinancialReport(true, "", validPeriod)).toBe(false);
    expect(canPrintFinancialReport(false, "consulta falhou", validPeriod)).toBe(false);
    expect(canPrintFinancialReport(false, "", { from: "", through: validPeriod.through })).toBe(false);
    expect(canPrintFinancialReport(false, "", { from: "2026-02-30", through: validPeriod.through })).toBe(false);
    expect(canPrintFinancialReport(false, "", validPeriod)).toBe(true);
  });
});
