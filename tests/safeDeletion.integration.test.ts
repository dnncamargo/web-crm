import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../api/_financial/admin";
import { FinancialApiError } from "../api/_financial/errors";
import { deleteCancelledOrder, deleteConfirmedTestOrder, deleteInactiveClient } from "../api/_deletion/eligibility";
import type { ConfirmedTestOrderDeletionFixture } from "../src/features/orders/testOrderDeletion";
import { testOrderDeletionConfirmation } from "../src/features/orders/testOrderDeletion";

const db = getFinancialAdminDb();
const orderIds: string[] = [];
const clientIds: string[] = [];

async function seedOrder(options: {
  orderStatus?: "active" | "completed" | "cancelled";
  amountPaid?: number;
  payments?: unknown;
  total?: number;
  omitAgreement?: boolean;
} = {}) {
  const id = `order-${randomUUID()}`;
  const clientId = `client-${randomUUID()}`;
  orderIds.push(id);
  clientIds.push(clientId);
  const data: Record<string, unknown> = {
    clientId,
    clientName: "Cliente sintético",
    orderStatus: options.orderStatus ?? "cancelled",
    total: options.total ?? 32,
    subtotal: options.total ?? 32,
    deliveryFee: 0,
    items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: options.total ?? 32, total: options.total ?? 32 }],
    amountPaid: options.amountPaid ?? 0,
    payments: options.payments ?? [],
    creditApplied: 0,
    creditGenerated: 0,
    cancellationAgreement: { operationId: "operation-123", text: "Cancelamento combinado." },
  };
  if (options.omitAgreement) delete data.cancellationAgreement;
  await db.doc(`orders/${id}`).set(data);
  return { id, clientId };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((error: unknown) => error instanceof FinancialApiError && error.code === code);
}

describe("safe deletion transactions", () => {
  beforeEach(() => {
    orderIds.length = 0;
    clientIds.length = 0;
  });

  afterEach(async () => {
    await Promise.all(orderIds.map(async (id) => {
      const orderRef = db.doc(`orders/${id}`);
      for (const subcollection of await orderRef.listCollections()) {
        const documents = await subcollection.get();
        await Promise.all(documents.docs.map((document) => document.ref.delete()));
      }
      await db.doc(`orders/${id}`).delete().catch(() => undefined);
    }));
    await Promise.all(clientIds.map(async (id) => {
      const clientRef = db.doc(`clients/${id}`);
      for (const subcollection of await clientRef.listCollections()) {
        const documents = await subcollection.get();
        await Promise.all(documents.docs.map((document) => document.ref.delete()));
      }
      const [orders, tasks, addresses] = await Promise.all([
        db.collection("orders").where("clientId", "==", id).get(),
        db.collection("tasks").where("clientId", "==", id).get(),
        db.collection("addresses").where("clientId", "==", id).get(),
      ]);
      await Promise.all([...orders.docs, ...tasks.docs, ...addresses.docs].map((document) => document.ref.delete()));
      await db.doc(`clients/${id}`).delete().catch(() => undefined);
      await db.doc(`clientFinancial/${id}`).delete().catch(() => undefined);
    }));
  });

  it("deletes a cancelled order with no movement and conclusive reconciliation", async () => {
    const fixture = await seedOrder();
    await expect(deleteCancelledOrder(db, fixture.id)).resolves.toBeUndefined();
    expect((await db.doc(`orders/${fixture.id}`).get()).exists).toBe(false);
  });

  it("blocks active orders", async () => {
    const fixture = await seedOrder({ orderStatus: "active" });
    await expectCode(deleteCancelledOrder(db, fixture.id), "ORDER_NOT_CANCELLED");
    expect((await db.doc(`orders/${fixture.id}`).get()).exists).toBe(true);
  });

  it("blocks a cancelled order with recorded payments", async () => {
    const fixture = await seedOrder({
      amountPaid: 20,
      payments: [{ id: "payment-123", amount: 20, receivedAt: "2026-10-01T10:00:00Z" }],
    });
    await expectCode(deleteCancelledOrder(db, fixture.id), "ORDER_HAS_FINANCIAL_ACTIVITY");
    expect((await db.doc(`orders/${fixture.id}`).get()).exists).toBe(true);
  });

  it("blocks cancelled orders whose financial facts are inconclusive", async () => {
    const fixture = await seedOrder({ total: Number.NaN });
    await expectCode(deleteCancelledOrder(db, fixture.id), "ORDER_FINANCIALS_INCONCLUSIVE");
    expect((await db.doc(`orders/${fixture.id}`).get()).exists).toBe(true);
  });

  it("preserves cancellation operation subcollection records", async () => {
    const fixture = await seedOrder();
    await db.doc(`orders/${fixture.id}/cancellationOperations/operation-123`).set({ fingerprint: "fixture" });
    await expectCode(deleteCancelledOrder(db, fixture.id), "ORDER_HAS_DEPENDENCIES");
    expect((await db.doc(`orders/${fixture.id}`).get()).exists).toBe(true);
  });

  it.each(["orders", "tasks", "addresses"] as const)("blocks Client deletion when a %s dependency exists", async (collection) => {
    const fixture = await seedOrder();
    await db.doc(`clients/${fixture.clientId}`).set({ name: "Cliente", active: false });
    const dependency = collection === "orders"
      ? db.doc(`orders/${fixture.id}`)
      : db.collection(collection).doc(`dependency-${randomUUID()}`);
    if (collection !== "orders") {
      await dependency.set({ clientId: fixture.clientId });
    }
    await expectCode(deleteInactiveClient(db, fixture.clientId), "CLIENT_HAS_DEPENDENCIES");
    expect((await db.doc(`clients/${fixture.clientId}`).get()).exists).toBe(true);
  });

  it("deletes an inactive Client only when dependencies and reconciled credit are empty", async () => {
    const clientId = `client-${randomUUID()}`;
    clientIds.push(clientId);
    await db.doc(`clients/${clientId}`).set({ name: "Cliente sem histórico", active: false });
    await db.doc(`clientFinancial/${clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 0 });
    await expect(deleteInactiveClient(db, clientId)).resolves.toBeUndefined();
    expect((await db.doc(`clients/${clientId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${clientId}`).get()).exists).toBe(false);
  });

  it("blocks Client deletion when its financial state is unknown or nonzero", async () => {
    const clientId = `client-${randomUUID()}`;
    clientIds.push(clientId);
    await db.doc(`clients/${clientId}`).set({ name: "Cliente", active: false });
    await db.doc(`clientFinancial/${clientId}`).set({ state: "blocked", availableCreditCents: 0, revision: 1 });
    await expectCode(deleteInactiveClient(db, clientId), "CLIENT_FINANCIAL_STATE_UNKNOWN");
    expect((await db.doc(`clients/${clientId}`).get()).exists).toBe(true);
  });

  it("blocks Client deletion when a nested subcollection still needs preservation", async () => {
    const clientId = `client-${randomUUID()}`;
    clientIds.push(clientId);
    await db.doc(`clients/${clientId}`).set({ name: "Cliente com histórico", active: false });
    await db.doc(`clients/${clientId}/history/entry-1`).set({ note: "Histórico legado" });
    await expectCode(deleteInactiveClient(db, clientId), "CLIENT_HAS_DEPENDENCIES");
    expect((await db.doc(`clients/${clientId}`).get()).exists).toBe(true);
  });

  it("deletes synthetic test fixtures only with explicit confirmation and exact ID/value matches", async () => {
    const fixtures: ConfirmedTestOrderDeletionFixture[] = [
      { id: `test-${randomUUID()}`, totalCents: 3200, cashPaidCents: 2000 },
      { id: `test-${randomUUID()}`, totalCents: 8000, cashPaidCents: 12000 },
      { id: `test-${randomUUID()}`, totalCents: 4000, cashPaidCents: 0 },
    ];
    const clientId = `client-${randomUUID()}`;
    clientIds.push(clientId);
    await db.doc(`clients/${clientId}`).set({ name: "Cliente Teste", active: true });
    for (const [index, fixture] of fixtures.entries()) {
      orderIds.push(fixture.id);
      const total = fixture.totalCents / 100;
      const cashPaid = fixture.cashPaidCents / 100;
      await db.doc(`orders/${fixture.id}`).set({
        clientId,
        clientName: "Cliente Teste",
        orderStatus: index === 1 ? "active" : "cancelled",
        total,
        subtotal: total,
        deliveryFee: 0,
        items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: total, total }],
        amountPaid: cashPaid,
        payments: cashPaid > 0 ? [{ id: `payment-${index}-123`, amount: cashPaid, receivedAt: "2026-10-01T10:00:00Z" }] : [],
        creditApplied: 0,
        creditGenerated: Math.max(cashPaid - total, 0),
      });
    }
    const testOperationRef = db.doc(`orders/${fixtures[0]!.id}/cancellationOperations/test-operation`);
    await testOperationRef.set({ fingerprint: "synthetic test fixture" });
    await expectCode(deleteConfirmedTestOrder(db, fixtures[0]!.id, "", fixtures), "TEST_DATA_CONFIRMATION_REQUIRED");
    await expect(deleteConfirmedTestOrder(db, fixtures[0]!.id, testOrderDeletionConfirmation, fixtures)).resolves.toBeUndefined();
    expect((await db.doc(`orders/${fixtures[0]!.id}`).get()).exists).toBe(false);
    expect((await testOperationRef.get()).exists).toBe(false);
    await expect(deleteConfirmedTestOrder(db, fixtures[1]!.id, testOrderDeletionConfirmation, fixtures)).resolves.toBeUndefined();
    await expect(deleteConfirmedTestOrder(db, fixtures[2]!.id, testOrderDeletionConfirmation, fixtures)).resolves.toBeUndefined();
    expect((await db.collection("orders").where("clientId", "==", clientId).get()).empty).toBe(true);
  });

  it("rejects a whitelisted test ID when its financial values have changed", async () => {
    const fixtureId = `test-${randomUUID()}`;
    const clientId = `client-${randomUUID()}`;
    clientIds.push(clientId);
    orderIds.push(fixtureId);
    const fixture = { id: fixtureId, totalCents: 3200, cashPaidCents: 2000 };
    await db.doc(`clients/${clientId}`).set({ name: "Cliente Teste", active: true });
    await db.doc(`orders/${fixtureId}`).set({
      clientId, clientName: "Cliente Teste", orderStatus: "cancelled", total: 32, amountPaid: 19,
      payments: [{ id: "payment-123", amount: 19, receivedAt: "2026-10-01T10:00:00Z" }],
      creditApplied: 0, creditGenerated: 0,
    });
    await expectCode(deleteConfirmedTestOrder(db, fixtureId, testOrderDeletionConfirmation, [fixture]), "NOT_CONFIRMED_TEST_DATA");
    expect((await db.doc(`orders/${fixtureId}`).get()).exists).toBe(true);
  });
});
