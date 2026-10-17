import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { isFinancialApiError } from "../../api/_financial/errors";
import { correctPaymentProductionTransaction } from "../../api/_financial/paymentTransactions";
import type { ProductionCorrectPaymentCommand } from "../../api/_financial/validation";

interface Fixture {
  clientId: string;
  orderId: string;
  paymentId: string;
  db: ReturnType<typeof getFinancialAdminDb>;
  amountPaid: number;
  receivedAt: string;
}

async function createFixture(options: {
  amount?: number;
  total?: number;
  anotherInconclusiveOrder?: boolean;
  legacy?: boolean;
} = {}): Promise<Fixture> {
  const db = getFinancialAdminDb();
  const suffix = randomUUID();
  const clientId = `client-${suffix}`;
  const orderId = `order-${suffix}`;
  const paymentId = `payment-${randomUUID()}`;
  const amount = options.amount ?? 30;
  const total = options.total ?? 100;
  const receivedAt = "2026-10-16T12:00:00.000Z";
  const creditGenerated = Math.max(amount - total, 0);
  const order: Record<string, unknown> = {
    clientId,
    clientName: "Cliente de teste",
    orderStatus: "active",
    deliveryDateTime: "2026-10-20T12:00",
    items: [{
      id: `item-${randomUUID()}`,
      productId: "product-test",
      productName: "Produto de teste",
      quantity: 1,
      unit: "un",
      unitPrice: total,
      total,
    }],
    subtotal: total,
    deliveryFee: 0,
    total,
    amountPaid: amount,
    creditApplied: 0,
    ...(creditGenerated > 0 ? { creditGenerated } : {}),
    tagIds: [],
  };
  if (!options.legacy) {
    order.payments = [{ id: paymentId, amount, receivedAt }];
  }
  await db.doc(`orders/${orderId}`).set(order);
  if (options.anotherInconclusiveOrder) {
    await db.doc(`orders/inconclusive-${suffix}`).set({
      clientId,
      clientName: "Cliente de teste",
      orderStatus: "active",
      total: 40,
      amountPaid: 0,
      payments: [],
      tagIds: [],
    });
  }
  return { db, clientId, orderId, paymentId, amountPaid: amount, receivedAt };
}

function command(fixture: Fixture, overrides: Partial<ProductionCorrectPaymentCommand> = {}): ProductionCorrectPaymentCommand {
  return {
    orderId: fixture.orderId,
    clientId: fixture.clientId,
    paymentId: fixture.paymentId,
    expectedAmountCents: Math.round(fixture.amountPaid * 100),
    expectedReceivedAt: fixture.receivedAt,
    amountCents: 3500,
    receivedAt: "2026-10-17T13:45:00.000Z",
    ...overrides,
  };
}

async function readOrder(fixture: Fixture) {
  return (await fixture.db.doc(`orders/${fixture.orderId}`).get()).data();
}

describe("production payment correction transaction", () => {
  it("overwrites the existing value and timestamp without creating an aggregator or another payment", async () => {
    const fixture = await createFixture({ amount: 30, total: 100 });
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture))).resolves.toMatchObject({
      paymentId: fixture.paymentId,
      currentAmountPaidCents: 3500,
      currentCreditGeneratedCents: 0,
      currentAvailableCreditCents: 0,
      replayed: false,
    });
    const order = await readOrder(fixture);
    expect(order?.amountPaid).toBe(35);
    expect(order?.payments).toEqual([{
      id: fixture.paymentId,
      amount: 35,
      receivedAt: "2026-10-17T13:45:00.000Z",
    }]);
    expect(order?.creditGenerated).toBeUndefined();
    await expect(fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).resolves.toMatchObject({ exists: false });
  });

  it("allows correcting a value upward when it increases available credit", async () => {
    const fixture = await createFixture({ amount: 90, total: 100 });
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture, {
      expectedAmountCents: 9000,
      amountCents: 11_000,
    }))).resolves.toMatchObject({
      currentAmountPaidCents: 11_000,
      currentCreditGeneratedCents: 1_000,
      currentAvailableCreditCents: 1_000,
    });
    expect(await readOrder(fixture)).toMatchObject({
      amountPaid: 110,
      creditGenerated: 10,
    });
  });

  it("blocks changes that reduce generated client credit while other production writers remain on the SDK", async () => {
    const fixture = await createFixture({ amount: 120, total: 100 });
    const orderBefore = await readOrder(fixture);
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture, {
      expectedAmountCents: 12_000,
      amountCents: 11_000,
    }))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "PRODUCTION_CREDIT_REDUCTION_REQUIRES_CUTOVER"
    ));
    expect(await readOrder(fixture)).toEqual(orderBefore);
  });

  it("blocks when the customer's other orders make its credit reconstruction inconclusive", async () => {
    const fixture = await createFixture({ amount: 30, total: 100, anotherInconclusiveOrder: true });
    const orderBefore = await readOrder(fixture);
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "CLIENT_FINANCIAL_STATE_INCONCLUSIVE"
    ));
    expect(await readOrder(fixture)).toEqual(orderBefore);
  });

  it("continues to block legacy payments without a persisted payment identity", async () => {
    const fixture = await createFixture({ amount: 30, total: 100, legacy: true });
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "LEGACY_PAYMENT_CORRECTION_REQUIRES_DECISION"
    ));
  });

  it("rejects stale expected state and preserves the existing payment", async () => {
    const fixture = await createFixture({ amount: 30, total: 100 });
    const orderBefore = await readOrder(fixture);
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture, {
      expectedAmountCents: 2900,
    }))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "PAYMENT_PRECONDITION_CHANGED"
    ));
    expect(await readOrder(fixture)).toEqual(orderBefore);
  });

  it("does not permit deleting a known receipt date", async () => {
    const fixture = await createFixture({ amount: 30, total: 100 });
    await expect(correctPaymentProductionTransaction(fixture.db, command(fixture, {
      receivedAt: null,
    }))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "RECEIVED_AT_REMOVAL_REQUIRES_DECISION"
    ));
  });
});
