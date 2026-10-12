import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  calculateGeneratedCreditCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  sumMoneyCents,
} from "../../src/features/financial/money.js";
import type { MoneyCents } from "../../src/features/financial/money.js";
import type { CancelOrderCommand } from "./validation.js";
import { FinancialApiError } from "./errors.js";

interface StoredPayment {
  id: string;
  amountCents: MoneyCents;
  receivedAt: string | null;
}

interface StoredRefund {
  id: string;
  amountCents: MoneyCents;
  refundedAt: string;
}

interface StoredOrder {
  cashPaidCents: MoneyCents;
  totalCents: MoneyCents;
  creditAppliedCents: MoneyCents;
  creditGeneratedCents: MoneyCents;
  payments?: StoredPayment[];
  refunds: StoredRefund[];
  orderStatus: "active" | "completed" | "cancelled";
}

export interface CancelOrderResult {
  orderId: string;
  replayed: boolean;
}

function invalidState(): FinancialApiError {
  return new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
}

function asNonNegativeLegacyCents(value: unknown, field: string): MoneyCents {
  if (typeof value !== "number") throw invalidState();
  try {
    const cents = legacyReaisToMoneyCents(value, field);
    assertNonNegativeMoneyCents(cents, field);
    return cents;
  } catch (error) {
    if (error instanceof FinancialDomainError) throw invalidState();
    throw error;
  }
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function parsePayments(value: unknown): StoredPayment[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalidState();
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw invalidState();
    const payment = entry as Record<string, unknown>;
    if (typeof payment.id !== "string" || payment.id.trim().length === 0 || ids.has(payment.id)
      || (payment.receivedAt !== null && !isValidDate(payment.receivedAt))) throw invalidState();
    ids.add(payment.id);
    const amountCents = asNonNegativeLegacyCents(payment.amount, "Pagamento");
    if (amountCents <= 0) throw invalidState();
    return { id: payment.id, amountCents, receivedAt: payment.receivedAt as string | null };
  });
}

function parseRefunds(value: unknown): StoredRefund[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw invalidState();
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw invalidState();
    const refund = entry as Record<string, unknown>;
    if (typeof refund.id !== "string" || refund.id.trim().length === 0 || ids.has(refund.id) || !isValidDate(refund.refundedAt)) {
      throw invalidState();
    }
    ids.add(refund.id);
    const amountCents = asNonNegativeLegacyCents(refund.amount, "Devolução");
    if (amountCents <= 0) throw invalidState();
    return { id: refund.id, amountCents, refundedAt: refund.refundedAt };
  });
}

function parseOrder(data: DocumentData): StoredOrder {
  const totalCents = asNonNegativeLegacyCents(data.total, "Total do pedido");
  const payments = parsePayments(data.payments);
  let amountPaidCents: MoneyCents;
  try {
    amountPaidCents = asNonNegativeLegacyCents(data.amountPaid, "Dinheiro recebido");
  } catch (error) {
    const provesFloatingPointCache = typeof data.amountPaid === "number"
      && Number.isFinite(data.amountPaid)
      && payments !== undefined
      && data.amountPaid === payments.reduce((sum, payment) => sum + moneyCentsToLegacyReais(payment.amountCents), 0);
    if (!provesFloatingPointCache) throw error;
    amountPaidCents = sumMoneyCents(payments.map((payment) => payment.amountCents));
  }
  const cashPaidCents = payments === undefined
    ? amountPaidCents
    : sumMoneyCents(payments.map((payment) => payment.amountCents));
  if (payments !== undefined && cashPaidCents !== amountPaidCents) {
    const provesFloatingPointCache = typeof data.amountPaid === "number"
      && Number.isFinite(data.amountPaid)
      && data.amountPaid === payments.reduce((sum, payment) => sum + moneyCentsToLegacyReais(payment.amountCents), 0);
    if (!provesFloatingPointCache) throw invalidState();
  }

  const creditAppliedCents = asNonNegativeLegacyCents(data.creditApplied ?? 0, "Crédito aplicado");
  const creditGeneratedCents = asNonNegativeLegacyCents(data.creditGenerated ?? 0, "Crédito gerado");
  if (calculateGeneratedCreditCents(totalCents, cashPaidCents, creditAppliedCents) !== creditGeneratedCents) throw invalidState();
  const refunds = parseRefunds(data.refunds);
  const refundedCents = sumMoneyCents(refunds.map((refund) => refund.amountCents));
  if (refundedCents > cashPaidCents) throw invalidState();
  if (data.orderStatus !== "active" && data.orderStatus !== "completed" && data.orderStatus !== "cancelled") throw invalidState();
  return { totalCents, cashPaidCents, creditAppliedCents, creditGeneratedCents, payments, refunds, orderStatus: data.orderStatus };
}

function canonical(value: unknown): string {
  if (value === undefined) return "__undefined__";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function fingerprint(command: CancelOrderCommand): string {
  return createHash("sha256").update(canonical(command)).digest("hex");
}

function assertOrderPrecondition(updatedAt: unknown, expected: CancelOrderCommand["expected"]): void {
  let current: { seconds: number; nanoseconds: number } | null = null;
  if (updatedAt !== undefined && updatedAt !== null) {
    if (!(updatedAt instanceof Timestamp)) throw new FinancialApiError(409, "ORDER_CHANGED", "O Pedido mudou; atualize os dados e tente novamente.");
    current = { seconds: updatedAt.seconds, nanoseconds: updatedAt.nanoseconds };
  }
  if (canonical(current) !== canonical(expected.updatedAt)) {
    throw new FinancialApiError(409, "ORDER_CHANGED", "O Pedido mudou; atualize os dados e tente novamente.");
  }
}

function conflict(code: string, message: string): never {
  throw new FinancialApiError(409, code, message);
}

function assertValidCommand(command: CancelOrderCommand): void {
  if (typeof command.agreement !== "string" || command.agreement.trim().length === 0
    || !Number.isSafeInteger(command.movement.amountCents) || command.movement.amountCents < 0) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Negociação ou movimentação inválida.");
  }
  if (command.movement.kind === "none") {
    if (command.movement.amountCents !== 0 || command.movement.occurredAt !== null) {
      throw new FinancialApiError(400, "INVALID_PAYLOAD", "Movimentação inexistente exige valor zero e data nula.");
    }
    return;
  }
  const occurredAt = command.movement.occurredAt;
  if ((command.movement.kind !== "receipt" && command.movement.kind !== "refund")
    || command.movement.amountCents <= 0
    || typeof occurredAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt)
    || Number.isNaN(new Date(occurredAt).getTime())) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Movimentação efetiva exige valor positivo e data/hora com fuso.");
  }
  const [date] = occurredAt.split("T");
  const [year, month, day] = (date ?? "").split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== (month ?? 0) - 1 || calendarDate.getUTCDate() !== day) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Data da movimentação inválida.");
  }
}

export async function cancelOrderTransaction(db: Firestore, command: CancelOrderCommand): Promise<CancelOrderResult> {
  const orderRef = db.collection("orders").doc(command.orderId);
  const operationRef = orderRef.collection("cancellationOperations").doc(command.operationId);
  const requestFingerprint = fingerprint(command);

  return db.runTransaction(async (transaction) => {
    assertValidCommand(command);
    const [orderSnapshot, operationSnapshot] = await transaction.getAll(orderRef, operationRef);
    if (!orderSnapshot.exists) conflict("ORDER_NOT_FOUND", "Pedido não encontrado.");
    const data = orderSnapshot.data();
    if (!data) throw invalidState();
    const order = parseOrder(data);
    if (data.clientId !== command.clientId) conflict("CLIENT_MISMATCH", "Pedido e Cliente não correspondem.");

    if (operationSnapshot.exists) {
      if (operationSnapshot.data()?.fingerprint !== requestFingerprint) {
        conflict("CANCEL_OPERATION_ID_REUSED", "A identidade da operação já foi usada com conteúdo diferente.");
      }
      return { orderId: command.orderId, replayed: true };
    }

    assertOrderPrecondition(data.updatedAt, command.expected);
    if (order.orderStatus === "cancelled") conflict("ORDER_ALREADY_CANCELLED", "Pedido já cancelado.");
    if (order.creditAppliedCents > 0 || order.creditGeneratedCents > 0) {
      conflict("ORDER_CREDIT_SETTLEMENT_UNSUPPORTED", "O cancelamento de Pedidos com efeito de crédito aguarda tratamento explícito.");
    }

    let payments = order.payments;
    let refunds = order.refunds;
    if (command.movement.kind === "receipt") {
      const nextCashPaidCents = sumMoneyCents([order.cashPaidCents, command.movement.amountCents as MoneyCents]);
      if (calculateGeneratedCreditCents(order.totalCents, nextCashPaidCents, 0 as MoneyCents) > 0) {
        conflict("CANCEL_RECEIPT_WOULD_GENERATE_CREDIT", "O recebimento ultrapassaria o saldo financeiro do Pedido e geraria crédito.");
      }
      const existingPayments = payments ?? (order.cashPaidCents > 0
        ? [{ id: `legacy-${command.orderId}`, amountCents: order.cashPaidCents, receivedAt: null }]
        : []);
      const paymentId = `cancel-${command.operationId}`;
      if (existingPayments.some((payment) => payment.id === paymentId)) conflict("CANCEL_PAYMENT_ID_COLLISION", "Identidade de recebimento já utilizada.");
      payments = [
        ...existingPayments,
        { id: paymentId, amountCents: command.movement.amountCents as MoneyCents, receivedAt: command.movement.occurredAt },
      ];
    } else if (command.movement.kind === "refund") {
      const refundedCents = sumMoneyCents(refunds.map((refund) => refund.amountCents));
      if (command.movement.amountCents > order.cashPaidCents - refundedCents) {
        conflict("REFUND_EXCEEDS_UNREFUNDED_RECEIPTS", "A devolução ultrapassa o dinheiro recebido ainda não devolvido.");
      }
      const refundId = `cancel-${command.operationId}`;
      if (refunds.some((refund) => refund.id === refundId)) conflict("CANCEL_REFUND_ID_COLLISION", "Identidade de devolução já utilizada.");
      refunds = [...refunds, {
        id: refundId,
        amountCents: command.movement.amountCents as MoneyCents,
        refundedAt: command.movement.occurredAt as string,
      }];
    }

    transaction.update(orderRef, {
      orderStatus: "cancelled",
      cancellationAgreement: { operationId: command.operationId, text: command.agreement },
      ...(command.movement.kind !== "receipt" || payments === undefined ? {} : {
        payments: payments.map((payment) => ({
          id: payment.id,
          amount: moneyCentsToLegacyReais(payment.amountCents),
          receivedAt: payment.receivedAt,
        })),
        amountPaid: moneyCentsToLegacyReais(sumMoneyCents(payments.map((payment) => payment.amountCents))),
      }),
      ...(command.movement.kind !== "refund" ? {} : {
        refunds: refunds.map((refund) => ({
          id: refund.id,
          amount: moneyCentsToLegacyReais(refund.amountCents),
          refundedAt: refund.refundedAt,
        })),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(operationRef, { fingerprint: requestFingerprint });
    return { orderId: command.orderId, replayed: false };
  });
}
