import { describe, expect, it } from "vitest";

import { calculateCrc16CcittFalse } from "../pix/pixBrCode";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import { createOrderReceiptPixPayload, getOrderReceiptPixAmount } from "./orderReceiptPix";
import type { Order } from "./orderTypes";

const profile: StoreProfile = {
  displayName: "Loja Teste",
  taxId: "12.345.678/0001-90",
  address: { city: "Campos" },
};

const settings = { recipientType: "business" as const, keySource: "taxId" as const };

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    clientId: "client-1",
    clientName: "Cliente",
    deliveryDateTime: "2026-01-01T12:00:00",
    items: [],
    subtotal: 100,
    deliveryFee: 0,
    total: 100,
    amountPaid: 0,
    orderStatus: "active",
    tagIds: [],
    ...overrides,
  };
}

describe("order receipt Pix composition", () => {
  it.each([
    [{ amountPaid: 0 }, 100],
    [{ amountPaid: 30 }, 70],
    [{ amountPaid: 30, creditApplied: 20 }, 50],
  ])("derives the canonical remaining amount from %o", (overrides, expected) => {
    expect(getOrderReceiptPixAmount(createOrder(overrides))).toBe(expected);
  });

  const ineligibleCases: Array<[Partial<Order>, string]> = [
    [{ amountPaid: 100 }, "settled"],
    [{ amountPaid: 80, creditApplied: 20 }, "applied credit"],
    [{ amountPaid: 110 }, "overpaid"],
    [{ amountPaid: 0, orderStatus: "cancelled" }, "cancelled"],
  ];

  it.each(ineligibleCases)("does not offer Pix for %s orders", (overrides) => {
    expect(getOrderReceiptPixAmount(createOrder(overrides))).toBeNull();
  });

  it("keeps a completed order eligible when a remainder exists", () => {
    expect(getOrderReceiptPixAmount(createOrder({ orderStatus: "completed", amountPaid: 30 }))).toBe(70);
  });

  it("does not let generated credit change the amount due", () => {
    expect(getOrderReceiptPixAmount(createOrder({ amountPaid: 0, creditGenerated: 10 }))).toBe(100);
  });

  it("creates a static payload with the remaining amount and default txid", () => {
    const payload = createOrderReceiptPixPayload(createOrder({ amountPaid: 30, creditApplied: 20 }), settings, profile);

    expect(payload).toContain("540550.00");
    expect(payload).toContain("62070503***");
    expect(payload).toContain("011412345678000190");
    expect(payload?.slice(-4)).toBe(calculateCrc16CcittFalse(payload?.slice(0, -4) ?? ""));
  });

  it("returns no charge payload for an ineligible order", () => {
    expect(createOrderReceiptPixPayload(createOrder({ amountPaid: 100 }), settings, profile)).toBeNull();
  });
});
