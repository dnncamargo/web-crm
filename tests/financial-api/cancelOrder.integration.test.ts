import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { cancelOrderTransaction } from "../../api/_financial/cancelOrder";
import { FinancialApiError } from "../../api/_financial/errors";
import { editOrderTransaction } from "../../api/_financial/orderEdit";
import { recordPaymentTransaction } from "../../api/_financial/paymentTransactions";
import type { CancelOrderCommand } from "../../api/_financial/validation";
import { projectFinancialReadModel } from "../../src/features/financial/projection";
import type { Order } from "../../src/features/orders/orderTypes";

const db = getFinancialAdminDb();

interface Fixture {
  orderId: string;
  clientId: string;
}

async function seedOrder(options: {
  orderStatus?: "active" | "completed" | "cancelled";
  amountPaid?: number;
  payments?: unknown;
  creditApplied?: number;
  creditGenerated?: number;
  refunds?: unknown;
  omitPayments?: boolean;
  total?: number;
  subtotal?: number;
  deliveryFee?: number;
  items?: unknown;
  omitCommercialFields?: boolean;
} = {}): Promise<Fixture> {
  const suffix = randomUUID();
  const fixture = { orderId: `order-${suffix}`, clientId: `client-${suffix}` };
  const total = options.total ?? 100;
  const deliveryFee = options.deliveryFee ?? 0;
  const subtotal = options.subtotal ?? total - deliveryFee;
  const data: Record<string, unknown> = {
    clientId: fixture.clientId,
    clientName: "Cliente sintético",
    orderStatus: options.orderStatus ?? "active",
    total,
    amountPaid: options.amountPaid ?? 0,
    payments: options.payments ?? [],
    creditApplied: options.creditApplied ?? 0,
    creditGenerated: options.creditGenerated ?? 0,
    items: options.items ?? (subtotal > 0 ? [{
      id: "item-1", productId: "product-1", productName: "Produto",
      quantity: 1, unitPrice: subtotal, total: subtotal,
    }] : []),
    subtotal,
    deliveryFee,
  };
  if (options.omitPayments) delete data.payments;
  if (options.refunds !== undefined) data.refunds = options.refunds;
  if (options.omitCommercialFields) {
    delete data.subtotal;
    delete data.deliveryFee;
  }
  await db.doc(`orders/${fixture.orderId}`).set(data);
  return fixture;
}

function persistedOrderForProjection(fixture: Fixture, data: Record<string, unknown>): Order {
  return { id: fixture.orderId, ...data } as unknown as Order;
}

function command(fixture: Fixture, overrides: Partial<CancelOrderCommand> = {}): CancelOrderCommand {
  return {
    orderId: fixture.orderId,
    clientId: fixture.clientId,
    operationId: `operation-${randomUUID()}`,
    expected: { updatedAt: null },
    agreement: "Cancelamento combinado; valores já recebidos serão tratados conforme informado.",
    movement: { kind: "none", amountCents: 0, occurredAt: null },
    ...overrides,
  };
}

function creditDecision(
  appliedRestoredCents: number,
  generatedRetainedCents: number,
  presentedAvailableCreditCents = 0,
  presentedRevision = 1,
): NonNullable<CancelOrderCommand["creditDecision"]> {
  return { appliedRestoredCents, generatedRetainedCents, presentedAvailableCreditCents, presentedRevision, confirmed: true };
}

async function expectFinancialCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toSatisfy((error: unknown) => (
    error instanceof FinancialApiError && error.code === code
  ));
}

describe("cancel order transaction", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("cancela sem movimentação e preserva acordo e fatos financeiros", async () => {
    const fixture = await seedOrder();
    const operation = command(fixture, {
      agreement: "A promessa é devolver R$ 50 na próxima semana; nenhuma movimentação ocorreu.",
    });
    await expect(cancelOrderTransaction(db, operation)).resolves.toEqual({ orderId: fixture.orderId, replayed: false });
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved).toMatchObject({
      orderStatus: "cancelled",
      cancellationAgreement: { operationId: operation.operationId, text: operation.agreement },
      amountPaid: 0,
      payments: [],
    });
    expect(saved).not.toHaveProperty("refunds");
  });

  it("permite cancelar completed com saldo pendente sem transformar o saldo em cobrança", async () => {
    const fixture = await seedOrder({ orderStatus: "completed" });
    await cancelOrderTransaction(db, command(fixture));
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("cancelled");
  });

  it("preserva recebimento e sua data original ao registrar devolução integral", async () => {
    const payments = [{ id: "payment-original", amount: 100, receivedAt: "2026-10-01T13:00:00.000Z" }];
    const fixture = await seedOrder({ amountPaid: 100, payments });
    await cancelOrderTransaction(db, command(fixture, { movement: { kind: "refund", amountCents: 10000, occurredAt: "2026-10-12T10:00:00.000-03:00" } }));
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({
      amountPaid: 100,
      payments,
      refunds: [{ id: expect.stringMatching(/^cancel-operation-/), amount: 100, refundedAt: "2026-10-12T10:00:00.000-03:00" }],
    });
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.knownRefunds).toHaveLength(1);
    expect(projection.knownRefunds[0]?.amountCents).toBe(10000);
  });

  it.each(["receipt", "refund"] as const)("aceita operationId de 121 caracteres para %s, reconcilia o ID derivado e repete com segurança", async (kind) => {
    const operationId = "derived-id-".padEnd(121, "a");
    const derivedId = `cancel-${operationId}`;
    const fixture = kind === "refund"
      ? await seedOrder({ amountPaid: 100, payments: [{ id: "payment-original", amount: 100, receivedAt: null }] })
      : await seedOrder({ total: 200, amountPaid: 100, payments: [{ id: "payment-original", amount: 100, receivedAt: null }] });
    const operation = command(fixture, {
      operationId,
      movement: { kind, amountCents: 1000, occurredAt: "2026-10-12T10:00:00Z" },
    });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: true });
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data() ?? {};
    if (kind === "receipt") {
      expect(saved.payments).toContainEqual({ id: derivedId, amount: 10, receivedAt: "2026-10-12T10:00:00Z" });
    } else {
      expect(saved.refunds).toContainEqual({ id: derivedId, amount: 10, refundedAt: "2026-10-12T10:00:00Z" });
    }
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved)]);
    expect(projection.reconciliation.orders[0]?.classification).toBe("LEGACY_COMPATIBLE");
    expect(projection.reconciliation.orders[0]?.findings.map((finding) => finding.code)).not.toContain("REFUND_ID_INVALID");
    expect(kind === "receipt" ? projection.knownReceipts : projection.knownRefunds).toHaveLength(1);
  });

  it.each(["receipt", "refund"] as const)("rejeita operationId de 122 caracteres para %s antes de qualquer escrita", async (kind) => {
    const fixture = kind === "refund"
      ? await seedOrder({ amountPaid: 100, payments: [{ id: "payment-original", amount: 100, receivedAt: null }] })
      : await seedOrder({ total: 200, amountPaid: 100, payments: [{ id: "payment-original", amount: 100, receivedAt: null }] });
    const aggregator = db.doc(`clientFinancial/${fixture.clientId}`);
    const aggregatorData = { state: "ready", availableCreditCents: 375, revision: 12 };
    await aggregator.set(aggregatorData);
    const operation = command(fixture, {
      operationId: "a".repeat(122),
      movement: { kind, amountCents: 1000, occurredAt: "2026-10-12T10:00:00Z" },
    });
    await expectFinancialCode(cancelOrderTransaction(db, operation), "INVALID_PAYLOAD");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");
    expect((await db.doc(`orders/${fixture.orderId}/cancellationOperations/${operation.operationId}`).get()).exists).toBe(false);
    expect((await aggregator.get()).data()).toEqual(aggregatorData);
  });

  it("preserva operationId de 128 caracteres quando não há movimentação", async () => {
    const fixture = await seedOrder();
    const operation = command(fixture, { operationId: "a".repeat(128) });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    expect((await db.doc(`orders/${fixture.orderId}/cancellationOperations/${operation.operationId}`).get()).exists).toBe(true);
  });

  it("registra devolução parcial como fato separado", async () => {
    const fixture = await seedOrder({ amountPaid: 100, payments: [{ id: "payment", amount: 100, receivedAt: null }] });
    await cancelOrderTransaction(db, command(fixture, { movement: { kind: "refund", amountCents: 2500, occurredAt: "2026-10-12T10:00:00Z" } }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.amountPaid).toBe(100);
    expect(saved?.payments).toEqual([{ id: "payment", amount: 100, receivedAt: null }]);
    expect(saved?.refunds).toMatchObject([{ amount: 25, refundedAt: "2026-10-12T10:00:00Z" }]);
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.knownRefunds).toHaveLength(1);
    expect(projection.knownRefunds[0]?.amountCents).toBe(2500);
  });

  it("preserva a retenção quando não há saída efetiva", async () => {
    const fixture = await seedOrder({ amountPaid: 40, payments: [{ id: "payment", amount: 40, receivedAt: null }] });
    await cancelOrderTransaction(db, command(fixture));
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({ amountPaid: 40, payments: [{ id: "payment", amount: 40 }] });
  });

  it("acrescenta recebimento real mantendo a identidade e data dos pagamentos anteriores", async () => {
    const previous = [{ id: "legacy-known", amount: 25, receivedAt: null }];
    const fixture = await seedOrder({ amountPaid: 25, payments: previous });
    await cancelOrderTransaction(db, command(fixture, { movement: { kind: "receipt", amountCents: 2500, occurredAt: "2026-10-11T12:30:00-03:00" } }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved).toMatchObject({
      amountPaid: 50,
      payments: [...previous, { id: expect.stringMatching(/^cancel-operation-/), amount: 25, receivedAt: "2026-10-11T12:30:00-03:00" }],
    });
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.knownReceipts).toHaveLength(1);
    expect(projection.knownReceipts[0]?.amountCents).toBe(2500);
  });

  it("materializa recebimento legado sem inventar sua data", async () => {
    const fixture = await seedOrder({ amountPaid: 20, omitPayments: true });
    await cancelOrderTransaction(db, command(fixture, { movement: { kind: "receipt", amountCents: 1000, occurredAt: "2026-10-11T12:30:00Z" } }));
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.payments).toEqual([
      { id: `legacy-${fixture.orderId}`, amount: 20, receivedAt: null },
      { id: expect.stringMatching(/^cancel-operation-/), amount: 10, receivedAt: "2026-10-11T12:30:00Z" },
    ]);
  });

  it("aceita cache IEEE-754 somente quando comprovado pela soma dos pagamentos", async () => {
    const payments = [{ id: "ieee-a", amount: 100.1, receivedAt: null }, { id: "ieee-b", amount: 200.2, receivedAt: null }];
    const fixture = await seedOrder({ total: 300.3, amountPaid: 100.1 + 200.2, payments });
    await cancelOrderTransaction(db, command(fixture));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved).toMatchObject({ payments, amountPaid: 100.1 + 200.2 });
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.knownReceipts).toHaveLength(0);
    expect(projection.historicalDateUnknownReceipts).toHaveLength(2);
  });

  it("projeta devolução com fatos de caixa confiáveis mesmo sem dados comerciais", async () => {
    const fixture = await seedOrder({
      amountPaid: 100,
      payments: [{ id: "payment-incomplete", amount: 100, receivedAt: "2026-10-01T13:00:00Z" }],
      items: [],
      omitCommercialFields: true,
    });
    await cancelOrderTransaction(db, command(fixture, {
      movement: { kind: "refund", amountCents: 2500, occurredAt: "2026-10-12T10:00:00Z" },
    }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.refunds).toHaveLength(1);
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.reconciliation.orders[0]?.classification).toBe("INDETERMINATE");
    expect(projection.knownRefunds).toHaveLength(1);
    expect(projection.knownRefunds[0]?.amountCents).toBe(2500);
  });

  it("projeta novo recebimento com fatos confiáveis mesmo sem reconstrução comercial", async () => {
    const fixture = await seedOrder({ items: [], omitCommercialFields: true });
    await cancelOrderTransaction(db, command(fixture, {
      movement: { kind: "receipt", amountCents: 2500, occurredAt: "2026-10-12T10:00:00Z" },
    }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.reconciliation.orders[0]?.classification).toBe("INDETERMINATE");
    expect(projection.knownReceipts).toHaveLength(1);
    expect(projection.knownReceipts[0]?.amountCents).toBe(2500);
  });

  it("mantém diagnóstico comercial de subtotal divergente sem ocultar devolução identificável", async () => {
    const fixture = await seedOrder({
      amountPaid: 100,
      payments: [{ id: "payment-subtotal", amount: 100, receivedAt: "2026-10-01T13:00:00Z" }],
      subtotal: 90,
      total: 100,
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 100, total: 100 }],
    });
    await cancelOrderTransaction(db, command(fixture, {
      movement: { kind: "refund", amountCents: 10000, occurredAt: "2026-10-12T10:00:00Z" },
    }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.reconciliation.orders[0]?.findings.map((finding) => finding.code)).toContain("ORDER_SUBTOTAL_DIVERGENT");
    expect(projection.knownRefunds).toHaveLength(1);
  });

  it("mantém devolução projetável quando total diverge do subtotal e da taxa", async () => {
    const fixture = await seedOrder({
      amountPaid: 100,
      payments: [{ id: "payment-total", amount: 100, receivedAt: "2026-10-01T13:00:00Z" }],
      subtotal: 100,
      deliveryFee: 0,
      total: 110,
    });
    await cancelOrderTransaction(db, command(fixture, {
      movement: { kind: "refund", amountCents: 10000, occurredAt: "2026-10-12T10:00:00Z" },
    }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.reconciliation.orders[0]?.findings.map((finding) => finding.code)).toContain("ORDER_TOTAL_DIVERGENT");
    expect(projection.knownRefunds).toHaveLength(1);
  });

  it("recusa cache de recebimentos divergente antes de gravar cancelamento", async () => {
    const fixture = await seedOrder({ amountPaid: 99, payments: [{ id: "payment-cache", amount: 100, receivedAt: null }] });
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture)), "INVALID_FINANCIAL_STATE");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");
  });

  it("recusa IDs duplicados de recebimento e devolução antes de qualquer gravação", async () => {
    const duplicatePayments = await seedOrder({
      amountPaid: 20,
      payments: [
        { id: "payment-duplicate", amount: 10, receivedAt: null },
        { id: "payment-duplicate", amount: 10, receivedAt: null },
      ],
    });
    await expectFinancialCode(cancelOrderTransaction(db, command(duplicatePayments)), "INVALID_FINANCIAL_STATE");

    const duplicateRefunds = await seedOrder({
      amountPaid: 20,
      payments: [{ id: "payment-refund-dup", amount: 20, receivedAt: null }],
      refunds: [
        { id: "refund-duplicate", amount: 5, refundedAt: "2026-10-01T10:00:00Z" },
        { id: "refund-duplicate", amount: 5, refundedAt: "2026-10-02T10:00:00Z" },
      ],
    });
    await expectFinancialCode(cancelOrderTransaction(db, command(duplicateRefunds)), "INVALID_FINANCIAL_STATE");
  });

  it("recusa datas de caixa sem fuso antes de aceitar uma movimentação", async () => {
    const invalidPaymentDate = await seedOrder({
      amountPaid: 20,
      payments: [{ id: "payment-local-time", amount: 20, receivedAt: "2026-10-01T10:00:00" }],
    });
    await expectFinancialCode(cancelOrderTransaction(db, command(invalidPaymentDate)), "INVALID_FINANCIAL_STATE");

    const invalidRefundDate = await seedOrder({
      amountPaid: 20,
      payments: [{ id: "payment-valid-date", amount: 20, receivedAt: null }],
      refunds: [{ id: "refund-local-time", amount: 5, refundedAt: "2026-10-02T10:00:00" }],
    });
    await expectFinancialCode(cancelOrderTransaction(db, command(invalidRefundDate)), "INVALID_FINANCIAL_STATE");
  });

  it("rejeita devolução acima do dinheiro recebido não devolvido sem escrita parcial", async () => {
    const previousRefund = { id: "refund-original", amount: 10, refundedAt: "2026-10-01T10:00:00Z" };
    const fixture = await seedOrder({
      amountPaid: 20,
      payments: [{ id: "payment", amount: 20, receivedAt: null }],
      refunds: [previousRefund],
    });
    const op = command(fixture, { movement: { kind: "refund", amountCents: 1001, occurredAt: "2026-10-12T10:00:00Z" } });
    await expectFinancialCode(cancelOrderTransaction(db, op), "REFUND_EXCEEDS_UNREFUNDED_RECEIPTS");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.refunds).toEqual([previousRefund]);
    expect((await db.doc(`orders/${fixture.orderId}/cancellationOperations/${op.operationId}`).get()).exists).toBe(false);
  });

  it("não gera crédito adicional durante recebimento do cancelamento", async () => {
    const fixture = await seedOrder();
    const movement = { kind: "receipt" as const, amountCents: 10001, occurredAt: "2026-10-12T10:00:00Z" };
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, { movement })), "CANCEL_RECEIPT_WOULD_GENERATE_CREDIT");

    const applied = await seedOrder({ total: 100, amountPaid: 80, payments: [{ id: "payment", amount: 80, receivedAt: null }], creditApplied: 20 });
    await db.doc(`clientFinancial/${applied.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    await expectFinancialCode(cancelOrderTransaction(db, command(applied, {
      movement: { kind: "receipt", amountCents: 1, occurredAt: "2026-10-12T10:00:00Z" },
      creditDecision: creditDecision(0, 0),
    })), "CANCEL_RECEIPT_WOULD_GENERATE_CREDIT");
  });

  it("aceita retry idêntico e rejeita reutilização divergente da identidade", async () => {
    const fixture = await seedOrder();
    const operation = command(fixture, {
      movement: { kind: "receipt", amountCents: 2500, occurredAt: "2026-10-12T10:00:00Z" },
    });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: true });
    await expectFinancialCode(cancelOrderTransaction(db, { ...operation, agreement: "Texto diferente" }), "CANCEL_OPERATION_ID_REUSED");
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.payments).toHaveLength(1);
    const projection = projectFinancialReadModel([persistedOrderForProjection(fixture, saved ?? {})]);
    expect(projection.knownReceipts).toHaveLength(1);
  });

  it("serializa tentativas concorrentes e não cancela duas vezes", async () => {
    const fixture = await seedOrder();
    const first = command(fixture);
    const second = command(fixture);
    const outcomes = await Promise.allSettled([
      cancelOrderTransaction(db, first),
      cancelOrderTransaction(db, second),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((entry) => entry.status === "rejected")).toHaveLength(1);
  });

  it("exige uma decisão explícita e restaura somente o crédito aplicado acordado", async () => {
    const applied = await seedOrder({ creditApplied: 10 });
    await expectFinancialCode(cancelOrderTransaction(db, command(applied)), "CREDIT_DECISION_REQUIRED");
    await db.doc(`clientFinancial/${applied.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    const operation = command(applied, { creditDecision: creditDecision(500, 0) });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    const saved = (await db.doc(`orders/${applied.orderId}`).get()).data();
    expect(saved).toMatchObject({
      creditApplied: 10,
      creditGenerated: 0,
      cancellationAgreement: { creditDecision: { appliedRestoredCents: 500, generatedRetainedCents: 0 } },
    });
    expect((await db.doc(`clientFinancial/${applied.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 500, revision: 2 });

    const fullyRestored = await seedOrder({ creditApplied: 10 });
    await db.doc(`clientFinancial/${fullyRestored.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    await cancelOrderTransaction(db, command(fullyRestored, { creditDecision: creditDecision(1000, 0) }));
    expect((await db.doc(`clientFinancial/${fullyRestored.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 2 });

    const cashAndCreditRefund = await seedOrder({ total: 100, amountPaid: 90, payments: [{ id: "payment", amount: 90, receivedAt: null }], creditApplied: 10 });
    await db.doc(`clientFinancial/${cashAndCreditRefund.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    await cancelOrderTransaction(db, command(cashAndCreditRefund, {
      movement: { kind: "refund", amountCents: 5000, occurredAt: "2026-10-12T10:00:00Z" },
      creditDecision: creditDecision(1000, 0),
    }));
    const cashAndCreditSaved = (await db.doc(`orders/${cashAndCreditRefund.orderId}`).get()).data();
    expect(cashAndCreditSaved?.payments).toEqual([{ id: "payment", amount: 90, receivedAt: null }]);
    expect(cashAndCreditSaved?.refunds).toMatchObject([{ amount: 50 }]);
    expect((await db.doc(`clientFinancial/${cashAndCreditRefund.clientId}`).get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 2 });
  });

  it("retém crédito gerado parcialmente, atualiza revisão e valida replay integral", async () => {
    const generated = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    const aggregator = db.doc(`clientFinancial/${generated.clientId}`);
    await aggregator.set({ state: "ready", availableCreditCents: 2000, revision: 4 });
    const operation = command(generated, { creditDecision: creditDecision(0, 1000, 2000, 4) });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: true });
    await expectFinancialCode(cancelOrderTransaction(db, {
      ...operation,
      creditDecision: creditDecision(0, 0, 2000, 4),
    }), "CANCEL_OPERATION_ID_REUSED");
    expect((await db.doc(`orders/${generated.orderId}`).get()).data()).toMatchObject({
      creditGenerated: 20,
      cancellationAgreement: { creditDecision: { appliedRestoredCents: 0, generatedRetainedCents: 1000 } },
    });
    expect((await aggregator.get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 5 });

    const fullyWithdrawn = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    const fullWithdrawalAggregator = db.doc(`clientFinancial/${fullyWithdrawn.clientId}`);
    await fullWithdrawalAggregator.set({ state: "ready", availableCreditCents: 2000, revision: 1 });
    await cancelOrderTransaction(db, command(fullyWithdrawn, { creditDecision: creditDecision(0, 0, 2000, 1) }));
    expect((await fullWithdrawalAggregator.get()).data()).toMatchObject({ availableCreditCents: 0, revision: 2 });
  });

  it("preserva o agregador e a revisão quando o efeito líquido é zero", async () => {
    const fixture = await seedOrder({ amountPaid: 100, payments: [{ id: "payment", amount: 100, receivedAt: null }], creditApplied: 10, creditGenerated: 10 });
    const aggregator = db.doc(`clientFinancial/${fixture.clientId}`);
    await aggregator.set({ state: "ready", availableCreditCents: 1000, revision: 9 });
    await cancelOrderTransaction(db, command(fixture, { creditDecision: creditDecision(500, 500, 1000, 9) }));
    expect((await aggregator.get()).data()).toMatchObject({ availableCreditCents: 1000, revision: 9 });

    const zeroDecision = await seedOrder({ total: 100, amountPaid: 80, payments: [{ id: "payment", amount: 80, receivedAt: null }], creditApplied: 20 });
    const zeroAggregator = db.doc(`clientFinancial/${zeroDecision.clientId}`);
    await zeroAggregator.set({ state: "ready", availableCreditCents: 0, revision: 2 });
    await cancelOrderTransaction(db, command(zeroDecision, { creditDecision: creditDecision(0, 0, 0, 2) }));
    expect((await zeroAggregator.get()).data()).toMatchObject({ availableCreditCents: 0, revision: 2 });
  });

  it("bloqueia retirada de crédito consumido e devolução em dinheiro duplicada", async () => {
    const generated = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    await db.doc(`clientFinancial/${generated.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    const operation = command(generated, { creditDecision: creditDecision(0, 0) });
    await expectFinancialCode(cancelOrderTransaction(db, operation), "INSUFFICIENT_AVAILABLE_CREDIT");
    expect((await db.doc(`orders/${generated.orderId}`).get()).data()?.orderStatus).toBe("active");

    const doubleRestitution = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    await db.doc(`clientFinancial/${doubleRestitution.clientId}`).set({ state: "ready", availableCreditCents: 2000, revision: 1 });
    await expectFinancialCode(cancelOrderTransaction(db, command(doubleRestitution, {
      movement: { kind: "refund", amountCents: 10000, occurredAt: "2026-10-12T10:00:00Z" },
      creditDecision: creditDecision(0, 2000, 2000, 1),
    })), "CREDIT_DECISION_INCOMPATIBLE_WITH_CASH_REFUND");
  });

  it("exige agregador pronto e snapshot apresentado atual", async () => {
    const fixture = await seedOrder({ creditApplied: 10 });
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, { creditDecision: creditDecision(0, 0) })), "AGGREGATOR_UNAVAILABLE");
    await db.doc(`clientFinancial/${fixture.clientId}`).set({ state: "ready", availableCreditCents: 50, revision: 2 });
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, {
      creditDecision: creditDecision(0, 0, 0, 1),
    })), "AGGREGATOR_REVISION_CHANGED");
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, {
      creditDecision: creditDecision(0, 0, 0, 2),
    })), "CREDIT_BALANCE_CHANGED");
  });

  it("não permite restaurar ou manter mais crédito do que o Pedido registrou", async () => {
    const fixture = await seedOrder({ creditApplied: 10 });
    await db.doc(`clientFinancial/${fixture.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, {
      creditDecision: creditDecision(1001, 0),
    })), "CREDIT_DECISION_EXCEEDS_ORDER_EFFECTS");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");

    const generated = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    await db.doc(`clientFinancial/${generated.clientId}`).set({ state: "ready", availableCreditCents: 2000, revision: 1 });
    await expectFinancialCode(cancelOrderTransaction(db, command(generated, {
      creditDecision: creditDecision(0, 2001, 2000, 1),
    })), "CREDIT_DECISION_EXCEEDS_ORDER_EFFECTS");
  });

  it("rejeita pedido inexistente, cliente divergente e pedido já cancelado", async () => {
    const fixture = await seedOrder();
    await expectFinancialCode(cancelOrderTransaction(db, command({ ...fixture, orderId: `order-${randomUUID()}` })), "ORDER_NOT_FOUND");
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture, { clientId: "wrong-client" })), "CLIENT_MISMATCH");
    const cancelled = await seedOrder({ orderStatus: "cancelled" });
    await db.doc(`orders/${cancelled.orderId}`).update({
      deliveryDateTime: "2026-11-01T12:00:00Z",
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      tagIds: [],
    });
    await expectFinancialCode(cancelOrderTransaction(db, command(cancelled)), "ORDER_ALREADY_CANCELLED");
  });

  it("rejeita histórico de recebimentos inconsistente sem escolher uma fonte", async () => {
    const fixture = await seedOrder({ amountPaid: 40, payments: [{ id: "payment", amount: 30, receivedAt: null }] });
    await expectFinancialCode(cancelOrderTransaction(db, command(fixture)), "INVALID_FINANCIAL_STATE");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");
  });

  it("serializa cancelamento com novo recebimento no mesmo Pedido", async () => {
    const fixture = await seedOrder();
    const aggregator = db.doc(`clientFinancial/${fixture.clientId}`);
    await aggregator.set({ state: "ready", availableCreditCents: 0, revision: 1 });
    const cancel = command(fixture);
    const payment = {
      orderId: fixture.orderId, clientId: fixture.clientId, paymentId: "payment-concurrent",
      amountCents: 1000, receivedAt: "2026-10-12T12:00:00Z",
      presentedAvailableCreditCents: 0, presentedRevision: 1,
    };
    const outcomes = await Promise.allSettled([
      cancelOrderTransaction(db, cancel),
      recordPaymentTransaction(db, payment),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.orderStatus).toBe(outcomes[0]?.status === "fulfilled" ? "cancelled" : "active");
    expect(saved?.payments).toHaveLength(outcomes[0]?.status === "fulfilled" ? 0 : 1);
  });

  it("serializa decisão de crédito com pagamento concorrente no mesmo Pedido", async () => {
    const fixture = await seedOrder({ amountPaid: 120, payments: [{ id: "payment-original", amount: 120, receivedAt: null }], creditGenerated: 20 });
    await db.doc(`clientFinancial/${fixture.clientId}`).set({ state: "ready", availableCreditCents: 2000, revision: 1 });
    const cancellation = command(fixture, { creditDecision: creditDecision(0, 2000, 2000, 1) });
    const payment = {
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      paymentId: "payment-concurrent-credit",
      amountCents: 100,
      receivedAt: "2026-10-12T12:00:00Z",
      presentedAvailableCreditCents: 2000,
      presentedRevision: 1,
    };
    const outcomes = await Promise.allSettled([
      cancelOrderTransaction(db, cancellation),
      recordPaymentTransaction(db, payment),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    const aggregate = (await db.doc(`clientFinancial/${fixture.clientId}`).get()).data();
    if (saved?.orderStatus === "cancelled") {
      expect(saved.payments).toHaveLength(1);
      expect(aggregate).toMatchObject({ availableCreditCents: 2000, revision: 1 });
    } else {
      expect(saved?.payments).toHaveLength(2);
      expect(aggregate).toMatchObject({ availableCreditCents: 2100, revision: 2 });
    }
  });

  it("serializa cancelamento com edição operacional e transferência", async () => {
    const fixture = await seedOrder();
    const edit = {
      kind: "operational" as const, orderId: fixture.orderId, clientId: fixture.clientId,
      expected: { updatedAt: null }, changes: { notes: "Concorrência sintética" },
    };
    const outcomes = await Promise.allSettled([
      cancelOrderTransaction(db, command(fixture)),
      editOrderTransaction(db, edit),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.orderStatus).toBe(outcomes[0]?.status === "fulfilled" ? "cancelled" : "active");

    const transferFixture = await seedOrder();
    await db.doc(`orders/${transferFixture.orderId}`).update({
      deliveryDateTime: "2026-11-01T12:00:00Z",
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      tagIds: [],
    });
    await db.doc(`clients/${transferFixture.clientId}`).set({ name: "Origem" });
    const destinationClientId = `client-${randomUUID()}`;
    await db.doc(`clients/${destinationClientId}`).set({ name: "Destino" });
    const transfer = {
      kind: "transfer" as const, orderId: transferFixture.orderId,
      operationId: `transfer-${randomUUID()}`,
      sourceClientId: transferFixture.clientId, destinationClientId,
      expected: { updatedAt: null },
      confirmation: { sourceName: "Origem", destinationName: "Destino", confirmed: true as const },
    };
    const transferOutcomes = await Promise.allSettled([
      cancelOrderTransaction(db, command(transferFixture)),
      editOrderTransaction(db, transfer),
    ]);
    expect(transferOutcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const transferSaved = (await db.doc(`orders/${transferFixture.orderId}`).get()).data();
    expect(transferSaved?.orderStatus).toBe(transferOutcomes[0]?.status === "fulfilled" ? "cancelled" : "active");
  });

  it("serializa cancelamento com edição comercial sem gravar estado parcial", async () => {
    const fixture = await seedOrder();
    await db.doc(`orders/${fixture.orderId}`).update({
      deliveryDateTime: "2026-11-01T12:00:00Z",
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100,
      deliveryFee: 0,
      tagIds: [],
    });
    await db.doc(`clientFinancial/${fixture.clientId}`).set({ state: "ready", availableCreditCents: 0, revision: 1 });
    const edit = {
      kind: "commercial" as const,
      orderId: fixture.orderId,
      clientId: fixture.clientId,
      expected: { updatedAt: null },
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPriceCents: 9000, totalCents: 9000 }],
      subtotalCents: 9000,
      deliveryFeeCents: 0,
      totalCents: 9000,
    };
    const outcomes = await Promise.allSettled([
      cancelOrderTransaction(db, command(fixture)),
      editOrderTransaction(db, edit),
    ]);
    expect(outcomes.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.orderStatus).toBe(outcomes[0]?.status === "fulfilled" ? "cancelled" : "active");
    expect(saved?.total).toBe(outcomes[0]?.status === "fulfilled" ? 100 : 90);
  });

  it("não grava status nem marcador quando uma falha acontece depois da escrita transacional", async () => {
    const fixture = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    const aggregator = db.doc(`clientFinancial/${fixture.clientId}`);
    await aggregator.set({ state: "ready", availableCreditCents: 2000, revision: 7 });
    const operation = command(fixture, { creditDecision: creditDecision(0, 1000, 2000, 7) });
    const originalRunTransaction = db.runTransaction.bind(db);
    const failingDb = Object.create(db) as typeof db;
    failingDb.runTransaction = ((updateFunction, options) => originalRunTransaction(async (transaction) => {
      const failingTransaction = new Proxy(transaction, {
        get(target, property) {
          if (property === "create") return () => { throw new Error("falha injetada"); };
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return updateFunction(failingTransaction);
    }, options)) as typeof db.runTransaction;
    await expect(cancelOrderTransaction(failingDb, operation)).rejects.toThrow("falha injetada");
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()?.orderStatus).toBe("active");
    expect((await db.doc(`orders/${fixture.orderId}/cancellationOperations/${operation.operationId}`).get()).exists).toBe(false);
    expect((await aggregator.get()).data()).toMatchObject({ availableCreditCents: 2000, revision: 7 });
  });
});
