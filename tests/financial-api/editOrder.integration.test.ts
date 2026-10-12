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
    ...(input.legacy ? {} : { payments: input.payments ?? [] }),
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
    expect(order?.total).toBe(110);
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
