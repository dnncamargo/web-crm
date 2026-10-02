import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderBalanceInfo,
  getOrderItemProductName,
  getOrderStatusLabel,
  getPaymentStatus,
  getPaymentStatusLabel,
} from "../orderUtils";

interface OrderCardProps {
  order: Order;
  products: Product[];
  onRequestEditOrder: (order: Order) => void;
}

export function OrderCard({ order, products, onRequestEditOrder }: OrderCardProps) {
  const paymentStatus = getPaymentStatus(order);
  const balanceInfo = getOrderBalanceInfo(order);

  return (
    <Card className={order.orderStatus !== "active" ? "muted-card" : ""}>
      <div className="client-card-header">
        <div>
          <h2>{order.clientName}</h2>
          <p>{formatDateTimeBR(order.deliveryDateTime)}</p>
        </div>
      </div>

      <div className="entity-badges">
        <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
        <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
        {order.addressSnapshot ? (
          <Badge>{order.addressSnapshot.city}</Badge>
        ) : (
          <Badge>Retirada pelo cliente</Badge>
        )}
      </div>

      <div className="client-meta">
        <span>Total: {formatCurrencyBR(order.total)}</span>
        <span>Pago: {formatCurrencyBR(order.amountPaid)}</span>
        <span>{balanceInfo.label}: {formatCurrencyBR(balanceInfo.amount)}</span>
      </div>

      <div className="panel-list order-card-items">
        <span>Itens</span>

        {order.items.map((item) => (
          <small key={item.id}>
            {item.quantity} Ã— {getOrderItemProductName(item, products)} Â·{" "}
            {formatCurrencyBR(item.total)}
          </small>
        ))}
      </div>

      {order.addressSnapshot && (
        <div className="panel-note">
          <span>Entrega</span>
          <p>
            {order.addressSnapshot.street}
            {order.addressSnapshot.number
              ? `, ${order.addressSnapshot.number}`
              : ""}
            {order.addressSnapshot.neighborhood
              ? ` Â· ${order.addressSnapshot.neighborhood}`
              : ""}
            {order.addressSnapshot.city
              ? ` Â· ${order.addressSnapshot.city}`
              : ""}
          </p>
        </div>
      )}

      {order.notes && (
        <div className="panel-note">
          <span>ObservaÃ§Ãµes</span>
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
