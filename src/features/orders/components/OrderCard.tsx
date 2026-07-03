import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderStatusLabel,
  getPaymentStatus,
  getPaymentStatusLabel,
} from "../orderUtils";

interface OrderCardProps {
  order: Order;
  onRequestEditOrder: (order: Order) => void;
}

export function OrderCard({ order, onRequestEditOrder }: OrderCardProps) {
  const paymentStatus = getPaymentStatus(order);
  const remaining = Math.max(order.total - order.amountPaid, 0);

  return (
    <Card className={order.orderStatus !== "active" ? "muted-card" : ""}>
      <div className="client-card-header">
        <div>
          <h2>{order.clientName}</h2>
          <p>{formatDateTimeBR(order.deliveryDateTime)}</p>
        </div>
      </div>

      <div className="badge-row">
        <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
        <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
        {order.addressSnapshot ? (
          <Badge>{order.addressSnapshot.city}</Badge>
        ) : (
          <Badge>sem-endereco</Badge>
        )}
      </div>

      <div className="client-meta">
        <span>Total: {formatCurrencyBR(order.total)}</span>
        <span>Pago: {formatCurrencyBR(order.amountPaid)}</span>
        <span>Restante: {formatCurrencyBR(remaining)}</span>
      </div>

      <div className="subtle-list order-card-items">
        <span>Itens</span>

        {order.items.map((item) => (
          <small key={item.id}>
            {item.quantity} × {item.productName} ·{" "}
            {formatCurrencyBR(item.total)}
          </small>
        ))}
      </div>

      {order.addressSnapshot && (
        <div className="notes-preview">
          <span>Entrega</span>
          <p>
            {order.addressSnapshot.street}
            {order.addressSnapshot.number
              ? `, ${order.addressSnapshot.number}`
              : ""}
            {order.addressSnapshot.neighborhood
              ? ` · ${order.addressSnapshot.neighborhood}`
              : ""}
            {order.addressSnapshot.city
              ? ` · ${order.addressSnapshot.city}`
              : ""}
          </p>
        </div>
      )}

      {order.notes && (
        <div className="notes-preview">
          <span>Observações</span>
          <p>{order.notes}</p>
        </div>
      )}

      <div className="card-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onRequestEditOrder(order)}
        >
          Editar pedido
        </Button>
      </div>
    </Card>
  );
}