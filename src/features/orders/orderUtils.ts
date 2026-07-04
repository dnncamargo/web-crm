import type { Order, OrderItem, OrderStatus, PaymentStatus } from "./orderTypes";

export type OrderBalanceType = "remaining" | "credit" | "settled";

export function calculateOrderSubtotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.total, 0);
}

export function calculateOrderTotal(items: OrderItem[], deliveryFee: number) {
  return calculateOrderSubtotal(items) + deliveryFee;
}

export function getOrderGeneratedCreditAmount(
  order: Pick<Order, "total" | "amountPaid"> & {
    creditApplied?: number | null;
    creditGenerated?: number | null;
  },
) {
  if (order.creditGenerated !== undefined && order.creditGenerated !== null) {
    return order.creditGenerated;
  }

  return Math.max(getOrderEffectivePaid(order) - order.total, 0);
}

export function getOrderBalance(
  order: Pick<Order, "total" | "amountPaid"> & {
    creditApplied?: number | null;
  },
) {
  return order.total - getOrderEffectivePaid(order);
}
export function getOrderBalanceInfo(
  order: Pick<Order, "total" | "amountPaid"> & {
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
  order: Pick<Order, "amountPaid"> & {
    creditApplied?: number | null;
  },
) {
  return order.amountPaid + (order.creditApplied ?? 0);
}

export function getPaymentStatus(
  order: Pick<Order, "total" | "amountPaid"> & {
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
