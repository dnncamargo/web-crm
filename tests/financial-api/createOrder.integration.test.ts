import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { createOrderTransaction } from "../../api/_financial/createOrder";
import { isFinancialApiError } from "../../api/_financial/errors";
import type { CreateOrderCommand } from "../../api/_financial/validation";
import type { Firestore } from "firebase-admin/firestore";
import { reconcileFinancialDocuments } from "../../src/features/financial/reconciliation";

function fixtureIds() {
  const suffix = randomUUID();
  return { clientId: `client-${suffix}`, orderId: `order-${suffix}` };
}

function command(clientId: string, orderId: string, overrides: Partial<CreateOrderCommand> = {}): CreateOrderCommand {
  return {
    orderId,
    clientId,
    clientName: "Cliente de teste",
    addressId: "address-test",
    addressSnapshot: {
      label: "Entrega", street: "Rua de teste", city: "São Paulo", number: "10",
    },
    deliveryDateTime: "2026-11-01T12:00:00-03:00",
    items: [{
      id: "item-test", productId: "product-test", productName: "Produto de teste",
      quantity: 1, unit: "unidade", unitPriceCents: 10000, totalCents: 10000,
      notes: "Sem açúcar", tagIds: ["tag-test"],
    }],
    subtotalCents: 10000,
    deliveryFeeCents: 0,
    totalCents: 10000,
    orderStatus: "active",
    notes: "Observação do pedido",
    tagIds: ["order-tag"],
    ...overrides,
  };
}

async function seedAggregator(clientId: string, availableCreditCents = 0, revision = 1, state = "ready") {
  const db = getFinancialAdminDb();
  await db.doc(`clientFinancial/${clientId}`).set({ availableCreditCents, revision, state });
}

describe("create order transaction with Firestore Emulator", () => {
  it("cria sem pagamento, preservando campos comerciais sem exigir agregador", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const result = await createOrderTransaction(db, command(ids.clientId, ids.orderId));
    const stored = (await db.doc(`orders/${ids.orderId}`).get()).data();

    expect(result).toMatchObject({ amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0, replayed: false });
    expect(stored).toMatchObject({
      clientName: "Cliente de teste", addressSnapshot: { street: "Rua de teste", city: "São Paulo" },
      items: [{ quantity: 1, unit: "unidade", unitPrice: 100, total: 100, notes: "Sem açúcar" }],
      subtotal: 100, deliveryFee: 0, total: 100, amountPaid: 0, payments: [], orderStatus: "active",
      notes: "Observação do pedido", tagIds: ["order-tag"],
    });
    expect(stored).not.toHaveProperty("creditGenerated");
  });

  it("preserva completed como status operacional sem inventar quitação ou recebimento", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await createOrderTransaction(db, command(ids.clientId, ids.orderId, { orderStatus: "completed" }));
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ orderStatus: "completed", amountPaid: 0, payments: [] });
  });

  it("registra pagamento inicial e cache derivados no mesmo commit", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const payment = { id: `payment-${randomUUID()}`, amountCents: 4000, receivedAt: "2026-10-11T12:30:00-03:00" };
    const result = await createOrderTransaction(db, command(ids.clientId, ids.orderId, { initialPayment: payment }));

    expect(result).toMatchObject({ amountPaidCents: 4000, creditGeneratedCents: 0, availableCreditCents: 0, revision: 2 });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({
      amountPaid: 40, payments: [{ id: payment.id, amount: 40, receivedAt: payment.receivedAt }],
    });
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 0, revision: 2 });
  });

  it("aplica crédito confirmado junto com recebimento e gera crédito excedente", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId, 5000, 7);
    const result = await createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 8000, receivedAt: "2026-10-11T12:30:00Z" },
      creditApplication: { applyCreditCents: 3000, presentedAvailableCreditCents: 5000, presentedRevision: 7, confirmed: true },
    }));
    expect(result).toMatchObject({ amountPaidCents: 8000, creditAppliedCents: 3000, creditGeneratedCents: 1000, availableCreditCents: 3000, revision: 8 });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ amountPaid: 80, creditApplied: 30, creditGenerated: 10 });
  });

  it("gera crédito quando o recebimento inicial excede o total", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const result = await createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 12000, receivedAt: "2026-10-11T12:30:00Z" },
    }));
    expect(result).toMatchObject({ creditGeneratedCents: 2000, availableCreditCents: 2000, revision: 2 });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ amountPaid: 120, creditGenerated: 20 });
  });

  it("reconcilia Pedido e agregador após a transação", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    await createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 12000, receivedAt: "2026-10-11T12:30:00Z" },
    }));
    const order = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const aggregator = (await db.doc(`clientFinancial/${ids.clientId}`).get()).data();
    const reconciliation = reconcileFinancialDocuments(
      [{ id: ids.orderId, ...order }],
      [{ clientId: ids.clientId, ...aggregator }],
    );
    expect(reconciliation.orders[0]).toMatchObject({ classification: "VALID", cashPaidCents: 12000, calculatedGeneratedCreditCents: 2000 });
    expect(reconciliation.clients[0]).toMatchObject({ conclusive: true, availableCreditCents: 2000, aggregatorComparison: "matches" });
  });

  it("repete comando idêntico como no-op e conflita com conteúdo divergente", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const original = command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 1000, receivedAt: "2026-10-11T12:30:00Z" },
    });
    const first = await createOrderTransaction(db, original);
    const replay = await createOrderTransaction(db, structuredClone(original));
    expect([first.replayed, replay.replayed].sort()).toEqual([false, true]);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ revision: 2 });
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, { notes: "conteúdo divergente" }))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.code === "ORDER_ID_COLLISION"
    ));
  });

  it("serializa duas tentativas concorrentes para a mesma identidade", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const same = command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 1000, receivedAt: "2026-10-11T12:30:00Z" },
    });
    const results = await Promise.all([createOrderTransaction(db, same), createOrderTransaction(db, same)]);
    expect(results.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect((await db.collection("orders").where("clientId", "==", ids.clientId).get()).size).toBe(1);
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.payments).toHaveLength(1);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()?.revision).toBe(2);
  });

  it("permite somente uma concorrente consumir o mesmo crédito", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const otherOrderId = `order-${randomUUID()}`;
    await seedAggregator(ids.clientId, 5000, 1);
    const first = command(ids.clientId, ids.orderId, {
      creditApplication: { applyCreditCents: 4000, presentedAvailableCreditCents: 5000, presentedRevision: 1, confirmed: true },
    });
    const second = command(ids.clientId, otherOrderId, {
      creditApplication: { applyCreditCents: 4000, presentedAvailableCreditCents: 5000, presentedRevision: 1, confirmed: true },
    });
    const results = await Promise.allSettled([createOrderTransaction(db, first), createOrderTransaction(db, second)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()?.availableCreditCents).toBe(1000);
  });

  it("rejeita revisão desatualizada, saldo insuficiente e agregador ausente ou inválido", async () => {
    const db = getFinancialAdminDb();
    const stale = fixtureIds();
    await seedAggregator(stale.clientId, 5000, 2);
    const credit = { applyCreditCents: 1000, presentedAvailableCreditCents: 5000, presentedRevision: 1, confirmed: true } as const;
    await expect(createOrderTransaction(db, command(stale.clientId, stale.orderId, { creditApplication: credit }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_REVISION_CHANGED");

    const insufficient = fixtureIds();
    await seedAggregator(insufficient.clientId, 500, 1);
    await expect(createOrderTransaction(db, command(insufficient.clientId, insufficient.orderId, {
      creditApplication: { ...credit, presentedAvailableCreditCents: 500, applyCreditCents: 1000 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INSUFFICIENT_AVAILABLE_CREDIT");

    const absent = fixtureIds();
    await expect(createOrderTransaction(db, command(absent.clientId, absent.orderId, { initialPayment: { id: `payment-${randomUUID()}`, amountCents: 100, receivedAt: "2026-10-11T12:30:00Z" } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");

    const invalid = fixtureIds();
    await seedAggregator(invalid.clientId, -1, 1);
    await expect(createOrderTransaction(db, command(invalid.clientId, invalid.orderId, { initialPayment: { id: `payment-${randomUUID()}`, amountCents: 100, receivedAt: "2026-10-11T12:30:00Z" } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");
  });

  it("rejeita fração de centavo, total incoerente e criação cancelada sem política", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      items: [{ id: "item-test", productId: "product-test", productName: "Produto", quantity: 0.5, unitPriceCents: 1, totalCents: 0 }],
      subtotalCents: 0, totalCents: 0,
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "MONETARY_VALUE_REQUIRES_CENT_PRECISION");
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      items: [{ id: "item-test", productId: "product-test", productName: "Produto", quantity: 2, unitPriceCents: Number.MAX_SAFE_INTEGER, totalCents: Number.MAX_SAFE_INTEGER }],
      subtotalCents: Number.MAX_SAFE_INTEGER, totalCents: Number.MAX_SAFE_INTEGER,
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_MONETARY_VALUE");
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, { totalCents: 10001 }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_TOTAL_MISMATCH");
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, { orderStatus: "cancelled" }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "CANCELLED_ORDER_CREATION_UNSUPPORTED");
    expect((await db.doc(`orders/${ids.orderId}`).get()).exists).toBe(false);
  });

  it("preserva o comando de entrada e não cria pagamento sintético no pedido sem recebimento", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const input = command(ids.clientId, ids.orderId);
    const before = structuredClone(input);
    await createOrderTransaction(db, input);
    expect(input).toEqual(before);
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.payments).toEqual([]);
  });

  it("aborta o commit integral se a atualização financeira falhar após preparar o Pedido", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const originalRunTransaction = db.runTransaction.bind(db);
    const failingDb = Object.create(db) as Firestore;
    failingDb.runTransaction = ((updateFunction, options) => originalRunTransaction(async (transaction) => {
      const failingTransaction = new Proxy(transaction, {
        get(target, property) {
          if (property === "update") return () => { throw new Error("falha de escrita injetada"); };
          const value: unknown = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return updateFunction(failingTransaction);
    }, options)) as typeof db.runTransaction;

    await expect(createOrderTransaction(failingDb, command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 1000, receivedAt: "2026-10-11T12:30:00Z" },
    }))).rejects.toThrow("falha de escrita injetada");
    expect((await db.doc(`orders/${ids.orderId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 0, revision: 1 });
  });
});
