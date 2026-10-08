import type { Product } from "../products/productTypes";
import type { Order, OrderItem, OrderPayment, OrderStatus, PaymentStatus } from "./orderTypes";

export type OrderBalanceType = "remaining" | "credit" | "settled";

interface FirestoreTimestampLike {
  seconds?: unknown;
  nanoseconds?: unknown;
  toMillis?: () => unknown;
}

function getTimestampMillis(value: unknown) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const timestamp = value as FirestoreTimestampLike;

  if (typeof timestamp.toMillis === "function") {
    try {
      const millis = timestamp.toMillis();

      if (typeof millis === "number" && Number.isFinite(millis)) {
        return millis;
      }
    } catch {
      return null;
    }
  }

  if (typeof timestamp.seconds !== "number" || !Number.isFinite(timestamp.seconds)) {
    return null;
  }

  const nanoseconds = typeof timestamp.nanoseconds === "number" && Number.isFinite(timestamp.nanoseconds)
    ? timestamp.nanoseconds
    : 0;
  const millis = timestamp.seconds * 1000 + nanoseconds / 1_000_000;

  return Number.isFinite(millis) ? millis : null;
}

export function compareOrderCreationDesc(
  firstOrder: Pick<Order, "id" | "createdAt">,
  secondOrder: Pick<Order, "id" | "createdAt">,
) {
  const firstCreatedAt = getTimestampMillis(firstOrder.createdAt);
  const secondCreatedAt = getTimestampMillis(secondOrder.createdAt);

  if (firstCreatedAt === null && secondCreatedAt !== null) {
    return 1;
  }

  if (firstCreatedAt !== null && secondCreatedAt === null) {
    return -1;
  }

  if (firstCreatedAt !== null && secondCreatedAt !== null && firstCreatedAt !== secondCreatedAt) {
    return secondCreatedAt - firstCreatedAt;
  }

  return secondOrder.id.localeCompare(firstOrder.id);
}

export function calculateOrderSubtotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.total, 0);
}

export function getOrderItemProductName(
  item: Pick<OrderItem, "productId" | "productName">,
  products: Array<Pick<Product, "id" | "name">>,
) {
  return products.find((product) => product.id === item.productId)?.name ?? item.productName;
}

export function calculateOrderTotal(items: OrderItem[], deliveryFee: number) {
  return calculateOrderSubtotal(items) + deliveryFee;
}

export function getOrderGeneratedCreditAmount(
  order: Pick<Order, "total" | "amountPaid" | "payments"> & {
    creditApplied?: number | null;
  },
) {
  return Math.max(getOrderEffectivePaid(order) - order.total, 0);
}

export function getOrderBalance(
  order: Pick<Order, "total" | "amountPaid" | "payments"> & {
    creditApplied?: number | null;
  },
) {
  return order.total - getOrderEffectivePaid(order);
}
export function getOrderBalanceInfo(
  order: Pick<Order, "total" | "amountPaid" | "payments"> & {
    creditApplied?: number | null;
  },
): {
  type: OrderBalanceType;
  label: string;
  amount: number;
  rawBalance: number;
} {
  const rawBalance = getOrderBalance(order);

  if (rawBalance > 0) {
    return {
      type: "remaining",
      label: "Restante",
      amount: rawBalance,
      rawBalance,
    };
  }

  if (rawBalance < 0) {
    return {
      type: "credit",
      label: "Crédito gerado",
      amount: Math.abs(rawBalance),
      rawBalance,
    };
  }

  return {
    type: "settled",
    label: "Quitado",
    amount: 0,
    rawBalance,
  };
}

export function getClientAvailableCredit(orders: Order[], clientId: string, ignoredOrderId?: string) {
  const clientOrders = orders.filter((order) => order.clientId === clientId && order.id !== ignoredOrderId && order.orderStatus !== "cancelled");

  const generatedCredit = clientOrders.reduce((sum, order) => sum + getOrderGeneratedCreditAmount(order), 0);

  const appliedCredit = clientOrders.reduce((sum, order) => sum + (order.creditApplied ?? 0), 0);

  return Math.max(generatedCredit - appliedCredit, 0);
}

export function getAutomaticCreditApplied(availableCredit: number, orderTotal: number) {
  return Math.min(availableCredit, orderTotal);
}

export function getOrderEffectivePaid(
  order: Pick<Order, "amountPaid" | "payments"> & {
    creditApplied?: number | null;
  },
) {
  return getOrderCashPaid(order) + (order.creditApplied ?? 0);
}

export function getPaymentStatus(
  order: Pick<Order, "total" | "amountPaid" | "payments"> & {
    creditApplied?: number | null;
  },
): PaymentStatus {
  const effectivePaid = getOrderEffectivePaid(order);

  if (effectivePaid <= 0) {
    return "unpaid";
  }

  if (effectivePaid < order.total) {
    return "partial";
  }

  return "paid";
}

export function getOrderCashPaid(order: Pick<Order, "amountPaid" | "payments">) {
  if (order.payments !== undefined) {
    return order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  return order.amountPaid;
}

export function getOrderPaymentHistory(order: Pick<Order, "id" | "amountPaid" | "payments">): OrderPayment[] {
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

export function getPaymentStatusLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    unpaid: "A pagar",
    partial: "Parcial",
    paid: "Pago",
  };

  return labels[status];
}

export function getOrderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    active: "Ativo",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  return labels[status];
}

export function formatDateTimeBR(value: string) {
  if (!value) return "Sem data";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
