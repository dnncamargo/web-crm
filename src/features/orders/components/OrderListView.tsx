// import { Badge } from "../../../components/ui/Badge";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import {
  formatDateTimeBR,
  getOrderBalanceInfo,
  // getOrderStatusLabel,
  // getPaymentStatus,
  // getPaymentStatusLabel,
} from "../orderUtils";

interface OrderListViewProps {
  orders: Order[];
  onRequestViewOrder: (order: Order) => void;
}

export function OrderListView({ orders, onRequestViewOrder }: OrderListViewProps) {
  return (
    <div className="entity-list-view">
      {orders.map((order) => {
        const balanceInfo = getOrderBalanceInfo(order);

        return (
          <button type="button" className="entity-row" key={order.id} onClick={() => onRequestViewOrder(order)}>
            <div className="entity-row-line">
              <strong className="entity-title">{order.clientName}</strong>

              <strong className="entity-value">{formatCurrencyBR(order.total)}</strong>
            </div>

            <div className="entity-row-line">
              <span className="entity-subtitle">{formatDateTimeBR(order.deliveryDateTime)}</span>

              <span className="entity-subtitle">
                {balanceInfo.label}: {formatCurrencyBR(balanceInfo.amount)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
