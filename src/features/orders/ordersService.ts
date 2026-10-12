import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "../../services/firebase";
import { isLocalFinancialPaymentCorrectionEnabled } from "./financialPaymentCorrectionEnvironment";
import { legacyReaisToMoneyCents } from "../financial/money";
import type { NewOrderData, Order, OrderPayment, UpdateOrderData } from "./orderTypes";
import { getOrderCashPaid } from "./orderUtils";

const ordersCollection = collection(db, "orders");

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields) as T;
  }

  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}

export function listenOrders(
  onChange: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const ordersQuery = query(
    ordersCollection,
    orderBy("deliveryDateTime", "asc")
  );

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Order[];

      onChange(orders);
    },
    onError
  );
}

export async function createOrder(data: NewOrderData) {
  const payments = data.payments ?? [];
  const cleanedData = removeUndefinedFields({
    ...data,
    payments,
    amountPaid: getOrderCashPaid({ amountPaid: data.amountPaid, payments }),
    creditApplied:
      data.creditApplied && data.creditApplied > 0
        ? data.creditApplied
        : undefined,
    creditGenerated:
      data.creditGenerated && data.creditGenerated > 0
        ? data.creditGenerated
        : undefined,
  });

  return addDoc(ordersCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export interface RegisterOrderPaymentInput {
  amount: number;
  receivedAt: string;
}

export interface CorrectOrderPaymentInput {
  amount: number;
  receivedAt: string | null;
}

interface FinancialApiErrorResponse {
  error?: { code?: unknown };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPaymentCorrectionError(code: unknown) {
  if (code === "AGGREGATOR_UNAVAILABLE") return "O saldo financeiro ainda não está disponível no ambiente local.";
  if (code === "AGGREGATOR_REVISION_CHANGED" || code === "CREDIT_BALANCE_CHANGED") return "O saldo ou a revisão financeira mudou. Reabra a correção para conferir os dados atuais.";
  if (code === "PAYMENT_PRECONDITION_CHANGED") return "Este recebimento foi alterado por outra operação. Reabra a correção para conferir os dados atuais.";
  if (code === "ORDER_CANCELLED") return "Pedidos cancelados não aceitam correção de recebimentos.";
  if (code === "LEGACY_PAYMENT_CORRECTION_REQUIRES_DECISION" || code === "PAYMENT_NOT_FOUND") return "Este recebimento não possui uma identidade persistida corrigível.";
  if (code === "RECEIVED_AT_REMOVAL_REQUIRES_DECISION") return "Uma data conhecida não pode ser apagada. Informe a data correta do recebimento.";
  if (code === "RETROACTIVE_CREDIT_REDUCTION_NOT_COVERED") return "A correção reduziria um crédito que já foi usado. O saldo atual não cobre essa redução.";
  if (code === "INVALID_FINANCIAL_STATE") return "Os dados financeiros do Pedido estão inconsistentes e precisam ser revisados.";
  if (code === "ORDER_NOT_FOUND" || code === "CLIENT_MISMATCH") return "O Pedido ou o vínculo financeiro mudou. Reabra os detalhes e confira os dados.";
  if (code === "FINANCIAL_OPERATION_DISABLED") return "A correção só está disponível com a API financeira conectada aos Emulators locais.";
  if (code === "UNAUTHENTICATED" || code === "FORBIDDEN") return "A sessão local não está autenticada ou não está autorizada para a operação.";
  return "Não foi possível corrigir o recebimento. Tente novamente mais tarde.";
}

export async function isLocalPaymentCorrectionApiReady() {
  if (!isLocalFinancialPaymentCorrectionEnabled()) return false;
  try {
    const response = await fetch("/api/financial/correct-payment");
    return response.status === 204;
  } catch {
    return false;
  }
}

export async function correctOrderPayment(
  order: Order,
  payment: OrderPayment,
  input: CorrectOrderPaymentInput,
) {
  if (!isLocalFinancialPaymentCorrectionEnabled()) {
    throw new Error("A correção de recebimentos está disponível somente no ambiente Emulator local autorizado.");
  }
  if (order.orderStatus === "cancelled") {
    throw new Error("Pedidos cancelados não aceitam correção de recebimentos.");
  }
  if (order.payments === undefined || !order.payments.some((entry) => entry.id === payment.id)) {
    throw new Error("Este recebimento não possui uma identidade persistida corrigível.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Entre novamente no ambiente local autorizado para corrigir recebimentos.");

  const aggregatorSnapshot = await getDoc(doc(db, "clientFinancial", order.clientId));
  const aggregator: unknown = aggregatorSnapshot.data();
  if (!aggregatorSnapshot.exists() || !isRecord(aggregator) || aggregator.state !== "ready"
    || !Number.isSafeInteger(aggregator.availableCreditCents)
    || (aggregator.availableCreditCents as number) < 0
    || !Number.isSafeInteger(aggregator.revision)
    || (aggregator.revision as number) < 0) {
    throw new Error("O agregador financeiro local não está pronto. Nenhuma correção foi enviada.");
  }

  const token = await currentUser.getIdToken();
  const response = await fetch("/api/financial/correct-payment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: order.id,
      clientId: order.clientId,
      paymentId: payment.id,
      expectedAmountCents: legacyReaisToMoneyCents(payment.amount, "Valor atual do recebimento"),
      expectedReceivedAt: payment.receivedAt,
      amountCents: legacyReaisToMoneyCents(input.amount, "Novo valor do recebimento"),
      receivedAt: input.receivedAt,
      presentedAvailableCreditCents: aggregator.availableCreditCents,
      presentedRevision: aggregator.revision,
    }),
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error("A API financeira local não foi encontrada. Inicie o servidor local que atende /api antes de corrigir.");
    const body = await response.json().catch((): FinancialApiErrorResponse => ({}));
    throw new Error(getPaymentCorrectionError(isRecord(body) && isRecord(body.error) ? body.error.code : undefined));
  }
}

function assertValidPaymentInput(input: RegisterOrderPaymentInput) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("O valor do pagamento deve ser maior que zero.");
  }

  if (!input.receivedAt || Number.isNaN(new Date(input.receivedAt).getTime())) {
    throw new Error("A data e hora do recebimento são inválidas.");
  }
}

function createPaymentId() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `payment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function materializeLegacyPayments(order: Order): OrderPayment[] {
  if (order.payments !== undefined) {
    return order.payments;
  }

  if (order.amountPaid <= 0) {
    return [];
  }

  return [{
    id: `legacy-${order.id}`,
    amount: order.amountPaid,
    receivedAt: null,
  }];
}

export async function registerOrderPayment(orderId: string, input: RegisterOrderPaymentInput) {
  assertValidPaymentInput(input);

  const orderRef = doc(db, "orders", orderId);
  const paymentId = createPaymentId();

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);

    if (!snapshot.exists()) {
      throw new Error("Pedido não encontrado.");
    }

    const order = { id: snapshot.id, ...snapshot.data() } as Order;

    if (order.orderStatus === "cancelled") {
      throw new Error("Pedidos cancelados não podem receber novos pagamentos.");
    }

    const payments = [
      ...materializeLegacyPayments(order),
      { id: paymentId, amount: input.amount, receivedAt: input.receivedAt },
    ];
    const cashPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const effectivePaid = cashPaid + (order.creditApplied ?? 0);
    const creditGenerated = Math.max(effectivePaid - order.total, 0);

    transaction.update(orderRef, {
      payments,
      amountPaid: cashPaid,
      ...(creditGenerated > 0 ? { creditGenerated } : { creditGenerated: deleteField() }),
      updatedAt: serverTimestamp(),
    });

    return {
      ...order,
      payments,
      amountPaid: cashPaid,
      creditGenerated: creditGenerated > 0 ? creditGenerated : null,
    };
  });
}

export async function updateOrder(orderId: string, data: UpdateOrderData) {
  const orderRef = doc(db, "orders", orderId);
  const protectedFinancialFields = new Set(["payments", "amountPaid", "creditGenerated"]);
  const editableData = Object.fromEntries(
    Object.entries(data).filter(([key]) => !protectedFinancialFields.has(key)),
  ) as Omit<UpdateOrderData, "payments" | "amountPaid" | "creditGenerated">;
  const cleanedData = removeUndefinedFields(editableData);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(orderRef);

    if (!snapshot.exists()) {
      throw new Error("Pedido não encontrado.");
    }

    const currentOrder = { id: snapshot.id, ...snapshot.data() } as Order;
    const currentCashPaid = getOrderCashPaid(currentOrder);
    const resultingTotal = data.total ?? currentOrder.total;
    const resultingCreditApplied = data.creditApplied === undefined
      ? currentOrder.creditApplied ?? 0
      : data.creditApplied ?? 0;
    const creditGenerated = Math.max(currentCashPaid + resultingCreditApplied - resultingTotal, 0);
    const creditAppliedUpdate = data.creditApplied === undefined
      ? {}
      : data.creditApplied === null
        ? { creditApplied: deleteField() }
        : { creditApplied: data.creditApplied };

    transaction.update(orderRef, {
      ...cleanedData,
      ...creditAppliedUpdate,
      amountPaid: currentCashPaid,
      ...(creditGenerated > 0 ? { creditGenerated } : { creditGenerated: deleteField() }),
      updatedAt: serverTimestamp(),
    });
  });
}
