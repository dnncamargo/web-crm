import { reconcileFinancialDocuments } from "../financial/reconciliation";
import type { Order } from "./orderTypes";

export function getCancelledOrderDeletionBlockReason(order: Order, orders: Order[]): string | null {
  if (order.orderStatus !== "cancelled") return "Somente Pedidos cancelados podem ser excluídos.";

  const relevantOrders = orders.filter((entry) => entry.clientId === order.clientId);
  const reconciliation = reconcileFinancialDocuments(relevantOrders);
  const target = reconciliation.orders.find((entry) => entry.orderId === order.id);
  const client = reconciliation.clients.find((entry) => entry.clientId === order.clientId);
  if (!target || !client?.conclusive || client.availableCreditCents !== 0
    || (target.classification !== "VALID" && target.classification !== "LEGACY_COMPATIBLE")
    || !target.receiptsProjectable || !target.refundsProjectable) {
    return "Os dados financeiros ou o saldo de crédito não podem ser reconciliados. Preserve o Pedido para revisão.";
  }
  if (target.cashPaidCents !== 0 || target.calculatedGeneratedCreditCents !== 0
    || (order.creditApplied ?? 0) !== 0 || (order.creditGenerated ?? 0) !== 0
    || (order.refunds?.length ?? 0) > 0) {
    return "O Pedido possui recebimentos, devoluções ou movimentação de crédito e precisa ser preservado.";
  }
  return null;
}
