import { randomUUID } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { createOrderTransaction } from "../../api/_financial/createOrder";
import { editOrderTransaction } from "../../api/_financial/orderEdit";
import { applyCreditTransaction } from "../../api/_financial/applyCredit";
import { recordPaymentTransaction } from "../../api/_financial/paymentTransactions";
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

    expect(result).toMatchObject({ creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 }, replayed: false });
    expect(stored).toMatchObject({
      clientName: "Cliente de teste", addressSnapshot: { street: "Rua de teste", city: "São Paulo" },
      items: [{ quantity: 1, unit: "unidade", unitPrice: 100, total: 100, notes: "Sem açúcar" }],
      subtotal: 100, deliveryFee: 0, total: 100, amountPaid: 0, payments: [], orderStatus: "active",
      notes: "Observação do pedido", tagIds: ["order-tag"],
    });
    expect(stored).not.toHaveProperty("creditGenerated");
  });

  it.each([
    [3, 10010, 30030],
    [3, 30030, 90090],
    [7, 4002, 28014],
    [1.5, 250, 375],
  ])("persiste item e reconcilia total exato para quantidade %s e preço unitário em centavos %s", async (quantity, unitPriceCents, totalCents) => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const name = "Bolo (sem açúcar)";
    const input = command(ids.clientId, ids.orderId, {
      deliveryDateTime: "2026-11-01T12:00",
      items: [{ id: "item-test", productId: "product-test", productName: name, quantity, unit: "unidade", unitPriceCents, totalCents, notes: "", tagIds: [] }],
      subtotalCents: totalCents,
      totalCents,
    });
    const before = structuredClone(input);
    await createOrderTransaction(db, input);
    const stored = (await db.doc(`orders/${ids.orderId}`).get()).data();

    expect(input).toEqual(before);
    expect(stored?.deliveryDateTime).toBe("2026-11-01T12:00");
    expect(stored?.items).toMatchObject([{ productName: name, quantity, unitPrice: unitPriceCents / 100, total: totalCents / 100 }]);
    expect(reconcileFinancialDocuments([{ id: ids.orderId, ...stored }]).orders[0]?.classification).toBe("VALID");
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

    expect(result).toMatchObject({ creationSnapshot: { amountPaidCents: 4000, creditGeneratedCents: 0 }, replayed: false });
    expect(result).not.toHaveProperty("availableCreditCents");
    expect(result).not.toHaveProperty("revision");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({
      amountPaid: 40, payments: [{ id: payment.id, amount: 40, receivedAt: payment.receivedAt }],
    });
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 0, revision: 2 });
  });

  it("aplica crédito confirmado junto com recebimento e gera crédito excedente", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId, 5000, 7);
    const original = command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 8000, receivedAt: "2026-10-11T12:30:00Z" },
      creditApplication: { applyCreditCents: 3000, presentedAvailableCreditCents: 5000, presentedRevision: 7, confirmed: true },
    });
    const result = await createOrderTransaction(db, original);
    expect(result).toMatchObject({ creationSnapshot: { amountPaidCents: 8000, creditAppliedCents: 3000, creditGeneratedCents: 1000 }, replayed: false });
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: result.creationSnapshot });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ amountPaid: 80, creditApplied: 30, creditGenerated: 10 });
  });

  it("gera crédito quando o recebimento inicial excede o total", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedAggregator(ids.clientId);
    const result = await createOrderTransaction(db, command(ids.clientId, ids.orderId, {
      initialPayment: { id: `payment-${randomUUID()}`, amountCents: 12000, receivedAt: "2026-10-11T12:30:00Z" },
    }));
    expect(result).toMatchObject({ creationSnapshot: { creditGeneratedCents: 2000 }, replayed: false });
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

  it("reconhece retry original após edição operacional sem reverter campos ou timestamps", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const original = command(ids.clientId, ids.orderId);
    await createOrderTransaction(db, original);
    const created = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const updatedAt = created?.updatedAt as Timestamp;
    await editOrderTransaction(db, {
      kind: "operational", orderId: ids.orderId, clientId: ids.clientId,
      expected: { updatedAt: { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds } },
      changes: { notes: "Nota operacional posterior" },
    });
    const afterEdit = (await db.doc(`orders/${ids.orderId}`).get()).data();

    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ notes: "Nota operacional posterior", updatedAt: afterEdit?.updatedAt });
  });

  it("reconhece retry original após edição comercial sem reverter itens ou totais", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const original = command(ids.clientId, ids.orderId);
    await seedAggregator(ids.clientId, 0, 1);
    await createOrderTransaction(db, original);
    const created = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const updatedAt = created?.updatedAt as Timestamp;
    await editOrderTransaction(db, {
      kind: "commercial", orderId: ids.orderId, clientId: ids.clientId,
      expected: { updatedAt: { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds } },
      items: [{ id: "item-test", productId: "product-test", productName: "Produto reajustado", quantity: 1, unitPriceCents: 11000, totalCents: 11000 }],
      subtotalCents: 11000, deliveryFeeCents: 0, totalCents: 11000,
    });
    const afterEdit = (await db.doc(`orders/${ids.orderId}`).get()).data();
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ total: 110, items: [{ productName: "Produto reajustado" }], updatedAt: afterEdit?.updatedAt });
  });

  it("reconhece retry original após recebimento ou aplicação de crédito sem reaplicar efeitos", async () => {
    const db = getFinancialAdminDb();
    const paymentIds = fixtureIds();
    const original = command(paymentIds.clientId, paymentIds.orderId);
    await seedAggregator(paymentIds.clientId, 0, 1);
    await createOrderTransaction(db, original);
    await recordPaymentTransaction(db, {
      orderId: paymentIds.orderId, clientId: paymentIds.clientId, paymentId: `payment-${randomUUID()}`,
      amountCents: 5000, receivedAt: "2026-10-11T12:30:00Z", presentedAvailableCreditCents: 0, presentedRevision: 1,
    });
    const afterPayment = (await db.doc(`orders/${paymentIds.orderId}`).get()).data();
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${paymentIds.orderId}`).get()).data()).toMatchObject({ payments: afterPayment?.payments, amountPaid: 50, updatedAt: afterPayment?.updatedAt });
    expect((await db.doc(`clientFinancial/${paymentIds.clientId}`).get()).data()).toMatchObject({ revision: 2 });

    await recordPaymentTransaction(db, {
      orderId: paymentIds.orderId, clientId: paymentIds.clientId, paymentId: `payment-${randomUUID()}`,
      amountCents: 7000, receivedAt: "2026-10-12T12:30:00Z", presentedAvailableCreditCents: 0, presentedRevision: 2,
    });
    const afterGeneratedCredit = (await db.doc(`orders/${paymentIds.orderId}`).get()).data();
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${paymentIds.orderId}`).get()).data()).toMatchObject({ creditGenerated: 20, payments: afterGeneratedCredit?.payments, updatedAt: afterGeneratedCredit?.updatedAt });
    expect((await db.doc(`clientFinancial/${paymentIds.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 2000, revision: 3 });

    const creditIds = fixtureIds();
    const creditOriginal = command(creditIds.clientId, creditIds.orderId);
    await seedAggregator(creditIds.clientId, 5000, 7);
    await createOrderTransaction(db, creditOriginal);
    await applyCreditTransaction(db, {
      operationId: `operation-${randomUUID()}`, orderId: creditIds.orderId, clientId: creditIds.clientId,
      applyCreditCents: 1000, presentedAvailableCreditCents: 5000, presentedRevision: 7, confirmed: true,
    }, { uid: "emulator-operator", email: "operator@example.test" });
    const afterCredit = (await db.doc(`orders/${creditIds.orderId}`).get()).data();
    await expect(createOrderTransaction(db, structuredClone(creditOriginal))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${creditIds.orderId}`).get()).data()).toMatchObject({ creditApplied: 10, updatedAt: afterCredit?.updatedAt });
    expect((await db.doc(`clientFinancial/${creditIds.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 4000, revision: 8 });
  });

  it("reconhece retry original após transferência sem restaurar cliente ou snapshot de nome", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const destinationClientId = fixtureIds().clientId;
    const original = command(ids.clientId, ids.orderId, { clientName: "Nome original" });
    await createOrderTransaction(db, original);
    await db.doc(`clients/${ids.clientId}`).set({ name: "Cliente origem", active: true });
    await db.doc(`clients/${destinationClientId}`).set({ name: "Cliente destino", active: true });
    const created = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const updatedAt = created?.updatedAt as Timestamp;
    await editOrderTransaction(db, {
      kind: "transfer", operationId: `transfer-${randomUUID()}`, orderId: ids.orderId,
      sourceClientId: ids.clientId, destinationClientId,
      expected: { updatedAt: { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds } },
      confirmation: { sourceName: "Cliente origem", destinationName: "Cliente destino", confirmed: true },
    });
    const afterTransfer = (await db.doc(`orders/${ids.orderId}`).get()).data();
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true, creationSnapshot: { amountPaidCents: 0, creditAppliedCents: 0, creditGeneratedCents: 0 } });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ clientId: destinationClientId, clientName: "Cliente destino", updatedAt: afterTransfer?.updatedAt });
    await expect(createOrderTransaction(db, command(ids.clientId, ids.orderId, { notes: "Retry divergente" }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_ID_COLLISION");
  });

  it("serializa criação e tentativa de transferência concorrentes para a mesma identidade", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds(); const destinationClientId = fixtureIds().clientId;
    await db.doc(`clients/${ids.clientId}`).set({ name: "Cliente origem", active: true });
    await db.doc(`clients/${destinationClientId}`).set({ name: "Cliente destino", active: true });
    const original = command(ids.clientId, ids.orderId);
    const transfer = editOrderTransaction(db, {
      kind: "transfer", operationId: `transfer-${randomUUID()}`, orderId: ids.orderId,
      sourceClientId: ids.clientId, destinationClientId,
      expected: { updatedAt: null },
      confirmation: { sourceName: "Cliente origem", destinationName: "Cliente destino", confirmed: true },
    });
    const results = await Promise.allSettled([createOrderTransaction(db, original), transfer]);
    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]?.status).toBe("rejected");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ clientId: ids.clientId, clientName: "Cliente de teste" });
  });

  it("usa comparação exata como fallback legado e conflita quando não há prova histórica suficiente", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const original = command(ids.clientId, ids.orderId);
    await createOrderTransaction(db, original);
    await db.doc(`orders/${ids.orderId}`).update({ _creationFingerprint: FieldValue.delete() });
    await expect(createOrderTransaction(db, structuredClone(original))).resolves.toMatchObject({ replayed: true });
    await db.doc(`orders/${ids.orderId}`).update({ notes: "Estado alterado sem fingerprint" });
    await expect(createOrderTransaction(db, structuredClone(original))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_ID_COLLISION");
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
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "MONETARY_ARITHMETIC_OVERFLOW");
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
