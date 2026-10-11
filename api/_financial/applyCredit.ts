import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertValidMoneyCents,
  assertNonNegativeMoneyCents,
  calculateGeneratedCreditCents,
  calculateOrderBalanceCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  sumMoneyCents,
} from "../../src/features/financial/money";
import type { MoneyCents } from "../../src/features/financial/money";
import { confirmCreditApplication } from "../../src/features/financial/credit";
import { getOrderCashPaid } from "../../src/features/orders/orderUtils";
import type { OrderPayment, OrderStatus } from "../../src/features/orders/orderTypes";

import { FinancialApiError } from "./errors";
import type { FinancialActor } from "./auth";
import { createCommandFingerprint, type ApplyCreditCommand } from "./validation";

export interface ApplyCreditResult {
  operationId: string;
  clientId: string;
  orderId: string;
  appliedCreditCents: number;
  availableCreditCents: number;
  revision: number;
  replayed: boolean;
}

interface StoredOperationResult {
  operationId: string;
  clientId: string;
  orderId: string;
  appliedCreditCents: number;
  availableCreditCents: number;
  revision: number;
}

interface StoredOrder {
  clientId: string;
  orderStatus: OrderStatus;
  totalCents: MoneyCents;
  cashPaidCents: MoneyCents;
  creditAppliedCents: MoneyCents;
}

interface StoredAggregator {
  availableCreditCents: MoneyCents;
  revision: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asNonNegativeLegacyCents(value: unknown, fieldName: string): MoneyCents {
  if (typeof value !== "number") {
    throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
  }

  try {
    const cents = legacyReaisToMoneyCents(value, fieldName);
    assertNonNegativeMoneyCents(cents, fieldName);
    return cents;
  } catch (error) {
    if (error instanceof FinancialDomainError) {
      throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
    }
    throw error;
  }
}

function asNonNegativeStoredCents(value: unknown, fieldName: string): MoneyCents {
  if (typeof value !== "number") {
    throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
  }

  try {
    assertValidMoneyCents(value, fieldName);
    assertNonNegativeMoneyCents(value, fieldName);
    return value;
  } catch (error) {
    if (error instanceof FinancialDomainError) {
      throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
    }
    throw error;
  }
}

function parsePayments(value: unknown): OrderPayment[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
  }

  return value.map((payment) => {
    if (!isRecord(payment) || typeof payment.id !== "string" || typeof payment.amount !== "number") {
      throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
    }

    if (payment.receivedAt !== null && typeof payment.receivedAt !== "string") {
      throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
    }

    return { id: payment.id, amount: payment.amount, receivedAt: payment.receivedAt };
  });
}

function parseOrder(data: DocumentData): StoredOrder {
  if (typeof data.clientId !== "string" || !["active", "completed", "cancelled"].includes(String(data.orderStatus))) {
    throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
  }

  const payments = parsePayments(data.payments);
  const amountPaid = data.amountPaid;
  if (typeof amountPaid !== "number") {
    throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
  }

  const cashPaid = getOrderCashPaid({ amountPaid, payments });

  return {
    clientId: data.clientId,
    orderStatus: data.orderStatus as OrderStatus,
    totalCents: asNonNegativeLegacyCents(data.total, "Total do pedido"),
    cashPaidCents: asNonNegativeLegacyCents(cashPaid, "Dinheiro recebido"),
    creditAppliedCents: asNonNegativeLegacyCents(data.creditApplied ?? 0, "Crédito aplicado"),
  };
}

function parseAggregator(data: DocumentData): StoredAggregator {
  if (data.state !== "ready" || !Number.isSafeInteger(data.revision) || data.revision < 0) {
    throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
  }

  return {
    availableCreditCents: asNonNegativeStoredCents(data.availableCreditCents, "Crédito disponível"),
    revision: data.revision,
  };
}

function storedResultFromUnknown(value: unknown): StoredOperationResult {
  if (!isRecord(value)) {
    throw new FinancialApiError(409, "IDEMPOTENCY_RECORD_INVALID", "Registro de operação inválido.");
  }

  const operationId = value.operationId;
  const clientId = value.clientId;
  const orderId = value.orderId;
  const appliedCreditCents = value.appliedCreditCents;
  const availableCreditCents = value.availableCreditCents;
  const revision = value.revision;

  if (typeof operationId !== "string"
    || typeof clientId !== "string"
    || typeof orderId !== "string"
    || !Number.isSafeInteger(appliedCreditCents)
    || !Number.isSafeInteger(availableCreditCents)
    || !Number.isSafeInteger(revision)) {
    throw new FinancialApiError(409, "IDEMPOTENCY_RECORD_INVALID", "Registro de operação inválido.");
  }

  return {
    operationId,
    clientId,
    orderId,
    appliedCreditCents: appliedCreditCents as number,
    availableCreditCents: availableCreditCents as number,
    revision: revision as number,
  };
}

function toResult(result: StoredOperationResult, replayed: boolean): ApplyCreditResult {
  return { ...result, replayed };
}

function domainFailure(error: FinancialDomainError): FinancialApiError {
  const conflictCodes = new Set([
    "INSUFFICIENT_AVAILABLE_CREDIT",
    "CREDIT_BALANCE_CHANGED",
  ]);

  return new FinancialApiError(
    conflictCodes.has(error.code) ? 409 : 400,
    error.code,
    conflictCodes.has(error.code) ? "Conflito financeiro." : "Payload financeiro inválido.",
  );
}

export async function applyCreditTransaction(
  db: Firestore,
  command: ApplyCreditCommand,
  actor: FinancialActor,
): Promise<ApplyCreditResult> {
  const fingerprint = createCommandFingerprint(command);
  const aggregatorRef = db.collection("clientFinancial").doc(command.clientId);
  const operationRef = aggregatorRef.collection("operations").doc(command.operationId);
  const orderRef = db.collection("orders").doc(command.orderId);

  try {
    const applyCreditCents = command.applyCreditCents;
    const presentedAvailableCreditCents = command.presentedAvailableCreditCents;
    assertValidMoneyCents(applyCreditCents, "Crédito escolhido");
    assertValidMoneyCents(presentedAvailableCreditCents, "Crédito apresentado ao operador");
    return await db.runTransaction(async (transaction) => {
      // Every document is read before this transaction performs a write.
      const [operationSnapshot, orderSnapshot, aggregatorSnapshot] = await transaction.getAll(
        operationRef,
        orderRef,
        aggregatorRef,
      );

      if (operationSnapshot.exists) {
        const existing = operationSnapshot.data();
        if (existing?.fingerprint !== fingerprint) {
          throw new FinancialApiError(409, "IDEMPOTENCY_COLLISION", "A operação já foi usada com outro conteúdo.");
        }

        return toResult(storedResultFromUnknown(existing.result), true);
      }

      if (!orderSnapshot.exists) {
        throw new FinancialApiError(409, "ORDER_NOT_FOUND", "Pedido não encontrado.");
      }

      if (!aggregatorSnapshot.exists) {
        throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
      }

      const orderData = orderSnapshot.data();
      const aggregatorData = aggregatorSnapshot.data();
      if (!orderData || !aggregatorData) {
        throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
      }
      const order = parseOrder(orderData);
      const aggregator = parseAggregator(aggregatorData);

      if (order.clientId !== command.clientId) {
        throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e agregador não pertencem ao mesmo cliente.");
      }

      if (order.orderStatus === "cancelled") {
        throw new FinancialApiError(409, "ORDER_CANCELLED", "Pedido cancelado não aceita crédito.");
      }

      if (aggregator.revision !== command.presentedRevision) {
        throw new FinancialApiError(409, "AGGREGATOR_REVISION_CHANGED", "O estado financeiro mudou; confirme novamente.");
      }

      const remainingBeforeNewCredit = calculateOrderBalanceCents(
        order.totalCents,
        order.cashPaidCents,
        order.creditAppliedCents,
      );
      if (remainingBeforeNewCredit < 0) {
        throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
      }

      const confirmation = confirmCreditApplication({
        presentedAvailableCreditCents,
        currentAvailableCreditCents: aggregator.availableCreditCents,
        orderTotalCents: remainingBeforeNewCredit,
        selectedCents: applyCreditCents,
        confirmed: command.confirmed,
      });
      const nextAppliedCreditCents = sumMoneyCents([order.creditAppliedCents, confirmation.appliedCents]);
      const generatedCreditCents = calculateGeneratedCreditCents(
        order.totalCents,
        order.cashPaidCents,
        nextAppliedCreditCents,
      );
      const nextRevision = aggregator.revision + 1;
      if (!Number.isSafeInteger(nextRevision)) {
        throw new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
      }

      const result: StoredOperationResult = {
        operationId: command.operationId,
        clientId: command.clientId,
        orderId: command.orderId,
        appliedCreditCents: confirmation.appliedCents,
        availableCreditCents: confirmation.remainingAvailableCreditCents,
        revision: nextRevision,
      };

      transaction.update(orderRef, {
        creditApplied: moneyCentsToLegacyReais(nextAppliedCreditCents),
        ...(generatedCreditCents > 0
          ? { creditGenerated: moneyCentsToLegacyReais(generatedCreditCents) }
          : { creditGenerated: FieldValue.delete() }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(aggregatorRef, {
        availableCreditCents: confirmation.remainingAvailableCreditCents,
        revision: nextRevision,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(operationRef, {
        fingerprint,
        result,
        actorUid: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return toResult(result, false);
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) {
      throw domainFailure(error);
    }
    throw error;
  }
}
