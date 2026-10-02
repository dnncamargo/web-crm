import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderBalanceInfo,
  getOrderGeneratedCreditAmount,
  getOrderItemProductName,
} from "../orderUtils";

interface OrderReceiptProps {
  order: Order;
  products: Product[];
}

function getAddressLines(address: NonNullable<Order["addressSnapshot"]>) {
  const street = `${address.street}${address.number ? `, ${address.number}` : ""}`;
  const neighborhood = [address.complement, address.neighborhood].filter(Boolean).join(" · ");
  const city = [address.city, address.state].filter(Boolean).join("/");

  return [street, neighborhood, city, address.reference ? `Referência: ${address.reference}` : null].filter(Boolean);
}

export function OrderReceipt({ order, products }: OrderReceiptProps) {
  const balanceInfo = getOrderBalanceInfo(order);
  const creditApplied = order.creditApplied ?? 0;
  const creditGenerated = getOrderGeneratedCreditAmount(order);
  const addressLines = order.addressSnapshot ? getAddressLines(order.addressSnapshot) : [];

  return (
    <article className="receipt-paper" aria-label="Prévia do recibo do pedido">
      <header className="receipt-header">
        <h1>Pedido</h1>
        <p>Entrega: {formatDateTimeBR(order.deliveryDateTime)}</p>
      </header>

      <section className="receipt-section receipt-customer">
        <p>
          Cliente: <strong>{order.clientName}</strong>
        </p>
        <div className="receipt-address">
          <strong>Entrega</strong>
          {order.addressSnapshot ? (
            addressLines.map((line) => <p key={line}>{line}</p>)
          ) : (
            <p>Retirada pelo cliente</p>
          )}
        </div>
      </section>

      <section className="receipt-section">
        <h2>Itens</h2>
        <div className="receipt-items">
          {order.items.map((item) => (
            <article className="receipt-item" key={item.id}>
              <div className="receipt-item-header">
                <h3>{getOrderItemProductName(item, products)}</h3>
                <strong>{formatCurrencyBR(item.total)}</strong>
              </div>
              <p className="receipt-item-meta">
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""} × {formatCurrencyBR(item.unitPrice)}
              </p>
              {item.notes?.trim() && <p className="receipt-item-notes">{item.notes}</p>}
            </article>
          ))}
        </div>
      </section>

      <section className="receipt-section receipt-summary">
        <h2>Resumo</h2>
        <div className="receipt-summary-row">
          <span>Subtotal</span>
          <strong>{formatCurrencyBR(order.subtotal)}</strong>
        </div>
        {order.deliveryFee > 0 && (
          <div className="receipt-summary-row">
            <span>Entrega</span>
            <strong>{formatCurrencyBR(order.deliveryFee)}</strong>
          </div>
        )}
        <div className="receipt-summary-row">
          <span>Pago</span>
          <strong>{formatCurrencyBR(order.amountPaid)}</strong>
        </div>
        {creditApplied > 0 && (
          <div className="receipt-summary-row">
            <span>Crédito usado</span>
            <strong>{formatCurrencyBR(creditApplied)}</strong>
          </div>
        )}
        {balanceInfo.type === "remaining" && (
          <div className="receipt-summary-row">
            <span>Restante</span>
            <strong>{formatCurrencyBR(balanceInfo.amount)}</strong>
          </div>
        )}
        {balanceInfo.type !== "remaining" && <p className="receipt-settled">Quitado</p>}
        {creditGenerated > 0 && (
          <div className="receipt-summary-row">
            <span>Crédito gerado</span>
            <strong>{formatCurrencyBR(creditGenerated)}</strong>
          </div>
        )}
        <div className="receipt-total">
          <span>TOTAL</span>
          <strong>{formatCurrencyBR(order.total)}</strong>
        </div>
      </section>
    </article>
  );
}
