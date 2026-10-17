import type { Firestore, Query } from "firebase-admin/firestore";

import { reconcileFinancialDocuments } from "../../src/features/financial/reconciliation.js";
import type { ReconciliationOrderDocument } from "../../src/features/financial/reconciliation.js";
import { FinancialApiError } from "../_financial/errors.js";
import { confirmedTestOrderDeletionFixtures, testOrderDeletionConfirmation } from "../../src/features/orders/testOrderDeletion.js";
import type { ConfirmedTestOrderDeletionFixture } from "../../src/features/orders/testOrderDeletion.js";
import { legacyReaisToMoneyCents, sumMoneyCents } from "../../src/features/financial/money.js";

function blocked(code: string, message: string): never {
  throw new FinancialApiError(409, code, message);
}

async function hasAny(transaction: FirebaseFirestore.Transaction, query: Query): Promise<boolean> {
  return !(await transaction.get(query.limit(1))).empty;
}

export async function deleteCancelledOrder(db: Firestore, orderId: string): Promise<void> {
  const orderRef = db.collection("orders").doc(orderId);

  await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) blocked("ORDER_NOT_FOUND", "Pedido não encontrado.");
    const data = orderSnapshot.data();
    if (!data) blocked("ORDER_STATE_UNKNOWN", "Os dados do Pedido não puderam ser conferidos.");
    if (data.orderStatus !== "cancelled") blocked("ORDER_NOT_CANCELLED", "Somente Pedidos cancelados podem ser excluídos.");
    if (typeof data.clientId !== "string" || data.clientId.length === 0) {
      blocked("ORDER_CLIENT_UNKNOWN", "O Cliente associado ao Pedido não pôde ser confirmado.");
    }

    const clientOrdersSnapshot = await transaction.get(
      db.collection("orders").where("clientId", "==", data.clientId),
    );
    const aggregatorRef = db.collection("clientFinancial").doc(data.clientId);
    const aggregatorSnapshot = await transaction.get(aggregatorRef);
    const documents = clientOrdersSnapshot.docs.map((document) => ({
      id: document.id,
      ...(document.data() as Record<string, unknown>),
    })) as ReconciliationOrderDocument[];
    const reconciliation = reconcileFinancialDocuments(
      documents,
      aggregatorSnapshot.exists
        ? [{ clientId: data.clientId, ...(aggregatorSnapshot.data() as Record<string, unknown>) }]
        : [],
    );
    const clientFinance = reconciliation.clients.find((client) => client.clientId === data.clientId);
    const targetFinance = reconciliation.orders.find((order) => order.orderId === orderId);

    if (!targetFinance || !clientFinance?.conclusive || clientFinance.availableCreditCents !== 0
      || clientFinance.aggregatorComparison === "divergent"
      || (targetFinance.classification !== "VALID" && targetFinance.classification !== "LEGACY_COMPATIBLE")
      || !targetFinance.receiptsProjectable || !targetFinance.refundsProjectable) {
      blocked("ORDER_FINANCIALS_INCONCLUSIVE", "Os dados financeiros do Pedido ou o saldo de crédito do Cliente não podem ser reconciliados com segurança.");
    }

    if (targetFinance.cashPaidCents !== 0 || targetFinance.calculatedGeneratedCreditCents !== 0
      || (data.creditApplied ?? 0) !== 0 || (data.creditGenerated ?? 0) !== 0
      || (Array.isArray(data.refunds) && data.refunds.length > 0)) {
      blocked("ORDER_HAS_FINANCIAL_ACTIVITY", "O Pedido contém recebimentos, devoluções ou movimentação de crédito e precisa ser preservado.");
    }

    if (await hasAny(transaction, orderRef.collection("cancellationOperations"))) {
      blocked("ORDER_HAS_DEPENDENCIES", "O Pedido possui registros de operações de cancelamento que precisam ser preservados.");
    }
    const subcollections = await orderRef.listCollections();
    if (subcollections.some((collection) => collection.id !== "cancellationOperations")) {
      blocked("ORDER_HAS_DEPENDENCIES", "O Pedido possui registros dependentes que precisam ser preservados.");
    }
    transaction.delete(orderRef);
  });
}

export async function deleteInactiveClient(db: Firestore, clientId: string): Promise<void> {
  const clientRef = db.collection("clients").doc(clientId);
  const ordersQuery = db.collection("orders").where("clientId", "==", clientId);
  const tasksQuery = db.collection("tasks").where("clientId", "==", clientId);
  const addressesQuery = db.collection("addresses").where("clientId", "==", clientId);
  const financialRef = db.collection("clientFinancial").doc(clientId);

  await db.runTransaction(async (transaction) => {
    const clientSnapshot = await transaction.get(clientRef);
    if (!clientSnapshot.exists) blocked("CLIENT_NOT_FOUND", "Cliente não encontrado.");
    const client = clientSnapshot.data();
    if (!client) blocked("CLIENT_STATE_UNKNOWN", "Os dados do Cliente não puderam ser conferidos.");
    if (client.active !== false) blocked("CLIENT_ACTIVE", "Inative o Cliente antes de solicitar a exclusão definitiva.");

    const [hasOrders, hasTasks, hasAddresses, financialSnapshot] = await Promise.all([
      hasAny(transaction, ordersQuery),
      hasAny(transaction, tasksQuery),
      hasAny(transaction, addressesQuery),
      transaction.get(financialRef),
    ]);
    if (hasOrders || hasTasks || hasAddresses) {
      blocked("CLIENT_HAS_DEPENDENCIES", "O Cliente possui Pedidos, Tarefas ou Endereços vinculados. Preserve o histórico e mantenha o Cliente inativo.");
    }

    if (financialSnapshot.exists) {
      const financial = financialSnapshot.data();
      if (financial?.state !== "ready" || financial.availableCreditCents !== 0
        || !Number.isSafeInteger(financial.revision) || financial.revision < 0) {
        blocked("CLIENT_FINANCIAL_STATE_UNKNOWN", "O saldo financeiro do Cliente não pôde ser confirmado como zero.");
      }
      transaction.delete(financialRef);
    }

    if ((await clientRef.listCollections()).length > 0) {
      blocked("CLIENT_HAS_DEPENDENCIES", "O Cliente possui subcoleções que precisam ser preservadas.");
    }
    transaction.delete(clientRef);
  });
}

function isTestOrderData(id: string, data: Record<string, unknown>, fixtures: readonly ConfirmedTestOrderDeletionFixture[]): boolean {
  const fixture = fixtures.find((entry) => entry.id === id);
  if (!fixture || data.clientName !== "Cliente Teste"
    || typeof data.clientId !== "string"
    || typeof data.total !== "number" || typeof data.amountPaid !== "number"
    || (data.creditApplied !== undefined && data.creditApplied !== null && data.creditApplied !== 0)
    || (data.refunds !== undefined && (!Array.isArray(data.refunds) || data.refunds.length !== 0))) return false;
  try {
    if (legacyReaisToMoneyCents(data.total, "Total") !== fixture.totalCents) return false;
    const amountPaidCents = legacyReaisToMoneyCents(data.amountPaid, "Dinheiro recebido");
    const payments = data.payments;
    let cashPaidCents = amountPaidCents;
    if (payments !== undefined) {
      if (!Array.isArray(payments)) return false;
      cashPaidCents = payments.reduce((sum, payment: unknown) => {
        if (typeof payment !== "object" || payment === null || Array.isArray(payment)) throw new Error("Pagamento inválido.");
        const amount = (payment as Record<string, unknown>).amount;
        if (typeof amount !== "number") throw new Error("Pagamento inválido.");
        return sumMoneyCents([sum, legacyReaisToMoneyCents(amount, "Pagamento")]);
      }, sumMoneyCents([]));
    }
    if (cashPaidCents !== fixture.cashPaidCents || amountPaidCents !== fixture.cashPaidCents) return false;
    const rawCreditGenerated = data.creditGenerated;
    const creditGenerated = rawCreditGenerated == null
      ? 0
      : typeof rawCreditGenerated === "number"
        ? legacyReaisToMoneyCents(rawCreditGenerated, "Crédito gerado")
        : NaN;
    return creditGenerated === Math.max(fixture.cashPaidCents - fixture.totalCents, 0);
  } catch {
    return false;
  }
}

export async function deleteConfirmedTestOrder(
  db: Firestore,
  orderId: string,
  confirmation: string,
  fixtures: readonly ConfirmedTestOrderDeletionFixture[] = confirmedTestOrderDeletionFixtures,
): Promise<void> {
  if (confirmation !== testOrderDeletionConfirmation) {
    blocked("TEST_DATA_CONFIRMATION_REQUIRED", "Confirme explicitamente que este registro é um dado de teste.");
  }
  const orderRef = db.collection("orders").doc(orderId);
  await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) blocked("ORDER_NOT_FOUND", "Pedido não encontrado.");
    const data = orderSnapshot.data();
    if (!data || !isTestOrderData(orderId, data, fixtures)) {
      blocked("NOT_CONFIRMED_TEST_DATA", "O ID e os valores atuais não correspondem ao registro de teste confirmado.");
    }
    const clientOrdersSnapshot = await transaction.get(db.collection("orders").where("clientId", "==", data.clientId));
    if (!clientOrdersSnapshot.docs.every((document) => isTestOrderData(document.id, document.data() as Record<string, unknown>, fixtures))) {
      blocked("TEST_CLIENT_HAS_OTHER_ORDERS", "O Cliente possui Pedidos fora do conjunto de dados de teste confirmado.");
    }
    const clientRef = db.collection("clients").doc(data.clientId as string);
    const [clientSnapshot, aggregatorSnapshot] = await Promise.all([
      transaction.get(clientRef),
      transaction.get(db.collection("clientFinancial").doc(data.clientId as string)),
    ]);
    if (!clientSnapshot.exists || clientSnapshot.data()?.name !== "Cliente Teste") {
      blocked("TEST_CLIENT_MISMATCH", "O Cliente associado não corresponde ao Cliente Teste confirmado.");
    }
    if (aggregatorSnapshot.exists) {
      const aggregator = aggregatorSnapshot.data();
      if (aggregator?.state !== "ready" || aggregator.availableCreditCents !== 0
        || !Number.isSafeInteger(aggregator.revision) || aggregator.revision < 0) {
        blocked("CLIENT_FINANCIAL_STATE_UNKNOWN", "O saldo financeiro do Cliente Teste não pode ser confirmado como zero.");
      }
    }
    const subcollections = await orderRef.listCollections();
    if (subcollections.some((collection) => collection.id !== "cancellationOperations")) {
      blocked("ORDER_HAS_DEPENDENCIES", "O Pedido possui registros dependentes que precisam ser preservados.");
    }
    for (const collection of subcollections) {
      const operationDocuments = await transaction.get(collection.limit(500));
      if (operationDocuments.size === 500) {
        blocked("ORDER_HAS_DEPENDENCIES", "O Pedido possui registros dependentes demais para uma exclusão segura.");
      }
      operationDocuments.docs.forEach((document) => transaction.delete(document.ref));
    }
    transaction.delete(orderRef);
  });
}
