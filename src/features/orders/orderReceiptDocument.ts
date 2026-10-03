import { formatCurrencyBR } from "../../utils/money";
import type { Product } from "../products/productTypes";
import type { Order } from "./orderTypes";
import {
  formatDateTimeBR,
  getOrderBalanceInfo,
  getOrderGeneratedCreditAmount,
  getOrderItemProductName,
} from "./orderUtils";

export interface OrderReceiptSummaryRow {
  label: string;
  value: string;
}

export interface OrderReceiptDocument {
  title: "Pedido";
  deliveryDateTime: string;
  customerName: string;
  fulfillment:
    | {
        type: "delivery";
        lines: string[];
      }
    | {
        type: "pickup";
        label: "Retirada pelo cliente";
      };
  items: Array<{
    id: string;
    name: string;
    total: string;
    details: string;
    notes?: string;
  }>;
  summary: {
    rows: OrderReceiptSummaryRow[];
    settled: boolean;
    creditGenerated?: OrderReceiptSummaryRow;
    total: string;
  };
}

function getAddressLines(address: NonNullable<Order["addressSnapshot"]>) {
  const street = `${address.street}${address.number ? `, ${address.number}` : ""}`;
  const neighborhood = [address.complement, address.neighborhood].filter(Boolean).join(" · ");
  const city = [address.city, address.state].filter(Boolean).join("/");

  return [street, neighborhood, city, address.reference ? `Referência: ${address.reference}` : null].filter(
    (line): line is string => Boolean(line),
  );
}

export function createOrderReceiptDocument(order: Order, products: Product[]): OrderReceiptDocument {
  const balanceInfo = getOrderBalanceInfo(order);
  const creditApplied = order.creditApplied ?? 0;
  const creditGenerated = getOrderGeneratedCreditAmount(order);
  const rows: OrderReceiptSummaryRow[] = [
    { label: "Subtotal", value: formatCurrencyBR(order.subtotal) },
  ];

  if (order.deliveryFee > 0) {
    rows.push({ label: "Entrega", value: formatCurrencyBR(order.deliveryFee) });
  }

  rows.push({ label: "Pago", value: formatCurrencyBR(order.amountPaid) });

  if (creditApplied > 0) {
    rows.push({ label: "Crédito usado", value: formatCurrencyBR(creditApplied) });
  }

  if (balanceInfo.type === "remaining") {
    rows.push({ label: "Restante", value: formatCurrencyBR(balanceInfo.amount) });
  }

  return {
    title: "Pedido",
    deliveryDateTime: formatDateTimeBR(order.deliveryDateTime),
    customerName: order.clientName,
    fulfillment: order.addressSnapshot
      ? { type: "delivery", lines: getAddressLines(order.addressSnapshot) }
      : { type: "pickup", label: "Retirada pelo cliente" },
    items: order.items.map((item) => ({
      id: item.id,
      name: getOrderItemProductName(item, products),
      total: formatCurrencyBR(item.total),
      details: `${item.quantity}${item.unit ? ` ${item.unit}` : ""} × ${formatCurrencyBR(item.unitPrice)}`,
      ...(item.notes?.trim() ? { notes: item.notes } : {}),
    })),
    summary: {
      rows,
      settled: balanceInfo.type !== "remaining",
      ...(creditGenerated > 0
        ? { creditGenerated: { label: "Crédito gerado", value: formatCurrencyBR(creditGenerated) } }
        : {}),
      total: formatCurrencyBR(order.total),
    },
  };
}
