import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderStatusLabel,
  getPaymentStatus,
  getPaymentStatusLabel,
} from "../orderUtils";

interface OrderDetailsPanelContentProps {
  order: Order;
  onEdit: () => void;
}

export function OrderDetailsPanelContent({
  order,
  onEdit,
}: OrderDetailsPanelContentProps) {
  const paymentStatus = getPaymentStatus(order);
  const remaining = Math.max(order.total - order.amountPaid, 0);

  return (
    <div className="order-details-panel">
      <section className="detail-section">
        <div className="form-section-title">
          <span>Resumo</span>
        </div>

        <div className="details-grid">
          <div className="detail-block">
            <span>Cliente</span>
            <strong>{order.clientName}</strong>
          </div>

          <div className="detail-block">
            <span>Entrega</span>
            <strong>{formatDateTimeBR(order.deliveryDateTime)}</strong>
          </div>

          <div className="detail-block">
            <span>Status</span>
            <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
          </div>

          <div className="detail-block">
            <span>Pagamento</span>
            <strong>{getPaymentStatusLabel(paymentStatus)}</strong>
          </div>
        </div>

        <div className="badge-row">
          <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
          <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
        </div>
      </section>

      <section className="detail-section">
        <div className="form-section-title">
          <span>Itens</span>
        </div>

        <div className="subtle-list">
          {order.items.map((item) => (
            <small key={item.id}>
              {item.quantity} × {item.productName} ·{" "}
              {formatCurrencyBR(item.unitPrice)} cada ·{" "}
              <strong>{formatCurrencyBR(item.total)}</strong>
            </small>
          ))}
        </div>
      </section>

      <section className="detail-section">
        <div className="form-section-title">
          <span>Valores</span>
        </div>

        <div className="order-summary-box">
          <span>Subtotal: {formatCurrencyBR(order.subtotal)}</span>
          <span>Entrega: {formatCurrencyBR(order.deliveryFee)}</span>
          <strong>Total: {formatCurrencyBR(order.total)}</strong>
          <span>Pago: {formatCurrencyBR(order.amountPaid)}</span>
          <span>Restante: {formatCurrencyBR(remaining)}</span>
        </div>
      </section>

      {order.addressSnapshot && (
        <section className="detail-section">
          <div className="form-section-title">
            <span>Endereço de entrega</span>
          </div>

          <div className="notes-preview">
            <span>{order.addressSnapshot.label}</span>
            <p>
              {order.addressSnapshot.street}
              {order.addressSnapshot.number
                ? `, ${order.addressSnapshot.number}`
                : ""}
              {order.addressSnapshot.complement
                ? ` · ${order.addressSnapshot.complement}`
                : ""}
              {order.addressSnapshot.neighborhood
                ? ` · ${order.addressSnapshot.neighborhood}`
                : ""}
              {order.addressSnapshot.city
                ? ` · ${order.addressSnapshot.city}`
                : ""}
              {order.addressSnapshot.state
                ? `/${order.addressSnapshot.state}`
                : ""}
            </p>

            {order.addressSnapshot.reference && (
              <p>{order.addressSnapshot.reference}</p>
            )}
          </div>
        </section>
      )}

      {order.notes && (
        <section className="detail-section">
          <div className="form-section-title">
            <span>Observações</span>
          </div>

          <div className="notes-preview">
            <p>{order.notes}</p>
          </div>
        </section>
      )}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Editar pedido
        </Button>
      </div>
    </div>
  );
}