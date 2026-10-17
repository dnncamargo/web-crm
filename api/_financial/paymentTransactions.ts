import { FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";

import {
  FinancialDomainError,
  assertNonNegativeMoneyCents,
  assertValidMoneyCents,
  calculateGeneratedCreditCents,
  legacyReaisToMoneyCents,
  moneyCentsToLegacyReais,
  subtractMoneyCents,
  sumMoneyCents,
} from "../../src/features/financial/money.js";
import { validateRetroactiveCreditReduction } from "../../src/features/financial/credit.js";
import {
  reconcileFinancialDocuments,
  type ReconciliationOrderDocument,
} from "../../src/features/financial/reconciliation.js";
import type { MoneyCents } from "../../src/features/financial/money.js";
import type { OrderStatus } from "../../src/features/orders/orderTypes.js";

import { FinancialApiError } from "./errors.js";
import type {
  CorrectPaymentCommand,
  ProductionCorrectPaymentCommand,
  RecordPaymentCommand,
} from "./validation.js";

interface StoredPayment {
  id: string;
  amountCents: MoneyCents;
  receivedAt: string | null;
}

interface StoredOrder {
  clientId: string;
  orderStatus: OrderStatus;
  totalCents: MoneyCents;
  cashPaidCents: MoneyCents;
  creditAppliedCents: MoneyCents;
  creditGeneratedCents: MoneyCents;
  payments?: StoredPayment[];
}

interface StoredAggregator {
  availableCreditCents: MoneyCents;
  revision: number;
}

export interface PaymentTransactionResult {
  paymentId: string;
  currentAmountPaidCents: number;
  currentCreditGeneratedCents: number;
  currentAvailableCreditCents: number;
  currentRevision: number;
  replayed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function financialStateError(): FinancialApiError {
  return new FinancialApiError(409, "INVALID_FINANCIAL_STATE", "Estado financeiro inválido.");
}

function domainFailure(error: FinancialDomainError): FinancialApiError {
  if (error.code === "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED") {
    return new FinancialApiError(409, error.code, "A redução de crédito não é coberta pelo saldo disponível.");
  }
  return financialStateError();
}

function asNonNegativeLegacyCents(value: unknown, fieldName: string): MoneyCents {
  if (typeof value !== "number") throw financialStateError();

  try {
    const cents = legacyReaisToMoneyCents(value, fieldName);
    assertNonNegativeMoneyCents(cents, fieldName);
    return cents;
  } catch (error) {
    if (error instanceof FinancialDomainError) throw financialStateError();
    throw error;
  }
}

function asNonNegativeStoredCents(value: unknown, fieldName: string): MoneyCents {
  if (typeof value !== "number") throw financialStateError();

  try {
    assertValidMoneyCents(value, fieldName);
    assertNonNegativeMoneyCents(value, fieldName);
    return value;
  } catch (error) {
    if (error instanceof FinancialDomainError) throw financialStateError();
    throw error;
  }
}

function isStoredReceivedAt(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && !Number.isNaN(new Date(value).getTime()));
}

function parsePayments(value: unknown): StoredPayment[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw financialStateError();

  const ids = new Set<string>();
  return value.map((payment) => {
    if (!isRecord(payment)
      || typeof payment.id !== "string"
      || payment.id.trim().length === 0
      || ids.has(payment.id)
      || !isStoredReceivedAt(payment.receivedAt)) {
      throw financialStateError();
    }
    ids.add(payment.id);
    const amountCents = asNonNegativeLegacyCents(payment.amount, "Pagamento");
    if (amountCents <= 0) throw financialStateError();
    return { id: payment.id, amountCents, receivedAt: payment.receivedAt };
  });
}

function parseOrder(data: DocumentData): StoredOrder {
  if (typeof data.clientId !== "string"
    || !["active", "completed", "cancelled"].includes(String(data.orderStatus))) {
    throw financialStateError();
  }

  const totalCents = asNonNegativeLegacyCents(data.total, "Total do pedido");
  const amountPaidCents = asNonNegativeLegacyCents(data.amountPaid, "Dinheiro recebido");
  const payments = parsePayments(data.payments);
  const cashPaidCents = payments === undefined
    ? amountPaidCents
    : sumMoneyCents(payments.map((payment) => payment.amountCents));

  if (payments !== undefined && cashPaidCents !== amountPaidCents) throw financialStateError();

  const creditAppliedCents = asNonNegativeLegacyCents(data.creditApplied ?? 0, "Crédito aplicado");
  const creditGeneratedCents = asNonNegativeLegacyCents(data.creditGenerated ?? 0, "Crédito gerado");
  const expectedGeneratedCreditCents = calculateGeneratedCreditCents(totalCents, cashPaidCents, creditAppliedCents);
  if (creditGeneratedCents !== expectedGeneratedCreditCents) throw financialStateError();

  return {
    clientId: data.clientId,
    orderStatus: data.orderStatus as OrderStatus,
    totalCents,
    cashPaidCents,
    creditAppliedCents,
    creditGeneratedCents,
    payments,
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

function legacyPaymentId(orderId: string): string {
  return `legacy-${orderId}`;
}

function materializePayments(orderId: string, order: StoredOrder, incomingPaymentId: string): StoredPayment[] {
  if (order.payments !== undefined) return order.payments;
  if (incomingPaymentId === legacyPaymentId(orderId)) {
    throw new FinancialApiError(409, "LEGACY_PAYMENT_ID_COLLISION", "Identidade de pagamento reservada para legado.");
  }
  if (order.cashPaidCents === 0) return [];
  return [{ id: legacyPaymentId(orderId), amountCents: order.cashPaidCents, receivedAt: null }];
}

function assertWritePrecondition(
  aggregator: StoredAggregator,
  command: Pick<RecordPaymentCommand, "presentedAvailableCreditCents" | "presentedRevision">,
): void {
  if (aggregator.revision !== command.presentedRevision) {
    throw new FinancialApiError(409, "AGGREGATOR_REVISION_CHANGED", "O estado financeiro mudou; confirme novamente.");
  }
  if (aggregator.availableCreditCents !== command.presentedAvailableCreditCents) {
    throw new FinancialApiError(409, "CREDIT_BALANCE_CHANGED", "O saldo de crédito mudou; confirme novamente.");
  }
}

function nextAvailableCredit(
  aggregator: StoredAggregator,
  previousGeneratedCreditCents: MoneyCents,
  nextGeneratedCreditCents: MoneyCents,
): MoneyCents {
  if (nextGeneratedCreditCents < previousGeneratedCreditCents) {
    return validateRetroactiveCreditReduction({
      availableCreditCents: aggregator.availableCreditCents,
      previousGeneratedCreditCents,
      nextGeneratedCreditCents,
    }).nextAvailableCreditCents;
  }

  return sumMoneyCents([
    aggregator.availableCreditCents,
    subtractMoneyCents(nextGeneratedCreditCents, previousGeneratedCreditCents),
  ]);
}

function result(
  paymentId: string,
  cashPaidCents: MoneyCents,
  creditGeneratedCents: MoneyCents,
  availableCreditCents: MoneyCents,
  revision: number,
  replayed: boolean,
): PaymentTransactionResult {
  return {
    paymentId,
    currentAmountPaidCents: cashPaidCents,
    currentCreditGeneratedCents: creditGeneratedCents,
    currentAvailableCreditCents: availableCreditCents,
    currentRevision: revision,
    replayed,
  };
}

function writePaymentMutation(
  transaction: FirebaseFirestore.Transaction,
  orderRef: FirebaseFirestore.DocumentReference,
  aggregatorRef: FirebaseFirestore.DocumentReference,
  order: StoredOrder,
  aggregator: StoredAggregator,
  payments: readonly StoredPayment[],
): PaymentTransactionResult {
  const cashPaidCents = sumMoneyCents(payments.map((payment) => payment.amountCents));
  const creditGeneratedCents = calculateGeneratedCreditCents(order.totalCents, cashPaidCents, order.creditAppliedCents);
  const availableCreditCents = nextAvailableCredit(aggregator, order.creditGeneratedCents, creditGeneratedCents);
  const revision = aggregator.revision + 1;
  if (!Number.isSafeInteger(revision)) throw financialStateError();

  transaction.update(orderRef, {
    payments: payments.map((payment) => ({
      id: payment.id,
      amount: moneyCentsToLegacyReais(payment.amountCents),
      receivedAt: payment.receivedAt,
    })),
    amountPaid: moneyCentsToLegacyReais(cashPaidCents),
    ...(creditGeneratedCents > 0
      ? { creditGenerated: moneyCentsToLegacyReais(creditGeneratedCents) }
      : { creditGenerated: FieldValue.delete() }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  transaction.update(aggregatorRef, {
    availableCreditCents,
    revision,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return result("", cashPaidCents, creditGeneratedCents, availableCreditCents, revision, false);
}

async function readOrderAndAggregator(
  db: Firestore,
  command: Pick<RecordPaymentCommand, "orderId" | "clientId">,
  action: (transaction: FirebaseFirestore.Transaction, order: StoredOrder, aggregator: StoredAggregator, orderRef: FirebaseFirestore.DocumentReference, aggregatorRef: FirebaseFirestore.DocumentReference) => PaymentTransactionResult,
): Promise<PaymentTransactionResult> {
  const orderRef = db.collection("orders").doc(command.orderId);
  const aggregatorRef = db.collection("clientFinancial").doc(command.clientId);
  return db.runTransaction(async (transaction) => {
    const [orderSnapshot, aggregatorSnapshot] = await transaction.getAll(orderRef, aggregatorRef);
    if (!orderSnapshot.exists) throw new FinancialApiError(409, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    if (!aggregatorSnapshot.exists) {
      throw new FinancialApiError(409, "AGGREGATOR_UNAVAILABLE", "Agregador financeiro indisponível.");
    }
    const orderData = orderSnapshot.data();
    const aggregatorData = aggregatorSnapshot.data();
    if (!orderData || !aggregatorData) throw financialStateError();
    const order = parseOrder(orderData);
    const aggregator = parseAggregator(aggregatorData);
    if (order.clientId !== command.clientId) {
      throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e agregador não pertencem ao mesmo cliente.");
    }
    return action(transaction, order, aggregator, orderRef, aggregatorRef);
  });
}

export async function recordPaymentTransaction(db: Firestore, command: RecordPaymentCommand): Promise<PaymentTransactionResult> {
  try {
    return await readOrderAndAggregator(db, command, (transaction, order, aggregator, orderRef, aggregatorRef) => {
      const payments = materializePayments(command.orderId, order, command.paymentId);
      const existing = payments.find((payment) => payment.id === command.paymentId);
      if (existing) {
        if (existing.amountCents !== command.amountCents || existing.receivedAt !== command.receivedAt) {
          throw new FinancialApiError(409, "PAYMENT_ID_COLLISION", "O pagamento já existe com conteúdo diferente.");
        }
        return result(command.paymentId, order.cashPaidCents, order.creditGeneratedCents, aggregator.availableCreditCents, aggregator.revision, true);
      }
      if (order.orderStatus === "cancelled") {
        throw new FinancialApiError(409, "ORDER_CANCELLED", "Pedido cancelado não aceita recebimento.");
      }
      assertWritePrecondition(aggregator, command);
      const mutation = writePaymentMutation(transaction, orderRef, aggregatorRef, order, aggregator, [
        ...payments,
        { id: command.paymentId, amountCents: command.amountCents as MoneyCents, receivedAt: command.receivedAt },
      ]);
      return { ...mutation, paymentId: command.paymentId };
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) throw domainFailure(error);
    throw error;
  }
}

export async function correctPaymentTransaction(db: Firestore, command: CorrectPaymentCommand): Promise<PaymentTransactionResult> {
  try {
    return await readOrderAndAggregator(db, command, (transaction, order, aggregator, orderRef, aggregatorRef) => {
      if (order.orderStatus === "cancelled") {
        throw new FinancialApiError(409, "ORDER_CANCELLED", "Pedido cancelado não aceita correção nesta etapa.");
      }
      if (order.payments === undefined) {
        throw new FinancialApiError(409, "LEGACY_PAYMENT_CORRECTION_REQUIRES_DECISION", "Correção de pagamento legado requer decisão aprovada.");
      }
      const current = order.payments.find((payment) => payment.id === command.paymentId);
      if (!current) throw new FinancialApiError(409, "PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
      if (current.amountCents === command.amountCents && current.receivedAt === command.receivedAt) {
        return result(command.paymentId, order.cashPaidCents, order.creditGeneratedCents, aggregator.availableCreditCents, aggregator.revision, true);
      }
      if (current.amountCents !== command.expectedAmountCents || current.receivedAt !== command.expectedReceivedAt) {
        throw new FinancialApiError(409, "PAYMENT_PRECONDITION_CHANGED", "O pagamento mudou; confirme novamente.");
      }
      if (current.receivedAt !== null && command.receivedAt === null) {
        throw new FinancialApiError(
          409,
          "RECEIVED_AT_REMOVAL_REQUIRES_DECISION",
          "A remoção de uma data de recebimento conhecida não é permitida.",
        );
      }
      assertWritePrecondition(aggregator, command);
      const mutation = writePaymentMutation(transaction, orderRef, aggregatorRef, order, aggregator, order.payments.map((payment) => (
        payment.id === command.paymentId
          ? { id: payment.id, amountCents: command.amountCents as MoneyCents, receivedAt: command.receivedAt }
          : payment
      )));
      return { ...mutation, paymentId: command.paymentId };
    });
  } catch (error) {
    if (error instanceof FinancialDomainError) throw domainFailure(error);
    throw error;
  }
}

const MAX_PRODUCTION_CLIENT_ORDERS_FOR_CORRECTION = 500;

export interface ProductionPaymentCorrectionResult {
  paymentId: string;
  currentAmountPaidCents: number;
  currentCreditGeneratedCents: number;
  currentAvailableCreditCents: number;
  replayed: boolean;
}

function toReconciliationOrderDocument(id: string, data: DocumentData): ReconciliationOrderDocument {
  const order: ReconciliationOrderDocument = {
    id,
    clientId: data.clientId,
    orderStatus: data.orderStatus,
    amountPaid: data.amountPaid,
    total: data.total,
  };
  if (data.payments !== undefined) order.payments = data.payments;
  if (data.refunds !== undefined) order.refunds = data.refunds;
  if (data.cancellationAgreement !== undefined) order.cancellationAgreement = data.cancellationAgreement;
  if (data.creditApplied !== undefined) order.creditApplied = data.creditApplied;
  if (data.creditGenerated !== undefined) order.creditGenerated = data.creditGenerated;
  if (data.subtotal !== undefined) order.subtotal = data.subtotal;
  if (data.deliveryFee !== undefined) order.deliveryFee = data.deliveryFee;
  if (data.items !== undefined) order.items = data.items;
  return order;
}

function requireConclusiveProductionClientCredit(
  orders: readonly ReconciliationOrderDocument[],
  clientId: string,
): MoneyCents {
  const client = reconcileFinancialDocuments(orders).clients.find((candidate) => candidate.clientId === clientId);
  if (!client?.conclusive
    || client.availableCreditCents === null
    || !Number.isSafeInteger(client.availableCreditCents)
    || client.availableCreditCents < 0) {
    throw new FinancialApiError(
      409,
      "CLIENT_FINANCIAL_STATE_INCONCLUSIVE",
      "Os dados financeiros deste cliente não permitem confirmar o saldo com segurança.",
    );
  }
  return client.availableCreditCents as MoneyCents;
}

/**
 * Production-only correction path for the current data model, which has no
 * production clientFinancial writer/aggregator. It reconstructs all orders for
 * the client transactionally, then overwrites the existing payment. Credit
 * reductions are blocked until all production financial writers participate
 * in the same authority/cutover protocol.
 */
export async function correctPaymentProductionTransaction(
  db: Firestore,
  command: ProductionCorrectPaymentCommand,
): Promise<ProductionPaymentCorrectionResult> {
  const orderRef = db.collection("orders").doc(command.orderId);
  const clientOrdersQuery = db.collection("orders")
    .where("clientId", "==", command.clientId)
    .limit(MAX_PRODUCTION_CLIENT_ORDERS_FOR_CORRECTION + 1);

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    const clientOrdersSnapshot = await transaction.get(clientOrdersQuery);

    if (!orderSnapshot.exists) {
      throw new FinancialApiError(409, "ORDER_NOT_FOUND", "Pedido não encontrado.");
    }
    const orderData = orderSnapshot.data();
    if (!orderData) throw financialStateError();
    if (orderData.clientId !== command.clientId) {
      throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e Cliente não correspondem.");
    }
    if (clientOrdersSnapshot.size > MAX_PRODUCTION_CLIENT_ORDERS_FOR_CORRECTION) {
      throw new FinancialApiError(
        409,
        "CLIENT_ORDER_LIMIT_EXCEEDED",
        "Há muitos Pedidos para validar esta correção com segurança.",
      );
    }

    const matchingOrderSnapshot = clientOrdersSnapshot.docs.find((document) => document.id === command.orderId);
    if (!matchingOrderSnapshot) {
      throw new FinancialApiError(409, "CLIENT_MISMATCH", "Pedido e Cliente não correspondem.");
    }

    const order = parseOrder(orderData);
    if (order.orderStatus === "cancelled") {
      throw new FinancialApiError(409, "ORDER_CANCELLED", "Pedido cancelado não aceita correção nesta etapa.");
    }
    if (order.payments === undefined) {
      throw new FinancialApiError(
        409,
        "LEGACY_PAYMENT_CORRECTION_REQUIRES_DECISION",
        "Correção de pagamento legado requer uma decisão aprovada.",
      );
    }

    const current = order.payments.find((payment) => payment.id === command.paymentId);
    if (!current) {
      throw new FinancialApiError(409, "PAYMENT_NOT_FOUND", "Pagamento não encontrado.");
    }

    const documentsBefore = clientOrdersSnapshot.docs.map((document) => (
      toReconciliationOrderDocument(document.id, document.data())
    ));
    const availableCreditBefore = requireConclusiveProductionClientCredit(documentsBefore, command.clientId);

    if (current.amountCents === command.amountCents && current.receivedAt === command.receivedAt) {
      return {
        paymentId: command.paymentId,
        currentAmountPaidCents: order.cashPaidCents,
        currentCreditGeneratedCents: order.creditGeneratedCents,
        currentAvailableCreditCents: availableCreditBefore,
        replayed: true,
      };
    }

    if (current.amountCents !== command.expectedAmountCents
      || current.receivedAt !== command.expectedReceivedAt) {
      throw new FinancialApiError(
        409,
        "PAYMENT_PRECONDITION_CHANGED",
        "O pagamento mudou; confirme novamente.",
      );
    }
    if (current.receivedAt !== null && command.receivedAt === null) {
      throw new FinancialApiError(
        409,
        "RECEIVED_AT_REMOVAL_REQUIRES_DECISION",
        "A remoção de uma data de recebimento conhecida não é permitida.",
      );
    }

    const nextPayments = order.payments.map((payment) => (
      payment.id === command.paymentId
        ? {
            id: payment.id,
            amountCents: command.amountCents as MoneyCents,
            receivedAt: command.receivedAt,
          }
        : payment
    ));
    const nextCashPaidCents = sumMoneyCents(nextPayments.map((payment) => payment.amountCents));
    const nextCreditGeneratedCents = calculateGeneratedCreditCents(
      order.totalCents,
      nextCashPaidCents,
      order.creditAppliedCents,
    );
    const storedNextPayments = nextPayments.map((payment) => ({
      id: payment.id,
      amount: moneyCentsToLegacyReais(payment.amountCents),
      receivedAt: payment.receivedAt,
    }));
    const nextOrderData: DocumentData = {
      ...orderData,
      payments: storedNextPayments,
      amountPaid: moneyCentsToLegacyReais(nextCashPaidCents),
    };
    if (nextCreditGeneratedCents > 0) {
      nextOrderData.creditGenerated = moneyCentsToLegacyReais(nextCreditGeneratedCents);
    } else {
      delete nextOrderData.creditGenerated;
    }

    const documentsAfter = clientOrdersSnapshot.docs.map((document) => (
      document.id === command.orderId
        ? toReconciliationOrderDocument(document.id, nextOrderData)
        : toReconciliationOrderDocument(document.id, document.data())
    ));
    const availableCreditAfter = requireConclusiveProductionClientCredit(documentsAfter, command.clientId);
    if (availableCreditAfter < availableCreditBefore) {
      throw new FinancialApiError(
        409,
        "PRODUCTION_CREDIT_REDUCTION_REQUIRES_CUTOVER",
        "A correção reduziria o crédito disponível. Esse ajuste depende da migração coordenada da autoridade financeira.",
      );
    }

    transaction.update(orderRef, {
      payments: storedNextPayments,
      amountPaid: moneyCentsToLegacyReais(nextCashPaidCents),
      ...(nextCreditGeneratedCents > 0
        ? { creditGenerated: moneyCentsToLegacyReais(nextCreditGeneratedCents) }
        : { creditGenerated: FieldValue.delete() }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      paymentId: command.paymentId,
      currentAmountPaidCents: nextCashPaidCents,
      currentCreditGeneratedCents: nextCreditGeneratedCents,
      currentAvailableCreditCents: availableCreditAfter,
      replayed: false,
    };
  });
}
