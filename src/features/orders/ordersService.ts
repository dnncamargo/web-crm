import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../../services/firebase";
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
