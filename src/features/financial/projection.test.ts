import { describe, expect, it } from "vitest";

import {
  projectFinancialReadModel,
  selectKnownRefundsInInterval,
  selectKnownReceiptsInInterval,
  selectOperationalPendingOrders,
  sumProjectedReceipts,
} from "./projection";
import { reconcileFinancialDocuments } from "./reconciliation";
import { getFinancialEventRowKey } from "./financialControl";
import type { Order } from "../orders/orderTypes";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    clientId: "client-1",
    clientName: "Cliente",
    deliveryDateTime: "2026-10-10T10:00:00.000Z",
    items: [{
      id: "item-1",
      productId: "product-1",
      productName: "Produto",
      quantity: 1,
      unitPrice: 100,
      total: 100,
    }],
    subtotal: 100,
    deliveryFee: 0,
    total: 100,
    amountPaid: 0,
    payments: [],
    orderStatus: "active",
    tagIds: [],
    ...overrides,
  };
}

describe("financial read-only projection", () => {
  it("keeps equal receipt IDs from different orders as separate cash rows", () => {
    const projection = projectFinancialReadModel([
      order({ id: "order-a", amountPaid: 40, payments: [{ id: "shared-payment", amount: 40, receivedAt: "2026-10-01T10:00:00.000Z" }] }),
      order({ id: "order-b", amountPaid: 60, payments: [{ id: "shared-payment", amount: 60, receivedAt: "2026-10-01T11:00:00.000Z" }] }),
    ]);
    const rowKeys = projection.knownReceipts.map((receipt) => getFinancialEventRowKey(receipt.orderId, "receipt", receipt.receiptId));

    expect(projection.knownReceipts.map((receipt) => receipt.orderId)).toEqual(["order-a", "order-b"]);
    expect(new Set(rowKeys).size).toBe(2);
  });

  it("classifies a September order payment in October from receivedAt, not order dates", () => {
    const projection = projectFinancialReadModel([order({
      deliveryDateTime: "2026-09-28T10:00:00.000Z",
      amountPaid: 40,
      payments: [{ id: "receipt", amount: 40, receivedAt: "2026-10-01T00:00:00.000Z" }],
    })]);

    const october = selectKnownReceiptsInInterval(projection.knownReceipts, {
      startInclusive: "2026-10-01T00:00:00.000Z",
      endExclusive: "2026-11-01T00:00:00.000Z",
    });

    expect(october.map((receipt) => receipt.receiptId)).toEqual(["receipt"]);
    expect(sumProjectedReceipts(october)).toBe(4000);
  });

  it("separates installments by their individual dates and honors explicit offset boundaries", () => {
    const projection = projectFinancialReadModel([order({
      amountPaid: 50,
      payments: [
        { id: "september-in-utc", amount: 20, receivedAt: "2026-10-01T00:30:00+01:00" },
        { id: "october", amount: 30, receivedAt: "2026-10-01T00:30:00.000Z" },
      ],
    })]);

    const october = selectKnownReceiptsInInterval(projection.knownReceipts, {
      startInclusive: "2026-10-01T00:00:00.000Z",
      endExclusive: "2026-11-01T00:00:00.000Z",
    });

    expect(projection.knownReceipts.map((receipt) => receipt.receiptId)).toEqual(["september-in-utc", "october"]);
    expect(october.map((receipt) => receipt.receiptId)).toEqual(["october"]);
    expect(() => selectKnownReceiptsInInterval(projection.knownReceipts, {
      startInclusive: "2026-10-01T00:00:00",
      endExclusive: "2026-11-01T00:00:00.000Z",
    })).toThrow(RangeError);
  });

  it("reflects a synthetic correction as the current fact without duplicating its receipt", () => {
    const original = order({
      amountPaid: 20,
      payments: [{ id: "receipt", amount: 20, receivedAt: "2026-09-30T12:00:00.000Z" }],
    });
    const corrected = {
      ...original,
      amountPaid: 35,
      payments: [{ id: "receipt", amount: 35, receivedAt: "2026-10-02T12:00:00.000Z" }],
    };

    const projection = projectFinancialReadModel([corrected]);
    const october = selectKnownReceiptsInInterval(projection.knownReceipts, {
      startInclusive: "2026-10-01T00:00:00.000Z",
      endExclusive: "2026-11-01T00:00:00.000Z",
    });

    expect(october).toMatchObject([{ receiptId: "receipt", amountCents: 3500 }]);
    expect(projection.knownReceipts).toHaveLength(1);
  });

  it("uses amountPaid only for a legacy order and preserves unknown dates separately", () => {
    const projection = projectFinancialReadModel([
      order({ id: "legacy", amountPaid: 30, payments: undefined }),
      order({
        id: "canonical",
        amountPaid: 40,
        payments: [{ id: "canonical-payment", amount: 40, receivedAt: null }],
      }),
    ]);

    expect(projection.historicalDateUnknownReceipts).toMatchObject([
      { orderId: "canonical", receiptId: "canonical-payment", amountCents: 4000 },
      { orderId: "legacy", receiptId: "legacy-legacy", amountCents: 3000 },
    ]);
    expect(sumProjectedReceipts(projection.historicalDateUnknownReceipts)).toBe(7000);
  });

  it("does not count applied or generated credit as cash received", () => {
    const projection = projectFinancialReadModel([
      order({
        id: "credit-source",
        amountPaid: 120,
        creditGenerated: 20,
        payments: [{ id: "source-receipt", amount: 120, receivedAt: "2026-10-09T12:00:00.000Z" }],
      }),
      order({
        id: "credit-consumer",
        amountPaid: 90,
        creditApplied: 20,
        creditGenerated: 10,
        payments: [{ id: "receipt", amount: 90, receivedAt: "2026-10-10T12:00:00.000Z" }],
      }),
    ]);

    expect(sumProjectedReceipts(projection.knownReceipts)).toBe(21000);
    expect(projection.creditByClient[0]).toMatchObject({ availableCreditCents: 1000, conclusive: true });
    expect(projection.orderBalances.find((entry) => entry.orderId === "credit-consumer")).toMatchObject({
      creditAppliedCents: 2000,
      creditGeneratedCents: 1000,
    });
  });

  it("keeps cancelled receipts identifiable while excluding cancelled orders from operational collections", () => {
    const cancelled = order({
      id: "cancelled",
      orderStatus: "cancelled",
      amountPaid: 25,
      payments: [{ id: "receipt", amount: 25, receivedAt: "2026-10-10T12:00:00.000Z" }],
    });

    const projection = projectFinancialReadModel([cancelled]);

    expect(projection.knownReceipts).toMatchObject([{ orderId: "cancelled", receiptId: "receipt" }]);
    expect(projection.operationalPendingOrderIds).toEqual([]);
  });

  it("projects a negotiated cancellation refund as a dated outflow separate from receipts and balance", () => {
    const cancelled = order({
      id: "negotiated-cancelled",
      orderStatus: "cancelled",
      amountPaid: 100,
      payments: [{ id: "receipt", amount: 100, receivedAt: "2026-10-10T12:00:00.000Z" }],
      cancellationAgreement: { operationId: "cancel-operation", text: "Devolução parcial combinada." },
      refunds: [{ id: "refund-operation", amount: 35, refundedAt: "2026-10-12T12:00:00.000Z" }],
    });
    const projection = projectFinancialReadModel([cancelled]);
    expect(projection.knownReceipts).toMatchObject([{ receiptId: "receipt", amountCents: 10000 }]);
    expect(projection.knownRefunds).toMatchObject([{ refundId: "refund-operation", amountCents: 3500 }]);
    expect(projection.orderBalances[0]).toMatchObject({ paymentStatus: null, balanceCents: null });
    expect(selectKnownRefundsInInterval(projection.knownRefunds, {
      startInclusive: "2026-10-12T00:00:00Z",
      endExclusive: "2026-10-13T00:00:00Z",
    })).toHaveLength(1);
  });

  it("uses the shared active/completed pending-payment rule and excludes paid or cancelled orders", () => {
    const pendingActive = order({
      id: "active",
      deliveryDateTime: "2026-10-09T10:00:00.000Z",
      amountPaid: 20,
      payments: [{ id: "p-active", amount: 20, receivedAt: null }],
    });
    const pendingCompleted = order({ id: "completed", orderStatus: "completed" });
    const paidCompleted = order({
      id: "paid",
      orderStatus: "completed",
      amountPaid: 100,
      payments: [{ id: "p-paid", amount: 100, receivedAt: null }],
    });
    const cancelled = order({ id: "cancelled", orderStatus: "cancelled" });
    const orders = [paidCompleted, cancelled, pendingCompleted, pendingActive];

    expect(selectOperationalPendingOrders(orders).map((entry) => entry.id)).toEqual(["active", "completed"]);
    expect(projectFinancialReadModel(orders).operationalPendingOrderIds).toEqual(["active", "completed"]);
  });

  it("does not place a cent-exact settlement in the pending Dashboard selection", () => {
    const exactSettlement = order({
      total: 0.1 + 0.2,
      subtotal: 0.1 + 0.2,
      items: [{ id: "item", productId: "product", productName: "Produto", quantity: 1, unitPrice: 0.1 + 0.2, total: 0.1 + 0.2 }],
      amountPaid: 0.3,
      payments: [{ id: "receipt", amount: 0.3, receivedAt: null }],
    });

    expect(selectOperationalPendingOrders([exactSettlement])).toEqual([]);
  });

  it("projects an exact cent total from a compatible floating-point amountPaid cache without duplicating receipts", () => {
    const documents = [order({
      id: "compatible-cache",
      items: [{ id: "item", productId: "product", productName: "Produto", quantity: 1, unitPrice: 300.3, total: 300.3 }],
      subtotal: 300.3,
      total: 300.3,
      amountPaid: 100.1 + 200.2,
      payments: [
        { id: "first", amount: 100.1, receivedAt: "2026-10-10T12:00:00.000Z" },
        { id: "second", amount: 200.2, receivedAt: "2026-10-11T12:00:00.000Z" },
      ],
    })];
    const before = structuredClone(documents);
    const reconciliation = reconcileFinancialDocuments(documents);
    const projection = projectFinancialReadModel(documents);

    expect(documents).toEqual(before);
    expect(reconciliation.orders[0]).toMatchObject({
      classification: "LEGACY_COMPATIBLE",
      cashPaidCents: 30030,
      balanceCents: 0,
    });
    expect(projection.knownReceipts).toHaveLength(2);
    expect(sumProjectedReceipts(projection.knownReceipts)).toBe(30030);
    expect(projection.orderBalances[0]).toMatchObject({ balanceCents: 0, paymentStatus: "paid" });
  });

  it("preserves invalid facts as diagnostics instead of assigning an invented date or definitive balance", () => {
    const documents = [order({
      amountPaid: 10,
      payments: [{ id: "receipt", amount: 10, receivedAt: "2026-10-10T12:00:00" }],
    })];
    const before = structuredClone(documents);
    const projection = projectFinancialReadModel(documents);

    expect(documents).toEqual(before);
    expect(projection.knownReceipts).toEqual([]);
    expect(projection.historicalDateUnknownReceipts).toEqual([]);
    expect(projection.orderBalances[0]?.balanceCents).toBeNull();
    expect(projection.reconciliation.findings.map((finding) => finding.code)).toContain("PAYMENT_DATE_INVALID_OR_MISSING");
  });

  it("keeps projecting valid orders when a runtime-corrupted payments field is diagnosed", () => {
    const corrupted = {
      ...order({ id: "corrupted", amountPaid: 10 }),
      payments: "not-a-payment-list",
    } as unknown as Order;
    const valid = order({
      id: "valid",
      amountPaid: 20,
      payments: [{ id: "receipt", amount: 20, receivedAt: "2026-10-10T12:00:00.000Z" }],
    });

    expect(() => projectFinancialReadModel([corrupted, valid])).not.toThrow();
    const projection = projectFinancialReadModel([corrupted, valid]);

    expect(projection.knownReceipts).toMatchObject([{ orderId: "valid", receiptId: "receipt" }]);
    expect(projection.orderBalances.find((entry) => entry.orderId === "corrupted")).toMatchObject({
      paymentStatus: null,
      balanceCents: null,
    });
    expect(projection.reconciliation.findings.map((finding) => finding.code)).toContain("PAYMENTS_INVALID_STRUCTURE");
  });

  it("uses reconciled cents for overpayment, installment, and applied-credit balances", () => {
    const projection = projectFinancialReadModel([
      order({
        id: "overpaid",
        items: [{ id: "item", productId: "product", productName: "Produto", quantity: 1, unitPrice: 300, total: 300 }],
        subtotal: 300,
        total: 300,
        amountPaid: 300.01,
        creditGenerated: 0.01,
        payments: [{ id: "receipt", amount: 300.01, receivedAt: "2026-10-10T12:00:00.000Z" }],
      }),
      order({
        id: "installments",
        amountPaid: 100,
        payments: [
          { id: "first", amount: 40, receivedAt: "2026-10-10T12:00:00.000Z" },
          { id: "second", amount: 60, receivedAt: "2026-10-11T12:00:00.000Z" },
        ],
      }),
      order({
        id: "applied-credit",
        amountPaid: 50,
        creditApplied: 50,
        payments: [{ id: "receipt", amount: 50, receivedAt: "2026-10-10T12:00:00.000Z" }],
      }),
    ]);

    expect(projection.orderBalances.find((entry) => entry.orderId === "overpaid")).toMatchObject({
      balanceCents: -1,
      creditGeneratedCents: 1,
    });
    expect(projection.orderBalances.find((entry) => entry.orderId === "installments")).toMatchObject({ balanceCents: 0 });
    expect(projection.orderBalances.find((entry) => entry.orderId === "applied-credit")).toMatchObject({ balanceCents: 0 });
  });

  it("does not make a definitive receipt total from a valid payment list with an invalid cache", () => {
    const projection = projectFinancialReadModel([
      order({
        id: "invalid-cache",
        amountPaid: Number.NaN,
        payments: [{ id: "receipt", amount: 10, receivedAt: "2026-10-10T12:00:00.000Z" }],
      }),
      order({
        id: "valid",
        amountPaid: 20,
        payments: [{ id: "valid-receipt", amount: 20, receivedAt: "2026-10-11T12:00:00.000Z" }],
      }),
    ]);

    expect(projection.knownReceipts).toMatchObject([{ orderId: "valid", receiptId: "valid-receipt" }]);
    expect(projection.reconciliation.findings.map((finding) => finding.code)).toContain("MONETARY_VALUE_INVALID");
  });

  it("does not present a divergent cache or duplicate order identity as a definitive receipt total", () => {
    const projection = projectFinancialReadModel([
      order({
        id: "duplicate",
        amountPaid: 10,
        payments: [{ id: "first", amount: 10, receivedAt: "2026-10-10T12:00:00.000Z" }],
      }),
      order({
        id: "duplicate",
        amountPaid: 15,
        payments: [{ id: "second", amount: 10, receivedAt: "2026-10-10T13:00:00.000Z" }],
      }),
    ]);

    expect(projection.knownReceipts).toEqual([]);
    expect(projection.reconciliation.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "ORDER_ID_DUPLICATE",
      "AMOUNT_PAID_PAYMENTS_MISMATCH",
    ]));
  });

  it("makes credit unavailable rather than masking a deficit", () => {
    const projection = projectFinancialReadModel([order({ creditApplied: 10 })]);

    expect(projection.creditByClient[0]).toMatchObject({
      availableCreditCents: null,
      deficitCents: 1000,
      conclusive: true,
    });
    expect(projection.reconciliation.findings.map((finding) => finding.code)).toContain("CLIENT_CREDIT_DEFICIT");
  });
});
