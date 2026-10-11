import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "./admin";
import { applyCreditTransaction } from "./applyCredit";
import type { FinancialActor } from "./auth";
import { isFinancialApiError } from "./errors";
import type { ApplyCreditCommand } from "./validation";

const actor: FinancialActor = { uid: "emulator-user", email: "allowed@example.test" };

function fixtureIds() {
  const suffix = randomUUID();
  return { clientId: `client-${suffix}`, orderId: `order-${suffix}` };
}

async function createFixture(availableCreditCents = 5000) {
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
  await db.doc(`orders/${orderId}`).set({
    clientId,
    clientName: "Cliente de teste",
    total: 80,
    amountPaid: 0,
    payments: [],
    orderStatus: "active",
    tagIds: [],
  });
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
