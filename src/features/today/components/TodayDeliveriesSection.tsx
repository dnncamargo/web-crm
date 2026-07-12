import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../../orders/orderTypes";
import {
  formatDateKeyShort,
  getDateKeyFromDateTime,
  getTimeFromDateTime,
} from "../todayUtils";

interface DeliverySummaryCard {
  key: string;
  title: string;
  orders: Order[];
}

interface TodayDeliveriesSectionProps {
  deliverySummaryCards: DeliverySummaryCard[];
}

export function TodayDeliveriesSection({
  deliverySummaryCards,
}: TodayDeliveriesSectionProps) {
  return (
    <section className="today-section">
      <div className="today-section-header">
        <div>
          <h2>Entregas</h2>
          <p>Hoje e próximos 5 dias</p>
        </div>
      </div>

      <div className="today-date-groups">
        {deliverySummaryCards.length === 0 ? (
          <Card>
            <div className="empty-state">
              <strong>Nenhuma entrega próxima.</strong>
              <span>Não há entregas previstas para hoje e os próximos 5 dias.</span>
            </div>
          </Card>
        ) : (
          deliverySummaryCards.map((deliveryCard) => (
            <Card key={deliveryCard.key}>
              <div className="today-date-group">
                <header>
                  <strong>{deliveryCard.title}</strong>

                  <Badge>
                    {`${deliveryCard.orders.length} ${
                      deliveryCard.orders.length === 1 ? "entrega" : "entregas"
                    }`}
                  </Badge>
                </header>

                <div className="today-list">
                  {deliveryCard.orders.map((order) => (
                    <article className="today-list-item" key={order.id}>
                      <div>
                        <strong>
                          {getTimeFromDateTime(order.deliveryDateTime)} ·{" "}
                          {order.clientName}
                        </strong>

                        <span>
                          {order.items
                            .map((item) => `${item.quantity}× ${item.productName}`)
                            .join(" · ")}
                        </span>

                        {deliveryCard.key === "week" && (
                          <span>
                            {formatDateKeyShort(
                              getDateKeyFromDateTime(order.deliveryDateTime)
                            )}
                          </span>
                        )}
                      </div>

                      <small>{formatCurrencyBR(order.total)}</small>
                    </article>
                  ))}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}