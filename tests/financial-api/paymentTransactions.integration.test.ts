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
      currentAmountPaidCents: 12_000,
      currentCreditGeneratedCents: 2_000,
      currentAvailableCreditCents: 2_000,
      currentRevision: 2,
      replayed: false,
    });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({
      amountPaid: 120,
      creditGenerated: 20,
      payments: [{ id: payment.paymentId, amount: 120, receivedAt: payment.receivedAt }],
      orderStatus: "active",
    });
  });

  it("aceita dois pagamentos iguais com identidades distintas e retorna a projeção atual no replay", async () => {
    const fixture = await createFixture({ payments: [] });
    const first = recordCommand(fixture.clientId, fixture.orderId, { amountCents: 2500 });
    await recordPaymentTransaction(fixture.db, first);
    const second = recordCommand(fixture.clientId, fixture.orderId, {
      amountCents: 2500,
      presentedRevision: 2,
    });
    await recordPaymentTransaction(fixture.db, second);
    const replay = await recordPaymentTransaction(fixture.db, first);

    expect(replay).toMatchObject({
      replayed: true,
      currentAmountPaidCents: 5000,
      currentRevision: 3,
    });
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

  it("permite replay idempotente em pedido cancelado, mas bloqueia um novo recebimento", async () => {
    const fixture = await createFixture({ payments: [] });
    const payment = recordCommand(fixture.clientId, fixture.orderId);
    await recordPaymentTransaction(fixture.db, payment);
    await fixture.db.doc(`orders/${fixture.orderId}`).update({ orderStatus: "cancelled" });
    const orderBeforeReplay = (await fixture.db.doc(`orders/${fixture.orderId}`).get()).data();
    const aggregatorBeforeReplay = (await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data();

    await expect(recordPaymentTransaction(fixture.db, payment)).resolves.toMatchObject({
      replayed: true,
      currentRevision: 2,
    });
    await expect(recordPaymentTransaction(fixture.db, recordCommand(fixture.clientId, fixture.orderId, {
      presentedRevision: 2,
    }))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "ORDER_CANCELLED"
    ));
    await expect(recordPaymentTransaction(fixture.db, { ...payment, amountCents: 6000 })).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "PAYMENT_ID_COLLISION"
    ));
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).toEqual(orderBeforeReplay);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()).toEqual(aggregatorBeforeReplay);
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
      currentAmountPaidCents: 11_000,
      currentCreditGeneratedCents: 1_000,
      currentAvailableCreditCents: 1_000,
      currentRevision: 2,
    });
    await expect(correctPaymentTransaction(fixture.db, command)).resolves.toMatchObject({ replayed: true, currentRevision: 2 });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toEqual([
      { id: "payment-111", amount: 110, receivedAt: "2026-01-02T12:00:00.000Z" },
    ]);
  });

  it("recusa o comando de registro original depois que o pagamento foi corrigido", async () => {
    const fixture = await createFixture({ payments: [] });
    const original = recordCommand(fixture.clientId, fixture.orderId);
    await recordPaymentTransaction(fixture.db, original);
    await correctPaymentTransaction(fixture.db, {
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      paymentId: original.paymentId,
      expectedAmountCents: original.amountCents,
      expectedReceivedAt: original.receivedAt,
      amountCents: 6000,
      receivedAt: original.receivedAt,
      presentedAvailableCreditCents: 0,
      presentedRevision: 2,
    });

    await expect(recordPaymentTransaction(fixture.db, original)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "PAYMENT_ID_COLLISION"
    ));
  });

  it("serializa correções concorrentes com estados desejados diferentes", async () => {
    const fixture = await createFixture({
      amountPaid: 50,
      payments: [{ id: "payment-concurrent", amount: 50, receivedAt: "2026-01-01T12:00:00.000Z" }],
    });
    const base: CorrectPaymentCommand = {
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      paymentId: "payment-concurrent",
      expectedAmountCents: 5000,
      expectedReceivedAt: "2026-01-01T12:00:00.000Z",
      amountCents: 6000,
      receivedAt: "2026-01-02T12:00:00.000Z",
      presentedAvailableCreditCents: 0,
      presentedRevision: 1,
    };
    const outcomes = await Promise.allSettled([
      correctPaymentTransaction(fixture.db, base),
      correctPaymentTransaction(fixture.db, { ...base, amountCents: 7000, receivedAt: "2026-01-03T12:00:00.000Z" }),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
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

  it("preserva a data histórica desconhecida, mas não apaga uma data conhecida", async () => {
    const fixture = await createFixture({
      amountPaid: 20,
      payments: [{ id: "payment-null-date", amount: 20, receivedAt: null }],
    });
    const preserveUnknownDate: CorrectPaymentCommand = {
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      paymentId: "payment-null-date",
      expectedAmountCents: 2000,
      expectedReceivedAt: null,
      amountCents: 2500,
      receivedAt: null,
      presentedAvailableCreditCents: 0,
      presentedRevision: 1,
    };
    await correctPaymentTransaction(fixture.db, preserveUnknownDate);
    const setKnownDate = {
      ...preserveUnknownDate,
      expectedAmountCents: 2500,
      amountCents: 2500,
      receivedAt: "2026-01-03T12:00:00.000Z",
      presentedRevision: 2,
    };
    await correctPaymentTransaction(fixture.db, setKnownDate);
    const orderBeforeRemoval = (await fixture.db.doc(`orders/${fixture.orderId}`).get()).data();

    await expect(correctPaymentTransaction(fixture.db, {
      ...setKnownDate,
      expectedReceivedAt: setKnownDate.receivedAt,
      receivedAt: null,
      presentedRevision: 3,
    })).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "RECEIVED_AT_REMOVAL_REQUIRES_DECISION"
    ));
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).toEqual(orderBeforeRemoval);
  });
});
