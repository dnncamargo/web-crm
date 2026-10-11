import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { isFinancialApiError } from "../../api/_financial/errors";
import { correctPaymentTransaction, recordPaymentTransaction } from "../../api/_financial/paymentTransactions";
import type { CorrectPaymentCommand, RecordPaymentCommand } from "../../api/_financial/validation";

interface FixtureOptions {
  amountPaid?: number;
  creditGenerated?: number;
  payments?: unknown;
  orderStatus?: string;
  availableCreditCents?: number;
}

async function createFixture(options: FixtureOptions = {}) {
  const db = getFinancialAdminDb();
  const suffix = randomUUID();
  const clientId = `client-${suffix}`;
  const orderId = `order-${suffix}`;
  const order: Record<string, unknown> = {
    clientId,
    clientName: "Cliente de teste",
    total: 100,
    amountPaid: options.amountPaid ?? 0,
    orderStatus: options.orderStatus ?? "active",
    tagIds: [],
  };
  if (options.payments !== undefined) order.payments = options.payments;
  if (options.creditGenerated !== undefined) order.creditGenerated = options.creditGenerated;
  await db.doc(`orders/${orderId}`).set(order);
  await db.doc(`clientFinancial/${clientId}`).set({
    availableCreditCents: options.availableCreditCents ?? 0,
    revision: 1,
    state: "ready",
  });
  return { db, clientId, orderId };
}

function recordCommand(clientId: string, orderId: string, overrides: Partial<RecordPaymentCommand> = {}): RecordPaymentCommand {
  return {
    orderId,
    clientId,
    paymentId: `payment-${randomUUID()}`,
    amountCents: 5000,
    receivedAt: "2026-01-01T12:00:00.000Z",
    presentedAvailableCreditCents: 0,
    presentedRevision: 1,
    ...overrides,
  };
}

describe("payment transactions with Firestore Emulator", () => {
  it("registra recebimento, atualiza cache e gera crédito atomicamente", async () => {
    const fixture = await createFixture({ payments: [] });
    const payment = recordCommand(fixture.clientId, fixture.orderId, { amountCents: 12_000 });

    await expect(recordPaymentTransaction(fixture.db, payment)).resolves.toMatchObject({
      paymentId: payment.paymentId,
      amountPaidCents: 12_000,
      creditGeneratedCents: 2_000,
      availableCreditCents: 2_000,
      revision: 2,
      replayed: false,
    });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({
      amountPaid: 120,
      creditGenerated: 20,
      payments: [{ id: payment.paymentId, amount: 120, receivedAt: payment.receivedAt }],
      orderStatus: "active",
    });
  });

  it("aceita dois pagamentos iguais com identidades distintas e repete um deles sem efeito", async () => {
    const fixture = await createFixture({ payments: [] });
    const first = recordCommand(fixture.clientId, fixture.orderId, { amountCents: 2500 });
    await recordPaymentTransaction(fixture.db, first);
    const replay = await recordPaymentTransaction(fixture.db, first);
    const second = recordCommand(fixture.clientId, fixture.orderId, {
      amountCents: 2500,
      presentedRevision: 2,
    });
    await recordPaymentTransaction(fixture.db, second);

    expect(replay).toMatchObject({ replayed: true, revision: 2 });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toHaveLength(2);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()).toMatchObject({ revision: 3 });
  });

  it("rejeita colisão de ID e precondição financeira obsoleta sem escrita parcial", async () => {
    const fixture = await createFixture({ payments: [] });
    const payment = recordCommand(fixture.clientId, fixture.orderId);
    await recordPaymentTransaction(fixture.db, payment);
    const orderBefore = (await fixture.db.doc(`orders/${fixture.orderId}`).get()).data();
    const aggregatorBefore = (await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data();

    await expect(recordPaymentTransaction(fixture.db, { ...payment, amountCents: 7000 })).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "PAYMENT_ID_COLLISION"
    ));
    await expect(recordPaymentTransaction(fixture.db, recordCommand(fixture.clientId, fixture.orderId))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "AGGREGATOR_REVISION_CHANGED"
    ));
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).toEqual(orderBefore);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()).toEqual(aggregatorBefore);
  });

  it("materializa recebimento legado somente durante a transação", async () => {
    const fixture = await createFixture({ amountPaid: 20 });
    const payment = recordCommand(fixture.clientId, fixture.orderId, { amountCents: 3000 });
    await recordPaymentTransaction(fixture.db, payment);
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toEqual([
      { id: `legacy-${fixture.orderId}`, amount: 20, receivedAt: null },
      { id: payment.paymentId, amount: 30, receivedAt: payment.receivedAt },
    ]);
  });

  it("corrige um pagamento identificado e preserva os demais", async () => {
    const fixture = await createFixture({
      amountPaid: 120,
      creditGenerated: 20,
      payments: [
        { id: "payment-111", amount: 120, receivedAt: "2026-01-01T12:00:00.000Z" },
      ],
      availableCreditCents: 2000,
    });
    const command: CorrectPaymentCommand = {
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      paymentId: "payment-111",
      expectedAmountCents: 12_000,
      expectedReceivedAt: "2026-01-01T12:00:00.000Z",
      amountCents: 11_000,
      receivedAt: "2026-01-02T12:00:00.000Z",
      presentedAvailableCreditCents: 2_000,
      presentedRevision: 1,
    };
    await expect(correctPaymentTransaction(fixture.db, command)).resolves.toMatchObject({
      amountPaidCents: 11_000,
      creditGeneratedCents: 1_000,
      availableCreditCents: 1_000,
      revision: 2,
    });
    await expect(correctPaymentTransaction(fixture.db, command)).resolves.toMatchObject({ replayed: true, revision: 2 });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toEqual([
      { id: "payment-111", amount: 110, receivedAt: "2026-01-02T12:00:00.000Z" },
    ]);
  });

  it("bloqueia redução retroativa não coberta e correção em legado sem identidade persistida", async () => {
    const unavailable = await createFixture({
      amountPaid: 120,
      creditGenerated: 20,
      payments: [{ id: "payment-111", amount: 120, receivedAt: null }],
      availableCreditCents: 500,
    });
    const command: CorrectPaymentCommand = {
      orderId: unavailable.orderId,
      clientId: unavailable.clientId,
      paymentId: "payment-111",
      expectedAmountCents: 12_000,
      expectedReceivedAt: null,
      amountCents: 11_000,
      receivedAt: null,
      presentedAvailableCreditCents: 500,
      presentedRevision: 1,
    };
    await expect(correctPaymentTransaction(unavailable.db, command)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED"
    ));

    const legacy = await createFixture({ amountPaid: 10 });
    await expect(correctPaymentTransaction(legacy.db, {
      ...command,
      orderId: legacy.orderId,
      clientId: legacy.clientId,
      paymentId: `legacy-${legacy.orderId}`,
      expectedAmountCents: 1000,
      amountCents: 1000,
      presentedAvailableCreditCents: 0,
    })).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "LEGACY_PAYMENT_CORRECTION_REQUIRES_DECISION"
    ));
  });
});
