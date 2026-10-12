import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { cancelOrderTransaction } from "../../api/_financial/cancelOrder";
import { FinancialApiError } from "../../api/_financial/errors";
import { editOrderTransaction } from "../../api/_financial/orderEdit";
import { recordPaymentTransaction } from "../../api/_financial/paymentTransactions";
import type { CancelOrderCommand } from "../../api/_financial/validation";

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
} = {}): Promise<Fixture> {
  const suffix = randomUUID();
  const fixture = { orderId: `order-${suffix}`, clientId: `client-${suffix}` };
  const data: Record<string, unknown> = {
    clientId: fixture.clientId,
    clientName: "Cliente sintético",
    orderStatus: options.orderStatus ?? "active",
    total: options.total ?? 100,
    amountPaid: options.amountPaid ?? 0,
    payments: options.payments ?? [],
    creditApplied: options.creditApplied ?? 0,
    creditGenerated: options.creditGenerated ?? 0,
  };
  if (options.omitPayments) delete data.payments;
  if (options.refunds !== undefined) data.refunds = options.refunds;
  await db.doc(`orders/${fixture.orderId}`).set(data);
  return fixture;
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
  });

  it("registra devolução parcial como fato separado", async () => {
    const fixture = await seedOrder({ amountPaid: 100, payments: [{ id: "payment", amount: 100, receivedAt: null }] });
    await cancelOrderTransaction(db, command(fixture, { movement: { kind: "refund", amountCents: 2500, occurredAt: "2026-10-12T10:00:00Z" } }));
    const saved = (await db.doc(`orders/${fixture.orderId}`).get()).data();
    expect(saved?.amountPaid).toBe(100);
    expect(saved?.payments).toEqual([{ id: "payment", amount: 100, receivedAt: null }]);
    expect(saved?.refunds).toMatchObject([{ amount: 25, refundedAt: "2026-10-12T10:00:00Z" }]);
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
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({
      amountPaid: 50,
      payments: [...previous, { id: expect.stringMatching(/^cancel-operation-/), amount: 25, receivedAt: "2026-10-11T12:30:00-03:00" }],
    });
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
    expect((await db.doc(`orders/${fixture.orderId}`).get()).data()).toMatchObject({ payments, amountPaid: 100.1 + 200.2 });
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
  });

  it("aceita retry idêntico e rejeita reutilização divergente da identidade", async () => {
    const fixture = await seedOrder();
    const operation = command(fixture);
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: false });
    await expect(cancelOrderTransaction(db, operation)).resolves.toMatchObject({ replayed: true });
    await expectFinancialCode(cancelOrderTransaction(db, { ...operation, agreement: "Texto diferente" }), "CANCEL_OPERATION_ID_REUSED");
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

  it("bloqueia pedido com crédito aplicado ou gerado", async () => {
    const applied = await seedOrder({ creditApplied: 10 });
    await expectFinancialCode(cancelOrderTransaction(db, command(applied)), "ORDER_CREDIT_SETTLEMENT_UNSUPPORTED");
    const generated = await seedOrder({ amountPaid: 120, payments: [{ id: "payment", amount: 120, receivedAt: null }], creditGenerated: 20 });
    await expectFinancialCode(cancelOrderTransaction(db, command(generated)), "ORDER_CREDIT_SETTLEMENT_UNSUPPORTED");
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
    const fixture = await seedOrder();
    const operation = command(fixture);
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
  });
});
