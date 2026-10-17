import { Timestamp, type DocumentReference, type Firestore, type Query } from "firebase-admin/firestore";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isTestOrderData(id: string, data: Record<string, unknown>, fixtures: readonly ConfirmedTestOrderDeletionFixture[]): boolean {
  const fixture = fixtures.find((entry) => entry.id === id);
  if (!fixture || data.orderStatus !== "cancelled" || data.clientName !== "Cliente Teste"
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

function testOrderNetCreditCents(
  data: Record<string, unknown>,
  fixture: ConfirmedTestOrderDeletionFixture,
): number {
  const generatedCents = Math.max(fixture.cashPaidCents - fixture.totalCents, 0);
  const agreement = data.cancellationAgreement;
  if (!isRecord(agreement) || !isRecord(agreement.creditDecision)) return generatedCents;
  const { appliedRestoredCents, generatedRetainedCents } = agreement.creditDecision;
  if (!Number.isSafeInteger(appliedRestoredCents) || appliedRestoredCents !== 0
    || !Number.isSafeInteger(generatedRetainedCents) || (generatedRetainedCents as number) > generatedCents) {
    blocked("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE", "A projeção financeira não pode ser atribuída com segurança ao conjunto fictício.");
  }
  return generatedRetainedCents as number;
}

function isOrderOperationDocument(data: Record<string, unknown>): boolean {
  return hasOnlyKeys(data, ["fingerprint"])
    && typeof data.fingerprint === "string"
    && /^[a-f0-9]{64}$/i.test(data.fingerprint);
}

function isClientFinancialOperationDocument(
  id: string,
  data: Record<string, unknown>,
  clientId: string,
  fixtureIds: ReadonlySet<string>,
): boolean {
  if (!hasOnlyKeys(data, ["fingerprint", "result", "actorUid", "createdAt"])
    || typeof data.fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(data.fingerprint)
    || typeof data.actorUid !== "string" || !(data.createdAt instanceof Timestamp)
    || !isRecord(data.result)) return false;
  const result = data.result;
  return hasOnlyKeys(result, ["operationId", "clientId", "orderId", "appliedCents", "availableCreditCents", "revision"])
    && result.operationId === id
    && result.clientId === clientId
    && typeof result.orderId === "string" && fixtureIds.has(result.orderId)
    && [result.appliedCents, result.availableCreditCents, result.revision]
      .every((value) => Number.isSafeInteger(value) && (value as number) >= 0);
}

type PendingDeletion = {
  ref: DocumentReference;
};

export async function deleteConfirmedTestOrderSet(
  db: Firestore,
  requestedOrderId: string,
  confirmation: string,
  fixtures: readonly ConfirmedTestOrderDeletionFixture[] = confirmedTestOrderDeletionFixtures,
): Promise<void> {
  if (confirmation !== testOrderDeletionConfirmation) {
    blocked("TEST_DATA_CONFIRMATION_REQUIRED", "Confirme explicitamente que este registro é um dado de teste.");
  }
  if (fixtures.length !== 3 || !fixtures.some((fixture) => fixture.id === requestedOrderId)) {
    blocked("NOT_CONFIRMED_TEST_DATA", "O ID não pertence ao conjunto de dados fictícios confirmado.");
  }
  const fixtureIds = new Set(fixtures.map((fixture) => fixture.id));
  const orderRefs = fixtures.map((fixture) => db.collection("orders").doc(fixture.id));
  await db.runTransaction(async (transaction) => {
    const orderSnapshots = await transaction.getAll(...orderRefs);
    if (orderSnapshots.some((snapshot) => !snapshot.exists)) {
      blocked("TEST_DATA_SET_INCOMPLETE", "Os três Pedidos fictícios precisam estar presentes para uma limpeza atômica.");
    }
    const orders = orderSnapshots.map((snapshot, index) => ({
      id: fixtures[index]!.id,
      data: snapshot.data() as Record<string, unknown>,
    }));
    const activeOrder = orders.find(({ data }) => data.orderStatus !== "cancelled");
    if (activeOrder) {
      blocked("TEST_DATA_NOT_CANCELLED", "A limpeza do conjunto exige que os três Pedidos estejam cancelados.");
    }
    if (orders.some(({ id, data }) => !isTestOrderData(id, data, fixtures))) {
      blocked("NOT_CONFIRMED_TEST_DATA", "Os IDs e valores atuais não correspondem ao conjunto de dados fictícios confirmado.");
    }
    const clientId = orders[0]!.data.clientId as string;
    if (orders.some(({ data }) => data.clientId !== clientId)) {
      blocked("TEST_CLIENT_MISMATCH", "Os três Pedidos não pertencem ao mesmo Cliente Teste.");
    }
    const clientOrdersSnapshot = await transaction.get(db.collection("orders").where("clientId", "==", clientId));
    if (clientOrdersSnapshot.size !== fixtures.length
      || !clientOrdersSnapshot.docs.every((document) => fixtureIds.has(document.id))) {
      blocked("TEST_CLIENT_HAS_OTHER_ORDERS", "O Cliente possui Pedidos fora do conjunto de dados de teste confirmado.");
    }
    const clientRef = db.collection("clients").doc(clientId);
    const aggregatorRef = db.collection("clientFinancial").doc(clientId);
    const [clientSnapshot, aggregatorSnapshot] = await Promise.all([
      transaction.get(clientRef),
      transaction.get(aggregatorRef),
    ]);
    if (!clientSnapshot.exists || clientSnapshot.data()?.name !== "Cliente Teste") {
      blocked("TEST_CLIENT_MISMATCH", "O Cliente associado não corresponde ao Cliente Teste confirmado.");
    }

    const orderSubcollections = await Promise.all(orderRefs.map((ref) => ref.listCollections()));
    const pendingDeletions: PendingDeletion[] = [];
    const orderSubcollectionReads: Array<Promise<FirebaseFirestore.QuerySnapshot>> = [];
    for (const collections of orderSubcollections) {
      for (const collection of collections) {
        if (collection.id !== "cancellationOperations" && collection.id !== "transferOperations") {
          blocked("TEST_DATA_DEPENDENCY_UNATTRIBUTABLE", "Há dependências de Pedido cuja origem não pode ser atribuída ao conjunto fictício.");
        }
        orderSubcollectionReads.push(transaction.get(collection.limit(501)).then((snapshot) => {
          if (snapshot.size > 500 || snapshot.docs.some((document) => !isOrderOperationDocument(document.data()))) {
            blocked("TEST_DATA_DEPENDENCY_UNATTRIBUTABLE", "Há operações de Pedido que não podem ser atribuídas ao conjunto fictício.");
          }
          pendingDeletions.push(...snapshot.docs.map((document) => ({ ref: document.ref })));
          return snapshot;
        }));
      }
    }
    const aggregatorSubcollections = aggregatorSnapshot.exists ? await aggregatorRef.listCollections() : [];
    let financialOperationRead: Promise<FirebaseFirestore.QuerySnapshot> | null = null;
    if (aggregatorSubcollections.some((collection) => collection.id !== "operations")) {
      blocked("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE", "A projeção financeira possui dependências cuja origem não pode ser atribuída ao conjunto fictício.");
    }
    const operationsCollection = aggregatorSubcollections.find((collection) => collection.id === "operations");
    if (operationsCollection) {
      financialOperationRead = transaction.get(operationsCollection.limit(501)).then((snapshot) => {
        if (snapshot.size > 500 || snapshot.docs.some((document) => !isClientFinancialOperationDocument(
          document.id,
          document.data(),
          clientId,
          fixtureIds,
        ))) {
          blocked("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE", "Há movimentações do agregador que não podem ser atribuídas ao conjunto fictício.");
        }
        pendingDeletions.push(...snapshot.docs.map((document) => ({ ref: document.ref })));
        return snapshot;
      });
    }
    await Promise.all([...orderSubcollectionReads, ...(financialOperationRead ? [financialOperationRead] : [])]);
    const nestedSubcollections = await Promise.all(pendingDeletions.map(({ ref }) => ref.listCollections()));
    if (nestedSubcollections.some((collections) => collections.length > 0)) {
      blocked("TEST_DATA_DEPENDENCY_UNATTRIBUTABLE", "Uma dependência possui subcoleções que não podem ser removidas com segurança.");
    }

    if (aggregatorSnapshot.exists) {
      const aggregator = aggregatorSnapshot.data();
      if (!aggregator || !hasOnlyKeys(aggregator, ["state", "availableCreditCents", "revision", "updatedAt"])
        || aggregator.state !== "ready"
        || !Number.isSafeInteger(aggregator.availableCreditCents) || (aggregator.availableCreditCents as number) < 0
        || !Number.isSafeInteger(aggregator.revision) || (aggregator.revision as number) < 0
        || (aggregator.updatedAt !== undefined && !(aggregator.updatedAt instanceof Timestamp))) {
        blocked("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE", "O estado do agregador financeiro não pode ser atribuído ao conjunto fictício.");
      }
      const rawNet = orders.reduce((sum, order) => sum + testOrderNetCreditCents(
        order.data,
        fixtures.find((fixture) => fixture.id === order.id)!,
      ), 0);
      const reconciled = reconcileFinancialDocuments(orders.map((order) => ({ id: order.id, ...order.data } as ReconciliationOrderDocument)));
      const reconciledBalance = reconciled.clients.find((client) => client.clientId === clientId)?.availableCreditCents;
      const attributableBalances = new Set([0, rawNet]);
      if (reconciled.clients.find((client) => client.clientId === clientId)?.conclusive
        && typeof reconciledBalance === "number") attributableBalances.add(reconciledBalance);
      if (!attributableBalances.has(aggregator.availableCreditCents as number)) {
        blocked("TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE", "O saldo do agregador não corresponde a uma projeção possível dos três Pedidos fictícios.");
      }
    }

    if (pendingDeletions.length + orderRefs.length + Number(aggregatorSnapshot.exists) > 500) {
      blocked("TEST_DATA_CLEANUP_TOO_LARGE", "O conjunto possui dependências demais para uma exclusão atômica segura.");
    }
    pendingDeletions.forEach(({ ref }) => transaction.delete(ref));
    orderRefs.forEach((ref) => transaction.delete(ref));
    if (aggregatorSnapshot.exists) transaction.delete(aggregatorRef);
  });
}
