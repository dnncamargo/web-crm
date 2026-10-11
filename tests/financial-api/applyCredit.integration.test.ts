import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { applyCreditTransaction } from "../../api/_financial/applyCredit";
import type { FinancialActor } from "../../api/_financial/auth";
import { isFinancialApiError } from "../../api/_financial/errors";
import type { ApplyCreditCommand } from "../../api/_financial/validation";

const actor: FinancialActor = { uid: "emulator-user", email: "allowed@example.test" };

function fixtureIds() {
  const suffix = randomUUID();
  return { clientId: `client-${suffix}`, orderId: `order-${suffix}` };
}

interface FixtureOptions {
  includeTargetPayments?: boolean;
  targetOrder?: Record<string, unknown>;
}

async function createFixture(availableCreditCents = 5000, options: FixtureOptions = {}) {
  const db = getFinancialAdminDb();
  const { clientId, orderId } = fixtureIds();
  const generatedCredit = availableCreditCents / 100;
  await db.doc(`orders/seed-${clientId}`).set({
    clientId,
    clientName: "Cliente de teste",
    total: 100,
    amountPaid: 100 + generatedCredit,
    payments: [{ id: `payment-${clientId}`, amount: 100 + generatedCredit, receivedAt: "2026-01-01T00:00:00.000Z" }],
    creditGenerated: generatedCredit,
    orderStatus: "active",
    tagIds: [],
  });
  const targetOrder: Record<string, unknown> = {
    clientId,
    clientName: "Cliente de teste",
    total: 80,
    amountPaid: 0,
    orderStatus: "active",
    tagIds: [],
    ...options.targetOrder,
  };
  if (options.includeTargetPayments !== false && !("payments" in targetOrder)) {
    targetOrder.payments = [];
  }
  await db.doc(`orders/${orderId}`).set(targetOrder);
  await db.doc(`clientFinancial/${clientId}`).set({
    availableCreditCents,
    revision: 1,
    state: "ready",
  });
  return { db, clientId, orderId };
}

function command(clientId: string, orderId: string, operationId = `operation-${randomUUID()}`): ApplyCreditCommand {
  return {
    operationId,
    clientId,
    orderId,
    applyCreditCents: 3000,
    presentedAvailableCreditCents: 5000,
    presentedRevision: 1,
    confirmed: true,
  };
}

describe("apply credit transaction with Firestore Emulator", () => {
  async function expectInvalidPaymentState(targetOrder: Record<string, unknown>) {
    const fixture = await createFixture(5000, { targetOrder });
    const orderRef = fixture.db.doc(`orders/${fixture.orderId}`);
    const aggregatorRef = fixture.db.doc(`clientFinancial/${fixture.clientId}`);
    const orderBefore = (await orderRef.get()).data();
    const aggregatorBefore = (await aggregatorRef.get()).data();

    await expect(applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "INVALID_FINANCIAL_STATE"
    ));

    expect((await orderRef.get()).data()).toEqual(orderBefore);
    expect((await aggregatorRef.get()).data()).toEqual(aggregatorBefore);
  }

  it("atualiza pedido, agregador e registro idempotente em uma única transação", async () => {
    const fixture = await createFixture();
    const result = await applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor);

    expect(result).toMatchObject({ appliedCreditCents: 3000, availableCreditCents: 2000, revision: 2, replayed: false });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.creditApplied).toBe(30);
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toEqual([]);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()).toMatchObject({
      availableCreditCents: 2000,
      revision: 2,
      state: "ready",
    });
  });

  it("aceita pagamentos persistidos válidos com amountPaid coerente", async () => {
    const fixture = await createFixture(5000, {
      targetOrder: {
        amountPaid: 10,
        payments: [{ id: "payment-valid", amount: 10, receivedAt: "2026-01-01T00:00:00.000Z" }],
      },
    });

    await expect(applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor)).resolves.toMatchObject({
      appliedCreditCents: 3000,
      availableCreditCents: 2000,
    });
  });

  it("aceita documento legado sem payments usando amountPaid válido", async () => {
    const fixture = await createFixture(5000, {
      includeTargetPayments: false,
      targetOrder: { amountPaid: 10 },
    });

    await expect(applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor)).resolves.toMatchObject({
      appliedCreditCents: 3000,
    });
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()).not.toHaveProperty("payments");
  });

  it("aceita payments vazio somente quando amountPaid é zero", async () => {
    const fixture = await createFixture();

    await expect(applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor)).resolves.toMatchObject({
      appliedCreditCents: 3000,
    });
  });

  it.each([
    ["payments vazio com amountPaid positivo", { amountPaid: 10, payments: [] }],
    ["identificador vazio", { amountPaid: 10, payments: [{ id: " ", amount: 10, receivedAt: null }] }],
    ["identificadores duplicados", {
      amountPaid: 10,
      payments: [
        { id: "payment-duplicate", amount: 5, receivedAt: null },
        { id: "payment-duplicate", amount: 5, receivedAt: null },
      ],
    }],
    ["valor negativo", { amountPaid: 0, payments: [{ id: "payment-negative", amount: -1, receivedAt: null }] }],
    ["valor zero", { amountPaid: 0, payments: [{ id: "payment-zero", amount: 0, receivedAt: null }] }],
    ["valor infinito", { amountPaid: 0, payments: [{ id: "payment-infinite", amount: Number.POSITIVE_INFINITY, receivedAt: null }] }],
    ["valor subcentavo", { amountPaid: 0, payments: [{ id: "payment-subcent", amount: 0.001, receivedAt: null }] }],
    ["data inválida", { amountPaid: 10, payments: [{ id: "payment-date", amount: 10, receivedAt: "invalid" }] }],
    ["soma divergente do cache legado", { amountPaid: 10, payments: [{ id: "payment-mismatch", amount: 9, receivedAt: null }] }],
  ] as const)("recusa %s sem alterar pedido ou agregador", async (_caseName, targetOrder) => {
    await expectInvalidPaymentState(targetOrder);
  });

  it("aceita receivedAt nulo em lançamento legado", async () => {
    const fixture = await createFixture(5000, {
      targetOrder: {
        amountPaid: 10,
        payments: [{ id: "payment-legacy-date", amount: 10, receivedAt: null }],
      },
    });

    await expect(applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId), actor)).resolves.toMatchObject({
      appliedCreditCents: 3000,
    });
  });

  it("reexecuta a mesma chave sem segundo efeito econômico, inclusive em concorrência", async () => {
    const fixture = await createFixture();
    const repeatedCommand = command(fixture.clientId, fixture.orderId, `operation-${randomUUID()}`);
    const results = await Promise.all([
      applyCreditTransaction(fixture.db, repeatedCommand, actor),
      applyCreditTransaction(fixture.db, repeatedCommand, actor),
    ]);

    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()?.availableCreditCents).toBe(2000);
  });

  it("serializa concorrência de chaves distintas e não permite saldo negativo", async () => {
    const fixture = await createFixture();
    const first = { ...command(fixture.clientId, fixture.orderId), applyCreditCents: 4000 };
    const secondOrderId = `order-${randomUUID()}`;
    await fixture.db.doc(`orders/${secondOrderId}`).set({
      clientId: fixture.clientId,
      clientName: "Cliente de teste",
      total: 80,
      amountPaid: 0,
      payments: [],
      orderStatus: "active",
      tagIds: [],
    });
    const second = { ...command(fixture.clientId, secondOrderId), applyCreditCents: 4000 };

    const outcomes = await Promise.allSettled([
      applyCreditTransaction(fixture.db, first, actor),
      applyCreditTransaction(fixture.db, second, actor),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect((await fixture.db.doc(`clientFinancial/${fixture.clientId}`).get()).data()?.availableCreditCents).toBe(1000);
  });

  it("recusa confirmação com saldo ou revisão desatualizados", async () => {
    const fixture = await createFixture(4000);
    const staleBalance = command(fixture.clientId, fixture.orderId);
    await expect(applyCreditTransaction(fixture.db, staleBalance, actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "CREDIT_BALANCE_CHANGED"
    ));

    const staleRevision = { ...command(fixture.clientId, fixture.orderId), presentedAvailableCreditCents: 4000, presentedRevision: 0 };
    await expect(applyCreditTransaction(fixture.db, staleRevision, actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "AGGREGATOR_REVISION_CHANGED"
    ));
  });

  it("recusa agregador bloqueado, ausente e pedido cancelado", async () => {
    const blockedFixture = await createFixture();
    await blockedFixture.db.doc(`clientFinancial/${blockedFixture.clientId}`).update({ state: "blocked" });
    await expect(applyCreditTransaction(blockedFixture.db, command(blockedFixture.clientId, blockedFixture.orderId), actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE"
    ));

    const absentFixture = await createFixture();
    await absentFixture.db.doc(`clientFinancial/${absentFixture.clientId}`).delete();
    await expect(applyCreditTransaction(absentFixture.db, command(absentFixture.clientId, absentFixture.orderId), actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE"
    ));

    const cancelledFixture = await createFixture();
    await cancelledFixture.db.doc(`orders/${cancelledFixture.orderId}`).update({ orderStatus: "cancelled" });
    await expect(applyCreditTransaction(cancelledFixture.db, command(cancelledFixture.clientId, cancelledFixture.orderId), actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "ORDER_CANCELLED"
    ));
  });

  it("rejeita colisão idempotente em vez de alterar silenciosamente o valor", async () => {
    const fixture = await createFixture();
    const operationId = `operation-${randomUUID()}`;
    await applyCreditTransaction(fixture.db, command(fixture.clientId, fixture.orderId, operationId), actor);
    const collision = { ...command(fixture.clientId, fixture.orderId, operationId), applyCreditCents: 2000 };

    await expect(applyCreditTransaction(fixture.db, collision, actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "IDEMPOTENCY_COLLISION"
    ));
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.creditApplied).toBe(30);
  });

  it("rejeita pedido de outro cliente sem alteração", async () => {
    const fixture = await createFixture();
    const mismatched = command(`other-${randomUUID()}`, fixture.orderId);
    await fixture.db.doc(`clientFinancial/${mismatched.clientId}`).set({
      availableCreditCents: 5000,
      revision: 1,
      state: "ready",
    });
    await expect(applyCreditTransaction(fixture.db, mismatched, actor)).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "CLIENT_MISMATCH"
    ));
    expect((await fixture.db.doc(`orders/${fixture.orderId}`).get()).data()?.creditApplied).toBeUndefined();
  });
});
