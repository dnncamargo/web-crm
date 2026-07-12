import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { formatDateKeyShort } from "../todayUtils";

interface ProductionItem {
  productName: string;
  quantity: number;
}

interface ProductionByDate {
  dateKey: string;
  items: ProductionItem[];
}

interface TodayProductionSectionProps {
  todayKey: string;
  productionByDate: ProductionByDate[];
}

export function TodayProductionSection({
  todayKey,
  productionByDate,
}: TodayProductionSectionProps) {
  return (
    <section className="today-section">
      <div className="today-section-header">
        <div>
          <h2>Produção do dia</h2>
          <p>Produtos iguais agrupados por data de entrega</p>
        </div>
      </div>

      <div className="today-date-groups">
        {productionByDate.length === 0 ? (
          <Card>
            <div className="empty-state">
              <strong>Nenhuma produção próxima.</strong>
              <span>Não há produtos previstos para hoje e os próximos 5 dias.</span>
            </div>
          </Card>
        ) : (
          productionByDate.map((dateProduction) => (
            <Card key={dateProduction.dateKey}>
              <div className="today-date-group">
                <header>
                  <strong>
                    {dateProduction.dateKey === todayKey
                      ? "Hoje"
                      : formatDateKeyShort(dateProduction.dateKey)}
                  </strong>

                  <Badge>
                    {`${dateProduction.items.length} ${
                      dateProduction.items.length === 1 ? "produto" : "produtos"
                    }`}
                  </Badge>
                </header>

                <div className="today-list">
                  {dateProduction.items.map((item) => (
                    <article className="today-list-item" key={item.productName}>
                      <div>
                        <strong>{item.productName}</strong>
                        <span>Total a produzir no dia</span>
                      </div>

                      <small>{item.quantity}</small>
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