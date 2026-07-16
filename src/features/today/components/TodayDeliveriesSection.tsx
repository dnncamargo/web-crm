import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../../orders/orderTypes";
import { formatDateKeyShort, getDateKeyFromDateTime, getTimeFromDateTime } from "../todayUtils";

interface DeliverySummaryCard {
  key: string;
  title: string;
  orders: Order[];
}

interface TodayDeliveriesSectionProps {
  deliverySummaryCards: DeliverySummaryCard[];
}

export function TodayDeliveriesSection({ deliverySummaryCards }: TodayDeliveriesSectionProps) {
  return (
    <section className="entity-list-group">
      <header>
        <div>
          <strong>Entregas</strong>
          <p>Hoje e próximos 4 dias</p>
        </div>
      </header>

      <div className="dashboard-grid dashboard-grid-3">
        {deliverySummaryCards.map((deliveryCard) => (
          <Card className="dashboard-card" key={deliveryCard.key}>
            <section className="entity-list-group">
              <header>
                <div>
                  <strong>{deliveryCard.title}</strong>
                  <p>{deliveryCard.orders.length === 1 ? "1 pedido" : `${deliveryCard.orders.length} pedidos`}</p>
                </div>

                <Badge>{deliveryCard.orders.length}</Badge>
              </header>

              {deliveryCard.orders.length ? (
                <div className="entity-list-view dashboard-card-list">
                  {deliveryCard.orders.map((order) => (
                    <article className="entity-row entity-row-with-side-action" key={order.id}>
                      <div className="entity-row-clickable">
                        <div className="entity-row-main">
                          <strong className="entity-title">
                            {getTimeFromDateTime(order.deliveryDateTime)} · {order.clientName}
                          </strong>

                          <span className="entity-subtitle">
                            {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}
                          </span>

                          {deliveryCard.key === "week" && (
                            <span className="entity-subtitle">{formatDateKeyShort(getDateKeyFromDateTime(order.deliveryDateTime))}</span>
                          )}
                        </div>
                      </div>

                      <aside className="entity-row-side">
                        <strong className="entity-value">{formatCurrencyBR(order.total)}</strong>
                      </aside>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state dashboard-empty-state">
                  <span>Nenhuma entrega prevista.</span>
                </div>
              )}
            </section>
          </Card>
        ))}
      </div>
    </section>
  );
}
