import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import { formatDateTimeBR, getOrderBalanceInfo, getOrderStatusLabel, getPaymentStatus, getPaymentStatusLabel } from "../orderUtils";

interface OrderDetailsPanelContentProps {
  order: Order;
  onEdit: () => void;
}

export function OrderDetailsPanelContent({ order, onEdit }: OrderDetailsPanelContentProps) {
  const paymentStatus = getPaymentStatus(order);
  const balanceInfo = getOrderBalanceInfo(order);
  const creditApplied = order.creditApplied ?? 0;
  const creditGenerated = order.creditGenerated ?? 0;
  const effectivePaid = order.amountPaid + creditApplied;

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
          {creditGenerated > 0 && <Badge>{`Crédito ${formatCurrencyBR(creditGenerated)}`}</Badge>}
        </div>
      </section>

      <section className="detail-section">
        <div className="form-section-title">
          <span>Pagamento</span>
          <small>Resumo financeiro deste pedido.</small>
        </div>

        <div className="order-details-financial">
          <div>
            <span>Produtos</span>
            <strong>{formatCurrencyBR(order.subtotal)}</strong>
          </div>

          <div>
            <span>Entrega</span>
            <strong>{formatCurrencyBR(order.deliveryFee)}</strong>
          </div>

          <div>
            <span>Total do pedido</span>
            <strong>{formatCurrencyBR(order.total)}</strong>
          </div>

          <div>
            <span>Pago pelo cliente</span>
            <strong>{formatCurrencyBR(order.amountPaid)}</strong>
          </div>

          {creditApplied > 0 && (
            <div className="credit-detail-row applied">
              <span>Crédito aplicado</span>
              <strong>{formatCurrencyBR(creditApplied)}</strong>
            </div>
          )}

          <div>
            <span>Total pago considerado</span>
            <strong>{formatCurrencyBR(effectivePaid)}</strong>
          </div>

          <div className={`credit-detail-row ${balanceInfo.type}`}>
            <span>{balanceInfo.label}</span>
            <strong>{formatCurrencyBR(balanceInfo.amount)}</strong>
          </div>
        </div>
      </section>

      <section className="detail-section">
        <div className="form-section-title">
          <span>Itens</span>
        </div>

        <div className="subtle-list">
          {order.items.map((item) => (
            <small key={item.id}>
              {item.quantity} × {item.productName} · {formatCurrencyBR(item.unitPrice)} cada · <strong>{formatCurrencyBR(item.total)}</strong>
            </small>
          ))}
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
              {order.addressSnapshot.number ? `, ${order.addressSnapshot.number}` : ""}
              {order.addressSnapshot.complement ? ` · ${order.addressSnapshot.complement}` : ""}
              {order.addressSnapshot.neighborhood ? ` · ${order.addressSnapshot.neighborhood}` : ""}
              {order.addressSnapshot.city ? ` · ${order.addressSnapshot.city}` : ""}
              {order.addressSnapshot.state ? `/${order.addressSnapshot.state}` : ""}
            </p>

            {order.addressSnapshot.reference && <p>{order.addressSnapshot.reference}</p>}
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
        <Button type="button" variant="primary" onClick={onEdit}>
          Editar pedido
        </Button>
      </div>
    </div>
  );
}
