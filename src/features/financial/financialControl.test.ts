import { describe, expect, it } from "vitest";

import {
  compareFinancialControlValues,
  filterOrdersByCreationPeriod,
  getOrderCreationDate,
  matchesFinancialSearch,
} from "./financialControl";

describe("financial control selectors", () => {
  it("uses order creation time for the orders period, never the delivery date", () => {
    const orders = [
      { createdAt: new Date("2026-09-30T23:30:00-03:00"), deliveryDateTime: "2026-10-02T12:00" },
      { createdAt: new Date("2026-10-01T10:00:00-03:00"), deliveryDateTime: "2026-09-15T12:00" },
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
});
