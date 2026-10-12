import { randomUUID } from "node:crypto";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { applyCreditTransaction } from "../../api/_financial/applyCredit";
import { editOrderTransaction } from "../../api/_financial/orderEdit";
import { recordPaymentTransaction } from "../../api/_financial/paymentTransactions";
import { isFinancialApiError } from "../../api/_financial/errors";
import type { EditOrderCommand } from "../../api/_financial/validation";
import { reconcileFinancialDocuments } from "../../src/features/financial/reconciliation";

function fixtureIds() {
  const suffix = randomUUID();
  return { clientId: `client-${suffix}`, orderId: `order-${suffix}` };
}

function item(unitPriceCents = 10_000, quantity = 1) {
  return {
    id: "item-1", productId: "product-1", productName: "Produto", quantity,
    unitPriceCents, totalCents: unitPriceCents * quantity, notes: "", tagIds: [],
  };
}

function commercialCommand(clientId: string, orderId: string, overrides: Partial<Extract<EditOrderCommand, { kind: "commercial" }>> = {}): Extract<EditOrderCommand, { kind: "commercial" }> {
  return {
    kind: "commercial", clientId, orderId, expected: { updatedAt: null },
    items: [item()], subtotalCents: 10_000, deliveryFeeCents: 0, totalCents: 10_000,
    ...overrides,
  };
}

function operationalCommand(clientId: string, orderId: string, changes: Extract<EditOrderCommand, { kind: "operational" }> ["changes"]): Extract<EditOrderCommand, { kind: "operational" }> {
  return { kind: "operational", clientId, orderId, expected: { updatedAt: null }, changes };
}

function transferCommand(sourceClientId: string, destinationClientId: string, orderId: string, overrides: Partial<Extract<EditOrderCommand, { kind: "transfer" }>> = {}): Extract<EditOrderCommand, { kind: "transfer" }> {
  return {
    kind: "transfer", operationId: `transfer-${randomUUID()}`, orderId, sourceClientId, destinationClientId,
    expected: { updatedAt: null },
    confirmation: { sourceName: "Cliente", destinationName: "Destino", confirmed: true },
    ...overrides,
  };
}

async function seedClient(clientId: string, name: string) {
  await getFinancialAdminDb().doc(`clients/${clientId}`).set({ name, active: true });
}

async function seedOrder(input: {
  clientId: string;
  orderId: string;
  totalCents?: number;
  cashPaidCents?: number;
  creditAppliedCents?: number;
  creditGeneratedCents?: number;
  payments?: Array<{ id: string; amount: number; receivedAt: string | null }>;
  legacy?: boolean;
  amountPaidOverride?: number;
  orderStatus?: "active" | "completed" | "cancelled";
}) {
  const totalCents = input.totalCents ?? 10_000;
  const cashPaidCents = input.cashPaidCents ?? 0;
  const creditAppliedCents = input.creditAppliedCents ?? 0;
  const creditGeneratedCents = input.creditGeneratedCents ?? Math.max(cashPaidCents + creditAppliedCents - totalCents, 0);
  const order: Record<string, unknown> = {
    clientId: input.clientId, clientName: "Cliente", orderStatus: input.orderStatus ?? "active",
    deliveryDateTime: "2026-11-01T12:00:00-03:00", addressId: "address-1",
    addressSnapshot: { label: "Casa", street: "Rua A", city: "São Paulo" },
    items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: totalCents / 100, total: totalCents / 100, notes: "", tagIds: [] }],
    subtotal: totalCents / 100, deliveryFee: 0, total: totalCents / 100,
    amountPaid: input.amountPaidOverride ?? cashPaidCents / 100,
    ...(input.legacy ? {} : { payments: input.payments ?? (cashPaidCents > 0 ? [{ id: "payment-seed", amount: cashPaidCents / 100, receivedAt: null }] : []) }),
    ...(creditAppliedCents > 0 ? { creditApplied: creditAppliedCents / 100 } : {}),
    ...(creditGeneratedCents > 0 ? { creditGenerated: creditGeneratedCents / 100 } : {}),
    tagIds: ["order-tag"], notes: "Original",
  };
  await getFinancialAdminDb().doc(`orders/${input.orderId}`).set(order);
  return order;
}

async function seedAggregator(clientId: string, availableCreditCents = 0, revision = 1, state = "ready") {
  await getFinancialAdminDb().doc(`clientFinancial/${clientId}`).set({ availableCreditCents, revision, state });
}

describe("experimental order edit transaction with Firestore Emulator", () => {
  it("transfere pedido sem efeitos de crédito sem exigir agregadores e preserva os fatos/snapshots", async () => {
    const ids = fixtureIds();
    const destinationClientId = fixtureIds().clientId;
    const db = getFinancialAdminDb();
    const payments = [{ id: "payment-partial", amount: 25, receivedAt: "2026-10-01T12:00:00Z" }];
    const original = await seedOrder({ ...ids, cashPaidCents: 2500, payments, orderStatus: "completed" });
    const createdAt = Timestamp.fromDate(new Date("2026-09-15T12:00:00Z"));
    await db.doc(`orders/${ids.orderId}`).update({ createdAt });
    await seedClient(ids.clientId, "Cliente");
    await seedClient(destinationClientId, "Destino");
    const command = transferCommand(ids.clientId, destinationClientId, ids.orderId);

    const result = await editOrderTransaction(db, command);
    const saved = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(result).toMatchObject({ operation: "transfer", replayed: false, sourceAvailableCreditCents: null, destinationAvailableCreditCents: null });
    expect(saved).toMatchObject({ clientId: destinationClientId, clientName: "Destino", orderStatus: "completed", payments, amountPaid: 25, createdAt });
    for (const field of ["items", "addressId", "addressSnapshot", "deliveryDateTime", "total", "creditApplied", "creditGenerated"] as const) {
      expect(saved?.[field]).toEqual(original[field]);
    }
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${destinationClientId}`).get()).exists).toBe(false);
  });

  it("transfere Pedido quitado em dinheiro sem alterar o recebimento", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: 10000, payments: [{ id: "payment-settled", amount: 100, receivedAt: "2026-10-03T10:00:00Z" }] });
    await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino");
    await editOrderTransaction(db, transferCommand(ids.clientId, destination, ids.orderId));
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ clientId: destination, amountPaid: 100, payments: [{ id: "payment-settled", amount: 100, receivedAt: "2026-10-03T10:00:00Z" }] });
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${destination}`).get()).exists).toBe(false);
  });

  it.each([
    { name: "crédito gerado", cashPaidCents: 12000, creditAppliedCents: 0, creditGeneratedCents: 2000, sourceBalance: 2000, destinationBalance: 0, expectedSource: 0, expectedDestination: 2000 },
    { name: "crédito aplicado", cashPaidCents: 8000, creditAppliedCents: 2000, creditGeneratedCents: 0, sourceBalance: 0, destinationBalance: 2000, expectedSource: 2000, expectedDestination: 0 },
    { name: "créditos aplicado e gerado", cashPaidCents: 11000, creditAppliedCents: 1000, creditGeneratedCents: 2000, sourceBalance: 1000, destinationBalance: 0, expectedSource: 0, expectedDestination: 1000 },
  ])("transfere contribuição líquida de $name sem criar evento de caixa", async (scenario) => {
    const ids = fixtureIds();
    const destinationClientId = fixtureIds().clientId;
    const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: scenario.cashPaidCents, creditAppliedCents: scenario.creditAppliedCents, creditGeneratedCents: scenario.creditGeneratedCents,
      payments: [{ id: "payment-canonical", amount: scenario.cashPaidCents / 100, receivedAt: null }] });
    await seedClient(ids.clientId, "Cliente");
    await seedClient(destinationClientId, "Destino");
    await seedAggregator(ids.clientId, scenario.sourceBalance, 4);
    await seedAggregator(destinationClientId, scenario.destinationBalance, 9);

    const result = await editOrderTransaction(db, transferCommand(ids.clientId, destinationClientId, ids.orderId, {
      sourceFinancialState: { availableCreditCents: scenario.sourceBalance, revision: 4 },
      destinationFinancialState: { availableCreditCents: scenario.destinationBalance, revision: 9 },
    }));

    expect(result).toMatchObject({ sourceAvailableCreditCents: scenario.expectedSource, destinationAvailableCreditCents: scenario.expectedDestination, sourceRevision: 5, destinationRevision: 10 });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ clientId: destinationClientId, payments: [{ id: "payment-canonical", receivedAt: null }] });
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: scenario.expectedSource, revision: 5 });
    expect((await db.doc(`clientFinancial/${destinationClientId}`).get()).data()).toMatchObject({ availableCreditCents: scenario.expectedDestination, revision: 10 });
  });

  it("não altera agregadores quando crédito aplicado e gerado se anulam", async () => {
    const ids = fixtureIds();
    const destinationClientId = fixtureIds().clientId;
    const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: 10000, creditAppliedCents: 1000, creditGeneratedCents: 1000 });
    await seedClient(ids.clientId, "Cliente");
    await seedClient(destinationClientId, "Destino");
    const result = await editOrderTransaction(db, transferCommand(ids.clientId, destinationClientId, ids.orderId));
    expect(result).toMatchObject({ replayed: false, sourceRevision: null, destinationRevision: null });
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${destinationClientId}`).get()).exists).toBe(false);
  });

  it("exige agregadores ready, revisões e saldos apresentados quando o efeito líquido é diferente de zero", async () => {
    const setup = async (originState: string, sourceBalance = 2000, destinationBalance = 0) => {
      const ids = fixtureIds();
      const destinationClientId = fixtureIds().clientId;
      await seedOrder({ ...ids, cashPaidCents: 12000, creditGeneratedCents: 2000 });
      await seedClient(ids.clientId, "Cliente");
      await seedClient(destinationClientId, "Destino");
      await seedAggregator(ids.clientId, sourceBalance, 4, originState);
      await seedAggregator(destinationClientId, destinationBalance, 9);
      return { ids, destinationClientId };
    };
    const absent = fixtureIds();
    const absentDestination = fixtureIds().clientId;
    await seedOrder({ ...absent, cashPaidCents: 12000, creditGeneratedCents: 2000 });
    await seedClient(absent.clientId, "Cliente"); await seedClient(absentDestination, "Destino");
    await expect(editOrderTransaction(getFinancialAdminDb(), transferCommand(absent.clientId, absentDestination, absent.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");
    const blocked = await setup("blocked");
    await expect(editOrderTransaction(getFinancialAdminDb(), transferCommand(blocked.ids.clientId, blocked.destinationClientId, blocked.ids.orderId, {
      sourceFinancialState: { availableCreditCents: 2000, revision: 4 }, destinationFinancialState: { availableCreditCents: 0, revision: 9 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");
    const stale = await setup("ready");
    await expect(editOrderTransaction(getFinancialAdminDb(), transferCommand(stale.ids.clientId, stale.destinationClientId, stale.ids.orderId, {
      sourceFinancialState: { availableCreditCents: 2000, revision: 3 }, destinationFinancialState: { availableCreditCents: 0, revision: 9 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "SOURCE_AGGREGATOR_CHANGED");
    const divergent = await setup("ready");
    await expect(editOrderTransaction(getFinancialAdminDb(), transferCommand(divergent.ids.clientId, divergent.destinationClientId, divergent.ids.orderId, {
      sourceFinancialState: { availableCreditCents: 1999, revision: 4 }, destinationFinancialState: { availableCreditCents: 0, revision: 9 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "SOURCE_AGGREGATOR_CHANGED");
    const staleDestination = await setup("ready");
    await expect(editOrderTransaction(getFinancialAdminDb(), transferCommand(staleDestination.ids.clientId, staleDestination.destinationClientId, staleDestination.ids.orderId, {
      sourceFinancialState: { availableCreditCents: 2000, revision: 4 }, destinationFinancialState: { availableCreditCents: 0, revision: 8 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "DESTINATION_AGGREGATOR_CHANGED");
  });

  it("rejeita déficit em qualquer saldo e não altera o Pedido parcialmente", async () => {
    const ids = fixtureIds();
    const destinationClientId = fixtureIds().clientId;
    const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: 12000, creditGeneratedCents: 2000 });
    await seedClient(ids.clientId, "Cliente"); await seedClient(destinationClientId, "Destino");
    await seedAggregator(ids.clientId, 1000, 1);
    await seedAggregator(destinationClientId, 0, 1);
    await expect(editOrderTransaction(db, transferCommand(ids.clientId, destinationClientId, ids.orderId, {
      sourceFinancialState: { availableCreditCents: 1000, revision: 1 }, destinationFinancialState: { availableCreditCents: 0, revision: 1 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INSUFFICIENT_AVAILABLE_CREDIT");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.clientId).toBe(ids.clientId);
    const debitIds = fixtureIds(); const debitDestination = fixtureIds().clientId;
    await seedOrder({ ...debitIds, cashPaidCents: 8000, creditAppliedCents: 2000 });
    await seedClient(debitIds.clientId, "Cliente"); await seedClient(debitDestination, "Destino");
    await seedAggregator(debitIds.clientId, 0, 1); await seedAggregator(debitDestination, 1000, 1);
    await expect(editOrderTransaction(db, transferCommand(debitIds.clientId, debitDestination, debitIds.orderId, {
      sourceFinancialState: { availableCreditCents: 0, revision: 1 }, destinationFinancialState: { availableCreditCents: 1000, revision: 1 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INSUFFICIENT_AVAILABLE_CREDIT");
  });

  it("rejeita retirar crédito já consumido em outro Pedido sem invalidar o Pedido consumidor", async () => {
    const sourceId = fixtureIds(); const destinationId = fixtureIds().clientId; const consumerId = fixtureIds(); const db = getFinancialAdminDb();
    await seedOrder({ ...sourceId, cashPaidCents: 12000, creditGeneratedCents: 2000 });
    await seedOrder({ ...consumerId, clientId: sourceId.clientId, cashPaidCents: 8000, creditAppliedCents: 2000, creditGeneratedCents: 0 });
    await seedClient(sourceId.clientId, "Cliente"); await seedClient(destinationId, "Destino");
    await seedAggregator(sourceId.clientId, 0, 6); await seedAggregator(destinationId, 0, 3);
    await expect(editOrderTransaction(db, transferCommand(sourceId.clientId, destinationId, sourceId.orderId, {
      sourceFinancialState: { availableCreditCents: 0, revision: 6 }, destinationFinancialState: { availableCreditCents: 0, revision: 3 },
    }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INSUFFICIENT_AVAILABLE_CREDIT");
    expect((await db.doc(`orders/${sourceId.orderId}`).get()).data()?.clientId).toBe(sourceId.clientId);
    expect((await db.doc(`orders/${consumerId.orderId}`).get()).data()).toMatchObject({ clientId: sourceId.clientId, creditApplied: 20 });
  });

  it("rejeita cliente de destino inexistente, pedido legado inconsistente e cache divergente", async () => {
    const ids = fixtureIds(); const missing = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente");
    await expect(editOrderTransaction(db, transferCommand(ids.clientId, missing, ids.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_CLIENT_UNAVAILABLE");
    const invalid = fixtureIds(); const invalidDestination = fixtureIds().clientId;
    await seedOrder({ ...invalid, cashPaidCents: 2000, legacy: true, amountPaidOverride: 12.345 });
    await seedClient(invalid.clientId, "Cliente"); await seedClient(invalidDestination, "Destino");
    await expect(editOrderTransaction(db, transferCommand(invalid.clientId, invalidDestination, invalid.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_FINANCIAL_STATE");
  });

  it("preserva legado sem payments e resíduo IEEE somente quando comprovado pelas parcelas", async () => {
    const legacy = fixtureIds(); const legacyDestination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder({ ...legacy, legacy: true, cashPaidCents: 2500 });
    await seedClient(legacy.clientId, "Cliente"); await seedClient(legacyDestination, "Destino");
    await editOrderTransaction(db, transferCommand(legacy.clientId, legacyDestination, legacy.orderId));
    expect((await db.doc(`orders/${legacy.orderId}`).get()).data()).not.toHaveProperty("payments");

    const ieee = fixtureIds(); const ieeeDestination = fixtureIds().clientId;
    const payments = [{ id: "ieee-a", amount: 100.1, receivedAt: null }, { id: "ieee-b", amount: 200.2, receivedAt: null }];
    await seedOrder({ ...ieee, legacy: false, totalCents: 30030, cashPaidCents: 30030, payments, amountPaidOverride: 100.1 + 200.2 });
    await seedClient(ieee.clientId, "Cliente"); await seedClient(ieeeDestination, "Destino");
    await editOrderTransaction(db, transferCommand(ieee.clientId, ieeeDestination, ieee.orderId));
    expect((await db.doc(`orders/${ieee.orderId}`).get()).data()).toMatchObject({ amountPaid: 300.29999999999995, payments });
  });

  it("reconcilia origem e destino após transferir crédito gerado", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: 12000, creditGeneratedCents: 2000 });
    const sourceZeroOrderId = `order-zero-${randomUUID()}`;
    await seedOrder({ clientId: ids.clientId, orderId: sourceZeroOrderId, totalCents: 0 });
    await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino");
    await seedAggregator(ids.clientId, 2000, 1); await seedAggregator(destination, 0, 5);
    const transfer = transferCommand(ids.clientId, destination, ids.orderId, {
      sourceFinancialState: { availableCreditCents: 2000, revision: 1 }, destinationFinancialState: { availableCreditCents: 0, revision: 5 },
    });
    await editOrderTransaction(db, transfer);
    expect(await editOrderTransaction(db, transfer)).toMatchObject({ replayed: true });
    const order = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const sourceAggregate = (await db.doc(`clientFinancial/${ids.clientId}`).get()).data();
    const destinationAggregate = (await db.doc(`clientFinancial/${destination}`).get()).data();
    const zeroOrder = (await db.doc(`orders/${sourceZeroOrderId}`).get()).data();
    const report = reconcileFinancialDocuments([{ id: ids.orderId, ...order }, { id: sourceZeroOrderId, ...zeroOrder }], [
      { clientId: ids.clientId, ...sourceAggregate }, { clientId: destination, ...destinationAggregate },
    ]);
    expect(report.clients.find((client) => client.clientId === ids.clientId)).toMatchObject({ conclusive: true, availableCreditCents: 0, aggregatorComparison: "matches" });
    expect(report.clients.find((client) => client.clientId === destination)).toMatchObject({ conclusive: true, availableCreditCents: 2000, aggregatorComparison: "matches" });
  });

  it("rejeita cliente idêntico, origem incorreta, nome de destino desatualizado e cancelamento", async () => {
    const ids = fixtureIds(); const destinationClientId = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destinationClientId, "Destino");
    await expect(editOrderTransaction(db, transferCommand(ids.clientId, ids.clientId, ids.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_CLIENTS_MUST_DIFFER");
    await expect(editOrderTransaction(db, transferCommand(fixtureIds().clientId, destinationClientId, ids.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_SOURCE_CHANGED");
    await expect(editOrderTransaction(db, transferCommand(ids.clientId, destinationClientId, ids.orderId, { confirmation: { sourceName: "Cliente", destinationName: "Nome antigo", confirmed: true } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_CONFIRMATION_STALE");
    const cancelled = fixtureIds(); const cancelledDestination = fixtureIds().clientId;
    await seedOrder({ ...cancelled, orderStatus: "cancelled" }); await seedClient(cancelled.clientId, "Cliente"); await seedClient(cancelledDestination, "Destino");
    await expect(editOrderTransaction(db, transferCommand(cancelled.clientId, cancelledDestination, cancelled.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_SETTLEMENT_UNSUPPORTED");
  });

  it("trata retry idêntico como no-op e impede retry divergente ou antigo de sobrescrever transferência posterior", async () => {
    const ids = fixtureIds(); const middle = fixtureIds().clientId; const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(middle, "Destino"); await seedClient(destination, "Destino final");
    const first = transferCommand(ids.clientId, middle, ids.orderId);
    await editOrderTransaction(db, first);
    const afterFirst = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(await editOrderTransaction(db, first)).toMatchObject({ replayed: true });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(afterFirst?.updatedAt);
    await expect(editOrderTransaction(db, transferCommand(ids.clientId, middle, ids.orderId, { operationId: first.operationId, confirmation: { ...first.confirmation, destinationName: "Outro" } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_OPERATION_ID_REUSED");
    const stale = transferCommand(ids.clientId, destination, ids.orderId);
    await expect(editOrderTransaction(db, stale)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_SOURCE_CHANGED");
  });

  it("mantém identidade de todas as transferências do Pedido em A → B → A e bloqueia X reutilizado em A → C", async () => {
    const ids = fixtureIds(); const middle = fixtureIds().clientId; const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(middle, "Intermediário"); await seedClient(destination, "Destino final");

    const first = transferCommand(ids.clientId, middle, ids.orderId, {
      confirmation: { sourceName: "Cliente", destinationName: "Intermediário", confirmed: true },
    });
    await editOrderTransaction(db, first);
    const firstMarker = (await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).get()).data();
    const afterFirst = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(await editOrderTransaction(db, first)).toMatchObject({ replayed: true });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(afterFirst?.updatedAt);

    const firstTimestamp = afterFirst?.updatedAt as Timestamp;
    const second = transferCommand(middle, ids.clientId, ids.orderId, {
      expected: { updatedAt: { seconds: firstTimestamp.seconds, nanoseconds: firstTimestamp.nanoseconds } },
      confirmation: { sourceName: "Intermediário", destinationName: "Cliente", confirmed: true },
    });
    await editOrderTransaction(db, second);
    const afterSecond = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(await editOrderTransaction(db, first)).toMatchObject({ replayed: true });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(afterSecond?.updatedAt);
    const secondTimestamp = afterSecond?.updatedAt as Timestamp;
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).get()).data()).toEqual(firstMarker);
    const reusedFirstId = transferCommand(ids.clientId, destination, ids.orderId, {
      operationId: first.operationId,
      expected: { updatedAt: { seconds: secondTimestamp.seconds, nanoseconds: secondTimestamp.nanoseconds } },
      confirmation: { sourceName: "Cliente", destinationName: "Destino final", confirmed: true },
    });

    await expect(editOrderTransaction(db, reusedFirstId)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_OPERATION_ID_REUSED");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ clientId: ids.clientId, clientName: "Cliente", updatedAt: afterSecond?.updatedAt });
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).get()).data()).toEqual({ fingerprint: expect.any(String) });
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${second.operationId}`).get()).exists).toBe(true);
  });

  it("migra a última identidade legada antes de substituí-la e mantém os retries X e Y sem efeitos", async () => {
    const ids = fixtureIds(); const middle = fixtureIds().clientId; const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    const payments = [{ id: "legacy-payment", amount: 25, receivedAt: "2026-10-01T12:00:00Z" }];
    await seedOrder({ ...ids, cashPaidCents: 2500, payments });
    await seedClient(ids.clientId, "Cliente"); await seedClient(middle, "Destino"); await seedClient(destination, "Destino final");

    const first = transferCommand(ids.clientId, middle, ids.orderId);
    await editOrderTransaction(db, first);
    const afterFirst = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const legacyIdentity = afterFirst?._lastClientTransfer as { operationId: string; fingerprint: string };
    await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).delete();
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).get()).exists).toBe(false);

    const firstTimestamp = afterFirst?.updatedAt as Timestamp;
    const second = transferCommand(middle, ids.clientId, ids.orderId, {
      expected: { updatedAt: { seconds: firstTimestamp.seconds, nanoseconds: firstTimestamp.nanoseconds } },
      confirmation: { sourceName: "Destino", destinationName: "Cliente", confirmed: true },
    });
    await editOrderTransaction(db, second);
    const afterSecond = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${first.operationId}`).get()).data()).toEqual({ fingerprint: legacyIdentity.fingerprint });
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${second.operationId}`).get()).exists).toBe(true);

    await expect(editOrderTransaction(db, first)).resolves.toMatchObject({ replayed: true });
    await expect(editOrderTransaction(db, second)).resolves.toMatchObject({ replayed: true });
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({
      clientId: ids.clientId, amountPaid: 25, payments, updatedAt: afterSecond?.updatedAt,
    });

    const secondTimestamp = afterSecond?.updatedAt as Timestamp;
    const divergentReuse = transferCommand(ids.clientId, destination, ids.orderId, {
      operationId: first.operationId,
      expected: { updatedAt: { seconds: secondTimestamp.seconds, nanoseconds: secondTimestamp.nanoseconds } },
      confirmation: { sourceName: "Cliente", destinationName: "Destino final", confirmed: true },
    });
    await expect(editOrderTransaction(db, divergentReuse)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "TRANSFER_OPERATION_ID_REUSED");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(afterSecond?.updatedAt);
  });

  it("recusa metadado legado malformado ou marcador anterior contraditório sem escrita", async () => {
    const db = getFinancialAdminDb();
    const malformed = fixtureIds(); const malformedDestination = fixtureIds().clientId;
    await seedOrder(malformed); await seedClient(malformed.clientId, "Cliente"); await seedClient(malformedDestination, "Destino");
    await db.doc(`orders/${malformed.orderId}`).update({ _lastClientTransfer: { operationId: "bad/path", fingerprint: "invalido" } });
    const malformedBefore = (await db.doc(`orders/${malformed.orderId}`).get()).data();
    await expect(editOrderTransaction(db, transferCommand(malformed.clientId, malformedDestination, malformed.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_FINANCIAL_STATE");
    expect((await db.doc(`orders/${malformed.orderId}`).get()).data()?.updatedAt).toEqual(malformedBefore?.updatedAt);
    expect((await db.collection(`orders/${malformed.orderId}/transferOperations`).get()).empty).toBe(true);

    const contradictory = fixtureIds(); const middle = fixtureIds().clientId; const destination = fixtureIds().clientId;
    await seedOrder(contradictory); await seedClient(contradictory.clientId, "Cliente"); await seedClient(middle, "Destino"); await seedClient(destination, "Destino final");
    const first = transferCommand(contradictory.clientId, middle, contradictory.orderId);
    await editOrderTransaction(db, first);
    await db.doc(`orders/${contradictory.orderId}/transferOperations/${first.operationId}`).update({ fingerprint: "0".repeat(64) });
    const beforeRejectedTransfer = (await db.doc(`orders/${contradictory.orderId}`).get()).data();
    const timestamp = beforeRejectedTransfer?.updatedAt as Timestamp;
    const next = transferCommand(middle, destination, contradictory.orderId, {
      expected: { updatedAt: { seconds: timestamp.seconds, nanoseconds: timestamp.nanoseconds } },
      confirmation: { sourceName: "Destino", destinationName: "Destino final", confirmed: true },
    });
    await expect(editOrderTransaction(db, next)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_FINANCIAL_STATE");
    expect((await db.doc(`orders/${contradictory.orderId}`).get()).data()).toMatchObject({ clientId: middle, updatedAt: beforeRejectedTransfer?.updatedAt });
    expect((await db.doc(`orders/${contradictory.orderId}/transferOperations/${next.operationId}`).get()).exists).toBe(false);
  });

  it("serializa transferências concorrentes para o mesmo Pedido", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const alternative = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino"); await seedClient(alternative, "Alternativo");
    const results = await Promise.allSettled([
      editOrderTransaction(db, transferCommand(ids.clientId, destination, ids.orderId)),
      editOrderTransaction(db, transferCommand(ids.clientId, alternative, ids.orderId)),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect([destination, alternative]).toContain((await db.doc(`orders/${ids.orderId}`).get()).data()?.clientId);
  });

  it("serializa transferência com edição comercial concorrente", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino"); await seedAggregator(ids.clientId, 0, 1);
    const results = await Promise.allSettled([
      editOrderTransaction(db, transferCommand(ids.clientId, destination, ids.orderId)),
      editOrderTransaction(db, commercialCommand(ids.clientId, ids.orderId, { items: [item(11000)], subtotalCents: 11000, totalCents: 11000 })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializa transferência com edição operacional concorrente", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino");
    const results = await Promise.allSettled([
      editOrderTransaction(db, transferCommand(ids.clientId, destination, ids.orderId)),
      editOrderTransaction(db, operationalCommand(ids.clientId, ids.orderId, { notes: "Alteração operacional" })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("serializa transferência com aplicação de crédito concorrente", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino"); await seedAggregator(ids.clientId, 5000, 1);
    const apply = applyCreditTransaction(db, {
      operationId: `operation-${randomUUID()}`, clientId: ids.clientId, orderId: ids.orderId,
      applyCreditCents: 1000, presentedAvailableCreditCents: 5000, presentedRevision: 1, confirmed: true,
    }, { uid: "emulator-operator", email: "operator@example.test" });
    const results = await Promise.allSettled([editOrderTransaction(db, transferCommand(ids.clientId, destination, ids.orderId)), apply]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("faz rollback de Pedido e dois agregadores se uma escrita da transferência falhar", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder({ ...ids, cashPaidCents: 12000, creditGeneratedCents: 2000 });
    await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino");
    await seedAggregator(ids.clientId, 2000, 2); await seedAggregator(destination, 500, 7);
    const legacyTransfer = transferCommand(ids.clientId, destination, ids.orderId, {
      sourceFinancialState: { availableCreditCents: 2000, revision: 2 }, destinationFinancialState: { availableCreditCents: 500, revision: 7 },
    });
    await editOrderTransaction(db, legacyTransfer);
    await db.doc(`orders/${ids.orderId}/transferOperations/${legacyTransfer.operationId}`).delete();
    const afterLegacyTransfer = (await db.doc(`orders/${ids.orderId}`).get()).data();
    const orderTimestamp = afterLegacyTransfer?.updatedAt as Timestamp;
    const nextTransfer = transferCommand(destination, ids.clientId, ids.orderId, {
      expected: { updatedAt: { seconds: orderTimestamp.seconds, nanoseconds: orderTimestamp.nanoseconds } },
      confirmation: { sourceName: "Destino", destinationName: "Cliente", confirmed: true },
      sourceFinancialState: { availableCreditCents: 2500, revision: 8 }, destinationFinancialState: { availableCreditCents: 0, revision: 3 },
    });
    const originalRunTransaction = db.runTransaction.bind(db);
    const failingDb = Object.create(db) as Firestore;
    failingDb.runTransaction = ((updateFunction, options) => originalRunTransaction(async (transaction) => {
      const proxy = new Proxy(transaction, {
        get(target, property) {
          if (property === "create") return (...args: Parameters<typeof transaction.create>) => {
            if (args[0].path === `orders/${ids.orderId}/transferOperations/${nextTransfer.operationId}`) {
              throw new Error("falha após preparar o marcador legado");
            }
            return target.create(...args);
          };
          const value: unknown = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return updateFunction(proxy);
    }, options)) as typeof db.runTransaction;
    await expect(editOrderTransaction(failingDb, nextTransfer)).rejects.toThrow("falha após preparar o marcador legado");
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({
      clientId: destination, amountPaid: 120, payments: [{ id: "payment-seed", amount: 120, receivedAt: null }], updatedAt: afterLegacyTransfer?.updatedAt,
    });
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${legacyTransfer.operationId}`).get()).exists).toBe(false);
    expect((await db.doc(`orders/${ids.orderId}/transferOperations/${nextTransfer.operationId}`).get()).exists).toBe(false);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 0, revision: 3 });
    expect((await db.doc(`clientFinancial/${destination}`).get()).data()).toMatchObject({ availableCreditCents: 2500, revision: 8 });
  });

  it("serializa transferência concorrente com recebimento", async () => {
    const ids = fixtureIds(); const destination = fixtureIds().clientId; const db = getFinancialAdminDb();
    await seedOrder(ids); await seedClient(ids.clientId, "Cliente"); await seedClient(destination, "Destino"); await seedAggregator(ids.clientId, 0, 1); await seedAggregator(destination, 0, 1);
    const transfer = transferCommand(ids.clientId, destination, ids.orderId, {
      sourceFinancialState: { availableCreditCents: 0, revision: 1 }, destinationFinancialState: { availableCreditCents: 0, revision: 1 },
    });
    const payment = recordPaymentTransaction(db, {
      orderId: ids.orderId, clientId: ids.clientId, paymentId: `payment-${randomUUID()}`, amountCents: 1000,
      receivedAt: "2026-10-11T12:30:00Z", presentedAvailableCreditCents: 0, presentedRevision: 1,
    });
    const results = await Promise.allSettled([editOrderTransaction(db, transfer), payment]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("faz edição operacional de nota, etiquetas, endereço e entrega sem agregador ou alteração financeira", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    const original = await seedOrder(ids);
    const command = operationalCommand(ids.clientId, ids.orderId, {
      notes: "Nova nota", tagIds: ["order-tag", "priority"], addressId: "address-2",
      addressSnapshot: { label: "Novo local", street: "Rua B", city: "São Paulo" },
      deliveryDateTime: "2026-11-02T13:00:00-03:00",
    });
    await editOrderTransaction(db, command);
    const saved = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(saved).toMatchObject({ notes: "Nova nota", tagIds: ["order-tag", "priority"], addressId: "address-2", addressSnapshot: { street: "Rua B" }, deliveryDateTime: "2026-11-02T13:00:00-03:00" });
    for (const field of ["payments", "amountPaid", "creditApplied", "creditGenerated", "items", "subtotal", "deliveryFee", "total"] as const) {
      expect(saved?.[field]).toEqual(original[field]);
    }
    expect(saved?.updatedAt).toBeDefined();
  });

  it("permite active → completed com saldo pendente sem criar recebimento", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, cashPaidCents: 2500, payments: [{ id: "payment-existing", amount: 25, receivedAt: "2026-10-01T12:00:00Z" }] });
    await editOrderTransaction(getFinancialAdminDb(), operationalCommand(ids.clientId, ids.orderId, { orderStatus: "completed" }));
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ orderStatus: "completed", amountPaid: 25, payments: [{ id: "payment-existing", amount: 25 }] });
  });

  it("edita operacionalmente cache IEEE comprovado sem tocar nas finanças ou no agregador", async () => {
    const ids = fixtureIds();
    const db = getFinancialAdminDb();
    const payments = [
      { id: "payment-100-10", amount: 100.1, receivedAt: null },
      { id: "payment-200-20", amount: 200.2, receivedAt: null },
    ];
    const original = await seedOrder({ ...ids, cashPaidCents: 30_030, payments, amountPaidOverride: 100.1 + 200.2 });
    const createdAt = Timestamp.fromDate(new Date("2026-10-01T12:00:00Z"));
    await db.doc(`orders/${ids.orderId}`).update({ createdAt });
    await seedAggregator(ids.clientId, 1234, 7);
    const aggregateBefore = (await db.doc(`clientFinancial/${ids.clientId}`).get()).data();

    await editOrderTransaction(db, operationalCommand(ids.clientId, ids.orderId, { notes: "Nota operacional" }));

    const saved = (await db.doc(`orders/${ids.orderId}`).get()).data();
    expect(saved?.amountPaid).toBe(300.29999999999995);
    expect(saved?.payments).toEqual(original.payments);
    expect(saved?.createdAt).toEqual(createdAt);
    expect(saved?.updatedAt).toBeInstanceOf(Timestamp);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toEqual(aggregateBefore);
  });

  it("permite edição operacional de legado sem payments e de histórico financeiro inconclusivo", async () => {
    const legacy = fixtureIds();
    await seedOrder({ ...legacy, legacy: true, cashPaidCents: 2500 });
    await editOrderTransaction(getFinancialAdminDb(), operationalCommand(legacy.clientId, legacy.orderId, { notes: "Legado atualizado" }));
    expect((await getFinancialAdminDb().doc(`orders/${legacy.orderId}`).get()).data()?.notes).toBe("Legado atualizado");

    const inconclusive = fixtureIds();
    await seedOrder({ ...inconclusive, amountPaidOverride: 12.345 });
    await editOrderTransaction(getFinancialAdminDb(), operationalCommand(inconclusive.clientId, inconclusive.orderId, { deliveryDateTime: "2026-11-03T12:00:00Z" }));
    expect((await getFinancialAdminDb().doc(`orders/${inconclusive.orderId}`).get()).data()).toMatchObject({ amountPaid: 12.345, deliveryDateTime: "2026-11-03T12:00:00Z" });
  });

  it("não toca updatedAt em repetição operacional idêntica", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    const command = operationalCommand(ids.clientId, ids.orderId, { notes: "Nova nota" });
    await editOrderTransaction(getFinancialAdminDb(), command);
    const afterFirst = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.updatedAt;
    const replay = await editOrderTransaction(getFinancialAdminDb(), command);
    expect(replay.replayed).toBe(true);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(afterFirst);
  });

  it("rejeita payload operacional com campos protegidos e transições canceladas", async () => {
    const ids = fixtureIds();
    const request = (body: unknown) => new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const base = { kind: "operational", ...ids, expected: { updatedAt: null }, changes: { notes: "x" } };
    const { parseEditOrderCommand } = await import("../../api/_financial/validation");
    for (const protectedField of ["payments", "amountPaid", "creditGenerated", "creditApplied"]) {
      await expect(parseEditOrderCommand(request({ ...base, [protectedField]: [] }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_PAYLOAD");
      await expect(parseEditOrderCommand(request({ ...base, changes: { ...base.changes, [protectedField]: 1 } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_PAYLOAD");
    }
    await expect(parseEditOrderCommand(request({ ...base, changes: { orderStatus: "cancelled" } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_SETTLEMENT_UNSUPPORTED");
    await expect(parseEditOrderCommand(request({ ...base, changes: { orderStatus: "active" } }))).resolves.toMatchObject({ changes: { orderStatus: "active" } });
    const transfer = {
      kind: "transfer", orderId: ids.orderId, operationId: "transfer-operation", sourceClientId: "source-client",
      destinationClientId: "destination-client", expected: { updatedAt: null },
      confirmation: { sourceName: "Origem", destinationName: "Destino", confirmed: true },
    };
    await expect(parseEditOrderCommand(request(transfer))).resolves.toMatchObject({ kind: "transfer", operationId: "transfer-operation" });
    await expect(parseEditOrderCommand(request({ ...transfer, changes: { notes: "não misturar variantes" } }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_PAYLOAD");
  });

  it("rejeita troca de cliente, cancelamento e reabertura de cancelado", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, orderStatus: "cancelled" });
    await expect(editOrderTransaction(getFinancialAdminDb(), operationalCommand(ids.clientId, ids.orderId, { notes: "Não permitido" }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_SETTLEMENT_UNSUPPORTED");
    const otherClient = fixtureIds().clientId;
    await expect(editOrderTransaction(getFinancialAdminDb(), operationalCommand(otherClient, ids.orderId, { notes: "Cliente divergente" }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "CLIENT_MISMATCH");
  });

  it("edita preço, quantidade e taxa usando centavos exatos", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(250, 1.5)], subtotalCents: 375, deliveryFeeCents: 25, totalCents: 400,
    });
    await editOrderTransaction(getFinancialAdminDb(), command);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ items: [{ quantity: 1.5, unitPrice: 2.5, total: 3.75 }], subtotal: 3.75, deliveryFee: 0.25, total: 4 });
  });

  it("deixa um pedido quitado com novo saldo sem alterar seus recebimentos", async () => {
    const ids = fixtureIds();
    const payments = [{ id: "payment-full", amount: 100, receivedAt: "2026-10-01T10:00:00Z" }];
    await seedOrder({ ...ids, cashPaidCents: 10_000, payments });
    await seedAggregator(ids.clientId);
    await editOrderTransaction(getFinancialAdminDb(), commercialCommand(ids.clientId, ids.orderId, { items: [item(12_000)], subtotalCents: 12_000, totalCents: 12_000 }));
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()).toMatchObject({ amountPaid: 100, total: 120, payments });
  });

  it("reconcilia aumento de saldo e redução retroativa de crédito coberta", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 12_000, payments: [{ id: "payment-1", amount: 120, receivedAt: "2026-10-01T12:00:00Z" }] });
    await seedAggregator(ids.clientId, 2000, 5);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    const result = await editOrderTransaction(getFinancialAdminDb(), command);
    expect(result).toMatchObject({ availableCreditCents: 1000, revision: 6 });
    const saved = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    expect(saved).toMatchObject({ amountPaid: 120, creditGenerated: 10, payments: [{ id: "payment-1", amount: 120, receivedAt: "2026-10-01T12:00:00Z" }] });
  });

  it("aceita comercialmente apenas cache IEEE exatamente comprovado pelas parcelas canônicas", async () => {
    const ids = fixtureIds();
    const payments = [
      { id: "payment-100-10", amount: 100.1, receivedAt: null },
      { id: "payment-200-20", amount: 200.2, receivedAt: null },
    ];
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 30_030, creditGeneratedCents: 20_030, payments, amountPaidOverride: 100.1 + 200.2 });
    await seedAggregator(ids.clientId, 20_030, 1);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    await editOrderTransaction(getFinancialAdminDb(), command);
    const order = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    const aggregator = (await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data();
    expect(order?.amountPaid).toBe(300.29999999999995);
    expect(order?.payments).toEqual(payments);
    const report = reconcileFinancialDocuments([{ id: ids.orderId, ...order }], [{ clientId: ids.clientId, ...aggregator }]);
    expect(report.orders[0]).toMatchObject({ classification: "LEGACY_COMPATIBLE" });
    expect(report.clients[0]).toMatchObject({ conclusive: true, availableCreditCents: 19_030, aggregatorComparison: "matches" });
  });

  it("consome somente o delta ao aumentar aplicação de crédito existente", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, creditAppliedCents: 2000 });
    await seedAggregator(ids.clientId, 1000, 4);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 2500, presentedAvailableCreditCents: 1000, presentedRevision: 4, confirmed: true },
    });
    await editOrderTransaction(getFinancialAdminDb(), command);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.creditApplied).toBe(25);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 500, revision: 5 });
  });

  it("libera a redução da aplicação existente sem exigir saldo disponível", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, creditAppliedCents: 2000 });
    await seedAggregator(ids.clientId, 0, 2);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 1000, presentedAvailableCreditCents: 0, presentedRevision: 2, confirmed: true },
    });
    await editOrderTransaction(getFinancialAdminDb(), command);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.creditApplied).toBe(10);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 3 });
  });

  it("rejeita aumento quando o saldo cobre menos que o delta, sem gravar parcialmente", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, creditAppliedCents: 2000 });
    await seedAggregator(ids.clientId, 1000, 2);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 3500, presentedAvailableCreditCents: 1000, presentedRevision: 2, confirmed: true },
    });
    await expect(editOrderTransaction(getFinancialAdminDb(), command)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INSUFFICIENT_AVAILABLE_CREDIT");
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.creditApplied).toBe(20);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 2 });
  });

  it("não consome novamente uma aplicação confirmada sem alteração do valor aplicado", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, creditAppliedCents: 2000 });
    await seedAggregator(ids.clientId, 1000, 2);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 2000, presentedAvailableCreditCents: 1000, presentedRevision: 2, confirmed: true },
    });
    await editOrderTransaction(getFinancialAdminDb(), command);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 2 });
  });

  it("valida liberação da aplicação contra redução retroativa do crédito gerado", async () => {
    const ids = fixtureIds();
    const payments = [{ id: "payment-full", amount: 120, receivedAt: "2026-10-01T12:00:00Z" }];
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 12_000, creditAppliedCents: 2000, creditGeneratedCents: 4000, payments });
    await seedAggregator(ids.clientId, 2000, 6);
    const command = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 1000, presentedAvailableCreditCents: 2000, presentedRevision: 6, confirmed: true },
    });
    await editOrderTransaction(getFinancialAdminDb(), command);
    const order = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    const aggregator = (await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data();
    expect(order).toMatchObject({ creditApplied: 10, creditGenerated: 20 });
    expect(aggregator).toMatchObject({ availableCreditCents: 1000, revision: 7 });
    const report = reconcileFinancialDocuments([{ id: ids.orderId, ...order }], [{ clientId: ids.clientId, ...aggregator }]);
    expect(report.orders[0]).toMatchObject({ classification: "VALID", calculatedGeneratedCreditCents: 2000 });
    expect(report.clients[0]).toMatchObject({ conclusive: true, availableCreditCents: 1000, aggregatorComparison: "matches" });
  });

  it("rejeita comercialmente cache divergente das parcelas canônicas", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, cashPaidCents: 1000, payments: [{ id: "payment-10", amount: 10, receivedAt: null }], amountPaidOverride: 11 });
    await seedAggregator(ids.clientId);
    await expect(editOrderTransaction(getFinancialAdminDb(), commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "INVALID_FINANCIAL_STATE");
  });

  it("faz rollback integral quando redução retroativa não tem cobertura", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 12_000, payments: [{ id: "payment-1", amount: 120, receivedAt: null }] });
    await seedAggregator(ids.clientId, 1000, 3);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_500)], subtotalCents: 11_500, totalCents: 11_500 });
    const before = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    await expect(editOrderTransaction(getFinancialAdminDb(), command)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED");
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()).toEqual(before);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 3 });
  });

  it("preserva crédito aplicado se não foi escolhido e exige revisão/confirmação quando escolhido", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, totalCents: 10_000, creditAppliedCents: 2000 });
    await seedAggregator(ids.clientId, 3000, 8);
    const preserve = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    await editOrderTransaction(getFinancialAdminDb(), preserve);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.creditApplied).toBe(20);

    const timestamp = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.updatedAt;
    expect(timestamp).toBeInstanceOf(Timestamp);
    const apply = commercialCommand(ids.clientId, ids.orderId, {
      items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000,
      creditApplication: { applyCreditCents: 2500, presentedAvailableCreditCents: 3000, presentedRevision: 8, confirmed: true },
      expected: { updatedAt: { seconds: (timestamp as Timestamp).seconds, nanoseconds: (timestamp as Timestamp).nanoseconds } },
    });
    await editOrderTransaction(getFinancialAdminDb(), apply);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.creditApplied).toBe(25);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 2500, revision: 9 });
    expect((await editOrderTransaction(getFinancialAdminDb(), apply)).replayed).toBe(true);
  });

  it("rejeita revisão de agregador desatualizada e crédito incompatível com o novo total", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId, 3000, 4);
    const stale = commercialCommand(ids.clientId, ids.orderId, { creditApplication: { applyCreditCents: 1000, presentedAvailableCreditCents: 3000, presentedRevision: 3, confirmed: true } });
    await expect(editOrderTransaction(getFinancialAdminDb(), stale)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_REVISION_CHANGED");
    const staleBalance = commercialCommand(ids.clientId, ids.orderId, { creditApplication: { applyCreditCents: 1000, presentedAvailableCreditCents: 2500, presentedRevision: 4, confirmed: true } });
    await expect(editOrderTransaction(getFinancialAdminDb(), staleBalance)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "CREDIT_BALANCE_CHANGED");
    const incompatible = commercialCommand(ids.clientId, ids.orderId, { items: [item(500)], subtotalCents: 500, totalCents: 500 });
    await seedOrder({ ...ids, totalCents: 10_000, creditAppliedCents: 700 });
    await expect(editOrderTransaction(getFinancialAdminDb(), incompatible)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "CREDIT_APPLICATION_EXCEEDS_ORDER_TOTAL");
  });

  it("edita pedido sem pagamentos e preserva compatibilidade de pedido legado sem payments[]", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, legacy: true, cashPaidCents: 2500 });
    await seedAggregator(ids.clientId);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(12_500)], subtotalCents: 12_500, totalCents: 12_500 });
    await editOrderTransaction(getFinancialAdminDb(), command);
    const saved = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    expect(saved).not.toHaveProperty("payments");
    expect(saved).toMatchObject({ amountPaid: 25, total: 125 });
  });

  it("repete comando igual como no-op e recusa retry divergente baseado em estado obsoleto", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    expect((await editOrderTransaction(getFinancialAdminDb(), command)).replayed).toBe(false);
    const savedAfterFirst = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    expect((await editOrderTransaction(getFinancialAdminDb(), command)).replayed).toBe(true);
    expect((await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data()?.updatedAt).toEqual(savedAfterFirst?.updatedAt);
    const divergent = commercialCommand(ids.clientId, ids.orderId, { items: [item(12_000)], subtotalCents: 12_000, totalCents: 12_000 });
    await expect(editOrderTransaction(getFinancialAdminDb(), divergent)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "ORDER_REVISION_CHANGED");
  });

  it("serializa edições concorrentes e edição com recebimento", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId);
    const first = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    const second = commercialCommand(ids.clientId, ids.orderId, { items: [item(12_000)], subtotalCents: 12_000, totalCents: 12_000 });
    const editResults = await Promise.allSettled([editOrderTransaction(getFinancialAdminDb(), first), editOrderTransaction(getFinancialAdminDb(), second)]);
    expect(editResults.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(editResults.filter((result) => result.status === "rejected")).toHaveLength(1);

    const paymentId = `payment-${randomUUID()}`;
    const current = (await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data();
    const edit = commercialCommand(ids.clientId, ids.orderId, { items: [item(13_000)], subtotalCents: 13_000, totalCents: 13_000 });
    const payment = { orderId: ids.orderId, clientId: ids.clientId, paymentId, amountCents: 100, receivedAt: "2026-10-12T12:00:00Z", presentedAvailableCreditCents: current?.availableCreditCents as number, presentedRevision: current?.revision as number };
    const results = await Promise.allSettled([editOrderTransaction(getFinancialAdminDb(), edit), recordPaymentTransaction(getFinancialAdminDb(), payment)]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const stored = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    expect(stored?.payments).toContainEqual(expect.objectContaining({ id: paymentId, amount: 1 }));
  });

  it("serializa edição comercial com aplicação concorrente de crédito", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId, 5000, 1);
    const edit = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    const apply = applyCreditTransaction(getFinancialAdminDb(), {
      operationId: `operation-${randomUUID()}`,
      clientId: ids.clientId,
      orderId: ids.orderId,
      applyCreditCents: 1000,
      presentedAvailableCreditCents: 5000,
      presentedRevision: 1,
      confirmed: true,
    }, { uid: "emulator-operator", email: "operator@example.test" });
    const results = await Promise.allSettled([editOrderTransaction(getFinancialAdminDb(), edit), apply]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const order = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    expect([100, 110]).toContain(order?.total);
    expect(order?.creditApplied ?? 0).toBe(10);
    expect((await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data()?.availableCreditCents).toBe(4000);
  });

  it("rejects missing/invalid aggregator and prevents any partial write", async () => {
    const missing = fixtureIds();
    await seedOrder(missing);
    await expect(editOrderTransaction(getFinancialAdminDb(), commercialCommand(missing.clientId, missing.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 }))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");
    const invalid = fixtureIds();
    await seedOrder(invalid);
    await seedAggregator(invalid.clientId, -1);
    await expect(editOrderTransaction(getFinancialAdminDb(), commercialCommand(invalid.clientId, invalid.orderId))).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "AGGREGATOR_UNAVAILABLE");
    expect((await getFinancialAdminDb().doc(`orders/${invalid.orderId}`).get()).data()?.total).toBe(100);
  });

  it("reconcilia a edição financeira e o agregador", async () => {
    const ids = fixtureIds();
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 12_000, payments: [{ id: "payment-1", amount: 120, receivedAt: "2026-10-01T12:00:00Z" }] });
    await seedAggregator(ids.clientId, 2000, 1);
    await editOrderTransaction(getFinancialAdminDb(), commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 }));
    const order = (await getFinancialAdminDb().doc(`orders/${ids.orderId}`).get()).data();
    const aggregator = (await getFinancialAdminDb().doc(`clientFinancial/${ids.clientId}`).get()).data();
    const report = reconcileFinancialDocuments([{ id: ids.orderId, ...order }], [{ clientId: ids.clientId, ...aggregator }]);
    expect(report.orders[0]).toMatchObject({ classification: "VALID", calculatedGeneratedCreditCents: 1000 });
    expect(report.clients[0]).toMatchObject({ conclusive: true, availableCreditCents: 1000, aggregatorComparison: "matches" });
  });

  it("preserva o comando e desfaz ambas as escritas se uma escrita transacional falhar", async () => {
    const db = getFinancialAdminDb();
    const ids = fixtureIds();
    await seedOrder({ ...ids, totalCents: 10_000, cashPaidCents: 12_000, payments: [{ id: "payment-rollback", amount: 120, receivedAt: null }] });
    await seedAggregator(ids.clientId, 2000, 1);
    const command = commercialCommand(ids.clientId, ids.orderId, { items: [item(11_000)], subtotalCents: 11_000, totalCents: 11_000 });
    const before = structuredClone(command);
    const originalRunTransaction = db.runTransaction.bind(db);
    const failingDb = Object.create(db) as Firestore;
    failingDb.runTransaction = ((updateFunction, options) => originalRunTransaction(async (transaction) => {
      const proxy = new Proxy(transaction, {
        get(target, property) {
          if (property === "update") return () => { throw new Error("falha de escrita injetada"); };
          const value: unknown = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return updateFunction(proxy);
    }, options)) as typeof db.runTransaction;
    await expect(editOrderTransaction(failingDb, command)).rejects.toThrow("falha de escrita injetada");
    expect(command).toEqual(before);
    expect((await db.doc(`orders/${ids.orderId}`).get()).data()?.total).toBe(100);
    expect((await db.doc(`clientFinancial/${ids.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 2000, revision: 1 });
  });

  it("rejeita fração de centavo, aritmética incoerente e overflow", async () => {
    const ids = fixtureIds();
    await seedOrder(ids);
    await seedAggregator(ids.clientId);
    const fractional = commercialCommand(ids.clientId, ids.orderId, { items: [item(1, 0.5)], subtotalCents: 0, totalCents: 0 });
    await expect(editOrderTransaction(getFinancialAdminDb(), fractional)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "MONETARY_VALUE_REQUIRES_CENT_PRECISION");
    const overflow = commercialCommand(ids.clientId, ids.orderId, { items: [item(Number.MAX_SAFE_INTEGER, 2)], subtotalCents: Number.MAX_SAFE_INTEGER, totalCents: Number.MAX_SAFE_INTEGER });
    await expect(editOrderTransaction(getFinancialAdminDb(), overflow)).rejects.toSatisfy((error: unknown) => isFinancialApiError(error) && error.code === "MONETARY_ARITHMETIC_OVERFLOW");
  });
});
