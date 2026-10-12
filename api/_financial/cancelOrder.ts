import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  calculateGeneratedCreditCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  subtractMoneyCents,
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
  refundedCents: MoneyCents;
  payments?: StoredPayment[];
  refunds: StoredRefund[];
  orderStatus: "active" | "completed" | "cancelled";
}

interface StoredAggregator {
  availableCreditCents: MoneyCents;
  revision: number;
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
  return typeof value === "string"
    && /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && !Number.isNaN(new Date(value).getTime());
}

function isStableEventId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
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
    if (typeof refund.id !== "string" || !isStableEventId(refund.id) || ids.has(refund.id) || !isValidDate(refund.refundedAt)) {
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
  return { totalCents, cashPaidCents, creditAppliedCents, creditGeneratedCents, refundedCents, payments, refunds, orderStatus: data.orderStatus };
}

function parseAggregator(data: DocumentData | undefined): StoredAggregator {
  if (data?.state !== "ready"
    || !Number.isSafeInteger(data.revision)
    || data.revision < 0
    || !Number.isSafeInteger(data.availableCreditCents)
    || data.availableCreditCents < 0) {
    throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
  }
  return {
    availableCreditCents: data.availableCreditCents as MoneyCents,
    revision: data.revision as number,
  };
}

function assertCreditPrecondition(aggregator: StoredAggregator, command: NonNullable<CancelOrderCommand["creditDecision"]>): void {
  if (aggregator.revision !== command.presentedRevision) {
    conflict("AGGREGATOR_REVISION_CHANGED", "O estado financeiro mudou; confirme novamente.");
  }
  if (aggregator.availableCreditCents !== command.presentedAvailableCreditCents) {
    conflict("CREDIT_BALANCE_CHANGED", "O saldo de crédito mudou; confirme novamente.");
  }
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
  if (command.creditDecision !== undefined
    && (!Number.isSafeInteger(command.creditDecision.appliedRestoredCents)
      || command.creditDecision.appliedRestoredCents < 0
      || !Number.isSafeInteger(command.creditDecision.generatedRetainedCents)
      || command.creditDecision.generatedRetainedCents < 0
      || !Number.isSafeInteger(command.creditDecision.presentedAvailableCreditCents)
      || command.creditDecision.presentedAvailableCreditCents < 0
      || !Number.isSafeInteger(command.creditDecision.presentedRevision)
      || command.creditDecision.presentedRevision < 0
      || command.creditDecision.confirmed !== true)) {
    throw new FinancialApiError(400, "INVALID_PAYLOAD", "Decisão explícita de crédito inválida.");
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

  try {
    return await db.runTransaction(async (transaction) => {
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

      const hasCreditEffects = order.creditAppliedCents > 0 || order.creditGeneratedCents > 0;
      if (hasCreditEffects && command.creditDecision === undefined) {
        conflict("CREDIT_DECISION_REQUIRED", "Confirme explicitamente o destino do crédito do Pedido.");
      }
      if (!hasCreditEffects && command.creditDecision !== undefined) {
        conflict("CREDIT_DECISION_NOT_APPLICABLE", "Este Pedido não possui efeitos de crédito para decidir.");
      }

      let aggregatorRef: FirebaseFirestore.DocumentReference | undefined;
      let aggregator: StoredAggregator | undefined;
      if (hasCreditEffects && command.creditDecision) {
        if (command.creditDecision.appliedRestoredCents > order.creditAppliedCents
          || command.creditDecision.generatedRetainedCents > order.creditGeneratedCents) {
          conflict("CREDIT_DECISION_EXCEEDS_ORDER_EFFECTS", "A decisão excede o crédito originalmente registrado no Pedido.");
        }
        aggregatorRef = db.collection("clientFinancial").doc(command.clientId);
        const aggregatorSnapshot = await transaction.get(aggregatorRef);
        if (!aggregatorSnapshot.exists) {
          throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
        }
        aggregator = parseAggregator(aggregatorSnapshot.data());
        assertCreditPrecondition(aggregator, command.creditDecision);
      }

      let payments = order.payments;
      let refunds = order.refunds;
      let cashPaidCents = order.cashPaidCents;
      if (command.movement.kind === "receipt") {
        cashPaidCents = sumMoneyCents([order.cashPaidCents, command.movement.amountCents as MoneyCents]);
        const nextGeneratedCents = calculateGeneratedCreditCents(
          order.totalCents,
          cashPaidCents,
          order.creditAppliedCents,
        );
        if (nextGeneratedCents > order.creditGeneratedCents) {
          conflict("CANCEL_RECEIPT_WOULD_GENERATE_CREDIT", "O recebimento aumentaria o crédito gerado do Pedido.");
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
        if (command.movement.amountCents > order.cashPaidCents - order.refundedCents) {
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

      let nextAvailableCreditCents: MoneyCents | undefined;
      let nextAggregatorRevision: number | undefined;
      if (command.creditDecision && aggregator) {
        const appliedRetainedCents = subtractMoneyCents(
          order.creditAppliedCents,
          command.creditDecision.appliedRestoredCents as MoneyCents,
        );
        const nextRefundedCents = sumMoneyCents(refunds.map((refund) => refund.amountCents));
        const cashRetainedCents = subtractMoneyCents(cashPaidCents, nextRefundedCents);
        const creditGeneratedStillSupportedCents = calculateGeneratedCreditCents(
          order.totalCents,
          cashRetainedCents,
          appliedRetainedCents,
        );
        if (command.creditDecision.generatedRetainedCents > creditGeneratedStillSupportedCents) {
          conflict("CREDIT_DECISION_INCOMPATIBLE_WITH_CASH_REFUND", "O crédito mantido excede o excedente após recebimentos, devoluções e crédito aplicado não restituído.");
        }

        const appliedRestoredCents = command.creditDecision.appliedRestoredCents as MoneyCents;
        const generatedRetainedCents = command.creditDecision.generatedRetainedCents as MoneyCents;
        const deltaCents = generatedRetainedCents >= order.creditGeneratedCents
          ? sumMoneyCents([
            appliedRestoredCents,
            subtractMoneyCents(generatedRetainedCents, order.creditGeneratedCents),
          ])
          : subtractMoneyCents(
            appliedRestoredCents,
            subtractMoneyCents(order.creditGeneratedCents, generatedRetainedCents),
          );
        const nextAvailableValue = aggregator.availableCreditCents + deltaCents;
        if (!Number.isSafeInteger(nextAvailableValue)) throw invalidState();
        if (nextAvailableValue < 0) {
          conflict("INSUFFICIENT_AVAILABLE_CREDIT", "O saldo disponível não cobre a retirada do crédito já utilizado.");
        }
        nextAvailableCreditCents = nextAvailableValue as MoneyCents;
        assertNonNegativeMoneyCents(nextAvailableCreditCents, "Crédito disponível após cancelamento");
        nextAggregatorRevision = aggregator.revision + (deltaCents === 0 ? 0 : 1);
        if (!Number.isSafeInteger(nextAggregatorRevision)) throw invalidState();
      }

      transaction.update(orderRef, {
        orderStatus: "cancelled",
        cancellationAgreement: {
          operationId: command.operationId,
          text: command.agreement,
          ...(command.creditDecision === undefined ? {} : {
            creditDecision: {
              appliedRestoredCents: command.creditDecision.appliedRestoredCents,
              generatedRetainedCents: command.creditDecision.generatedRetainedCents,
            },
          }),
        },
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
      if (aggregatorRef && nextAvailableCreditCents !== undefined && nextAggregatorRevision !== undefined
        && nextAggregatorRevision !== aggregator?.revision) {
        transaction.update(aggregatorRef, {
          availableCreditCents: nextAvailableCreditCents,
          revision: nextAggregatorRevision,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(operationRef, { fingerprint: requestFingerprint });
      return { orderId: command.orderId, replayed: false };
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) throw invalidState();
    throw error;
  }
}
