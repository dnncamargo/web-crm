import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../../orders/orderTypes";
import {
  getOrderBalanceInfo,
  getPaymentStatus,
  getPaymentStatusLabel,
} from "../../orders/orderUtils";
import { formatDateKeyBR, getDateKeyFromDateTime } from "../todayUtils";

interface TodayPendingPaymentsPanelProps {
  pendingPayments: Order[];
}

export function TodayPendingPaymentsPanel({
  pendingPayments,
}: TodayPendingPaymentsPanelProps) {
  return (
    <div className="today-panel">
      <header>
        <div>
          <h2>Pagamentos pendentes</h2>
          <p>Pedidos a pagar ou parcialmente pagos</p>
        </div>
      </header>

      {pendingPayments.length === 0 ? (
        <p className="muted-text">Nenhum pagamento pendente.</p>
      ) : (
        <div className="today-list">
          {pendingPayments.slice(0, 8).map((order) => {
            const paymentStatus = getPaymentStatus(order);
            const balanceInfo = getOrderBalanceInfo(order);
            const remaining =
              balanceInfo.type === "remaining" ? balanceInfo.amount : 0;

            return (
              <article className="today-list-item" key={order.id}>
                <div>
                  <strong>{order.clientName}</strong>
                  <span>
                    {getPaymentStatusLabel(paymentStatus)} · Restante{" "}
                    {formatCurrencyBR(remaining)}
                  </span>
                </div>

                <small>
                  {formatDateKeyBR(getDateKeyFromDateTime(order.deliveryDateTime))}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}