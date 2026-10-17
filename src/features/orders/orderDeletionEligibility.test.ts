import { describe, expect, it } from "vitest";

import type { Order } from "./orderTypes";
import { getCancelledOrderDeletionBlockReason } from "./orderDeletionEligibility";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-123",
    clientId: "client-123",
    clientName: "Cliente de teste",
    deliveryDateTime: "2026-10-02T10:00:00-03:00",
    items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 32, total: 32 }],
    subtotal: 32,
    deliveryFee: 0,
    total: 32,
    amountPaid: 0,
    payments: [],
    creditApplied: 0,
    creditGenerated: 0,
    orderStatus: "cancelled",
    tagIds: [],
    cancellationAgreement: { operationId: "operation-123", text: "Cancelamento sem movimentação." },
    ...overrides,
  };
}

describe("cancelled order deletion eligibility", () => {
  it("allows a cancelled order with no financial movement and a conclusive client balance", () => {
    expect(getCancelledOrderDeletionBlockReason(order(), [order()])).toBeNull();
  });

  it("blocks active orders", () => {
    const active = order({ orderStatus: "active" });
    expect(getCancelledOrderDeletionBlockReason(active, [active])).toContain("cancelados");
  });

  it("blocks a cancelled order with real cash movement even when total alone would not matter", () => {
    const paid = order({ amountPaid: 20, payments: [{ id: "payment-123", amount: 20, receivedAt: "2026-10-01T10:00:00Z" }] });
    expect(getCancelledOrderDeletionBlockReason(paid, [paid])).toContain("recebimentos");
  });

  it("blocks credit effects and inconclusive financial history", () => {
    const credited = order({ creditApplied: 1 });
    expect(getCancelledOrderDeletionBlockReason(credited, [credited])).toContain("reconciliados");
    const legacy = order({ cancellationAgreement: undefined });
    expect(getCancelledOrderDeletionBlockReason(legacy, [legacy])).toContain("reconciliados");
  });
});
