import type { Order, OrderItem, OrderStatus, PaymentStatus } from "./orderTypes";

export function calculateOrderSubtotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.total, 0);
}

export function calculateOrderTotal(items: OrderItem[], deliveryFee: number) {
  return calculateOrderSubtotal(items) + deliveryFee;
}

export function getPaymentStatus(order: Pick<Order, "total" | "amountPaid">): PaymentStatus {
  if (order.amountPaid <= 0) {
    return "unpaid";
  }

  if (order.amountPaid < order.total) {
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
  if (!value) {
    return "Sem data";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}