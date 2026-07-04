import { Badge } from "../../../components/ui/Badge";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderStatusLabel,
  getPaymentStatus,
  getPaymentStatusLabel,
} from "../orderUtils";

interface OrderListViewProps {
  orders: Order[];
  onRequestViewOrder: (order: Order) => void;
}

export function OrderListView({
  orders,
  onRequestViewOrder,
}: OrderListViewProps) {
  return (
    <div className="order-list-view">
      {orders.map((order) => {
        const paymentStatus = getPaymentStatus(order);
        const remaining = Math.max(order.total - order.amountPaid, 0);

        return (
          <button
            type="button"
            className="order-list-row"
            key={order.id}
            onClick={() => onRequestViewOrder(order)}
          >
            <div className="order-list-main">
              <strong>{order.clientName}</strong>
              <span>{formatDateTimeBR(order.deliveryDateTime)}</span>

              <small>
                {order.items
                  .map((item) => `${item.quantity}× ${item.productName}`)
                  .join(" · ")}
              </small>

              <div className="order-list-badges">
                <Badge>{getOrderStatusLabel(order.orderStatus)}</Badge>
                <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge>
              </div>
            </div>

            <div className="order-list-values">
              <strong>{formatCurrencyBR(order.total)}</strong>
              <span>Restante: {formatCurrencyBR(remaining)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}