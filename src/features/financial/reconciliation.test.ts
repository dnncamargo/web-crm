import { describe, expect, it } from "vitest";

import {
  reconcileFinancialDocuments,
  type ClientFinancialSnapshot,
  type ReconciliationOrderDocument,
} from "./reconciliation";

function order(overrides: Partial<ReconciliationOrderDocument> = {}): ReconciliationOrderDocument {
  return {
    id: "order-1",
    clientId: "client-1",
    orderStatus: "active",
    amountPaid: 0,
    payments: [],
    creditApplied: 0,
    total: 100,
    subtotal: 100,
    deliveryFee: 0,
    items: [{ quantity: 1, unitPrice: 100, total: 100 }],
    ...overrides,
  };
}

function codes(result: ReturnType<typeof reconcileFinancialDocuments>) {
  return result.findings.map((finding) => finding.code);
}

describe("read-only financial reconciliation", () => {
  it("reconstructs valid payments, balances and generated credit deterministically", () => {
    const result = reconcileFinancialDocuments([
      order({
        amountPaid: 120,
        payments: [
          { id: "payment-1", amount: 70, receivedAt: "2026-01-01T10:00:00.000Z" },
          { id: "payment-2", amount: 50, receivedAt: "2026-01-01T11:00:00.000Z" },
        ],
        creditGenerated: 20,
      }),
    ], [{ clientId: "client-1", state: "ready", availableCreditCents: 2000 }]);

    expect(result.orders[0]).toMatchObject({
      classification: "VALID",
      cashPaidCents: 12000,
      balanceCents: -2000,
      calculatedGeneratedCreditCents: 2000,
    });
    expect(result.clients[0]).toMatchObject({
      conclusive: true,
      availableCreditCents: 2000,
      aggregatorComparison: "matches",
    });
  });

  it("keeps documents without payments compatible through amountPaid and marks unknown legacy dates", () => {
    const result = reconcileFinancialDocuments([
      order({ id: "legacy", amountPaid: 30, payments: undefined }),
      order({
        id: "unknown-date",
        amountPaid: 10,
        payments: [{ id: "payment-1", amount: 10, receivedAt: null }],
      }),
    ]);

    expect(result.orders.map((entry) => entry.classification)).toEqual(["LEGACY_COMPATIBLE", "LEGACY_COMPATIBLE"]);
    expect(codes(result)).toEqual(expect.arrayContaining([
      "PAYMENTS_LEGACY_ABSENT",
      "PAYMENT_DATE_HISTORICALLY_UNKNOWN",
      "AGGREGATOR_ABSENT",
    ]));
  });

  it("distinguishes an empty payment list with a zero cache", () => {
    const result = reconcileFinancialDocuments([order()]);

    expect(result.orders[0]?.classification).toBe("VALID");
    expect(codes(result)).toContain("PAYMENTS_EMPTY_WITH_ZERO_CACHE");
  });

  it("identifies divergent amountPaid caches and duplicate payment IDs", () => {
    const result = reconcileFinancialDocuments([order({
      amountPaid: 20,
      payments: [
        { id: "same", amount: 10, receivedAt: "2026-01-01T10:00:00.000Z" },
        { id: "same", amount: 10, receivedAt: "2026-01-01T11:00:00.000Z" },
      ],
    })]);

    expect(result.orders[0]?.classification).toBe("INCONSISTENT");
    expect(codes(result)).toContain("PAYMENT_ID_DUPLICATE");
    expect(result.clients[0]).toMatchObject({ conclusive: false, availableCreditCents: null });
  });

  it("identifies a valid payment history whose amountPaid cache diverges", () => {
    const result = reconcileFinancialDocuments([order({
      amountPaid: 15,
      payments: [{ id: "payment", amount: 10, receivedAt: "2026-01-01T10:00:00.000Z" }],
    })]);

    expect(codes(result)).toContain("AMOUNT_PAID_PAYMENTS_MISMATCH");
  });

  it("rejects negative, non-finite and sub-cent monetary facts without changing the input", () => {
    const documents = [
      order({ id: "negative", amountPaid: -1 }),
      order({ id: "non-finite", amountPaid: Number.POSITIVE_INFINITY }),
      order({ id: "fraction", amountPaid: 1.001 }),
    ];
    const before = structuredClone(documents);
    const result = reconcileFinancialDocuments(documents);

    expect(documents).toEqual(before);
    expect(result.orders.every((entry) => entry.classification === "INCONSISTENT")).toBe(true);
    expect(codes(result).filter((code) => code === "MONETARY_VALUE_INVALID")).toHaveLength(2);
    expect(codes(result)).toContain("MONETARY_VALUE_NEGATIVE");
  });

  it("reports invalid or missing dates while continuing to inspect other payments", () => {
    const result = reconcileFinancialDocuments([order({
      amountPaid: 30,
      payments: [
        { id: "invalid", amount: 10, receivedAt: "not-a-date" },
        { id: "missing", amount: 20 },
      ],
    })]);

    expect(codes(result).filter((code) => code === "PAYMENT_DATE_INVALID_OR_MISSING")).toHaveLength(2);
  });

  it("permits applied and generated credit together and detects a divergent stored generated credit", () => {
    const valid = reconcileFinancialDocuments([order({
      amountPaid: 90,
      creditApplied: 20,
      creditGenerated: 10,
      payments: [{ id: "payment", amount: 90, receivedAt: "2026-01-01T10:00:00.000Z" }],
    })]);
    const divergent = reconcileFinancialDocuments([order({
      amountPaid: 90,
      creditApplied: 20,
      creditGenerated: 11,
      payments: [{ id: "payment", amount: 90, receivedAt: "2026-01-01T10:00:00.000Z" }],
    })]);

    expect(codes(valid)).toContain("CREDIT_APPLIED_AND_GENERATED");
    expect(codes(divergent)).toContain("CREDIT_GENERATED_MISMATCH");
  });

  it("reconstructs a client's fungible credit across several orders", () => {
    const result = reconcileFinancialDocuments([
      order({
        id: "generated",
        amountPaid: 150,
        creditGenerated: 50,
        payments: [{ id: "payment-1", amount: 150, receivedAt: "2026-01-01T10:00:00.000Z" }],
      }),
      order({ id: "consumed", creditApplied: 30 }),
    ]);

    expect(result.clients[0]).toMatchObject({ conclusive: true, availableCreditCents: 2000, deficitCents: null });
  });

  it("reports a credit deficit without applying Math.max or redistributing history", () => {
    const result = reconcileFinancialDocuments([order({ id: "consumed", creditApplied: 10 })]);

    expect(result.clients[0]).toMatchObject({
      classification: "INCONSISTENT",
      conclusive: true,
      availableCreditCents: null,
      deficitCents: 1000,
    });
    expect(codes(result)).toContain("CLIENT_CREDIT_DEFICIT");
  });

  it("keeps cancelled payments and credit facts but makes dependent credit reconstruction inconclusive", () => {
    const generated = reconcileFinancialDocuments([order({
      orderStatus: "cancelled",
      amountPaid: 120,
      creditGenerated: 20,
      payments: [{ id: "payment", amount: 120, receivedAt: "2026-01-01T10:00:00.000Z" }],
    })]);
    const applied = reconcileFinancialDocuments([order({ orderStatus: "cancelled", creditApplied: 10 })]);

    expect(generated.orders[0]?.cashPaidCents).toBe(12000);
    expect(codes(generated)).toContain("CANCELLED_ORDER_SETTLEMENT_REQUIRED");
    expect(generated.clients[0]).toMatchObject({ conclusive: false, availableCreditCents: null });
    expect(applied.clients[0]).toMatchObject({ conclusive: false, availableCreditCents: null });
  });

  it("does not resolve a cancellation merely because generated credit was consumed by another order", () => {
    const result = reconcileFinancialDocuments([
      order({
        id: "cancelled-source",
        orderStatus: "cancelled",
        amountPaid: 150,
        creditGenerated: 50,
        payments: [{ id: "source-payment", amount: 150, receivedAt: "2026-01-01T10:00:00.000Z" }],
      }),
      order({ id: "consumer", creditApplied: 50 }),
    ]);

    expect(result.clients[0]).toMatchObject({ conclusive: false, availableCreditCents: null });
    expect(codes(result)).toContain("CANCELLED_CREDIT_SETTLEMENT_UNRESOLVED");
  });

  it("does not treat an absent, blocked or uninitialized aggregator as corruption", () => {
    const snapshots: ClientFinancialSnapshot[] = [
      { clientId: "client-1", state: "blocked" },
      { clientId: "client-2", state: "uninitialized" },
    ];
    const result = reconcileFinancialDocuments([
      order(),
      order({ id: "second", clientId: "client-2" }),
      order({ id: "third", clientId: "client-3" }),
    ], snapshots);

    expect(codes(result)).toEqual(expect.arrayContaining([
      "AGGREGATOR_BLOCKED",
      "AGGREGATOR_UNINITIALIZED",
      "AGGREGATOR_ABSENT",
    ]));
    expect(result.clients.find((entry) => entry.clientId === "client-3")?.classification).toBe("LEGACY_COMPATIBLE");
  });

  it("compares a ready aggregator only after a conclusive reconstruction", () => {
    const result = reconcileFinancialDocuments([order()], [{
      clientId: "client-1",
      state: "ready",
      availableCreditCents: 1,
      revision: 2,
    }]);

    expect(result.clients[0]).toMatchObject({ aggregatorComparison: "divergent", classification: "INCONSISTENT" });
    expect(codes(result)).toContain("AGGREGATOR_RECONSTRUCTION_MISMATCH");
  });

  it("is deterministic for documents in a different input order", () => {
    const documents = [
      order({ id: "b", amountPaid: 120, creditGenerated: 20, payments: [{ id: "p-b", amount: 120, receivedAt: "2026-01-01T10:00:00.000Z" }] }),
      order({ id: "a", creditApplied: 10 }),
    ];

    expect(reconcileFinancialDocuments(documents)).toEqual(reconcileFinancialDocuments([...documents].reverse()));
  });

  it("continues diagnosing independent orders after finding an inconsistent one", () => {
    const result = reconcileFinancialDocuments([
      order({ id: "broken", amountPaid: 10, payments: [{ id: "payment", amount: 9, receivedAt: null }] }),
      order({ id: "healthy", clientId: "client-2", amountPaid: 100, payments: [{ id: "payment-2", amount: 100, receivedAt: "2026-01-01T10:00:00.000Z" }] }),
    ]);

    expect(result.orders).toHaveLength(2);
    expect(result.orders.find((entry) => entry.orderId === "broken")?.classification).toBe("INCONSISTENT");
    expect(result.orders.find((entry) => entry.orderId === "healthy")).toMatchObject({
      classification: "VALID",
      cashPaidCents: 10000,
    });
  });

  it("runs a reproducible local dry-run fixture without database access", () => {
    const result = reconcileFinancialDocuments([
      order({ id: "dry-run-valid", amountPaid: 100, payments: [{ id: "p", amount: 100, receivedAt: "2026-01-01T10:00:00.000Z" }] }),
      order({ id: "dry-run-legacy", amountPaid: 5, payments: undefined }),
      order({ id: "dry-run-invalid", amountPaid: 10, payments: [{ id: "p", amount: 9, receivedAt: null }] }),
    ]);

    expect(result.summary).toMatchObject({ ordersAnalyzed: 3, clientsAnalyzed: 1, inconsistentRecords: 1 });
    expect(codes(result)).toContain("AMOUNT_PAID_PAYMENTS_MISMATCH");
  });
});
