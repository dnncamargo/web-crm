import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { addDaysToDateKey } from "../todayUtils";

interface ProductionDateGroup {
  dateKey: string;
  items: {
    productName: string;
    quantity: number;
  }[];
}

interface TodayProductionSectionProps {
  todayKey: string;
  productionByDate: ProductionDateGroup[];
}

export function TodayProductionSection({ todayKey, productionByDate }: TodayProductionSectionProps) {
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const itemsByDate = new Map(productionByDate.map((group) => [group.dateKey, group.items]));
  const nextDaysTotals = new Map<string, number>();

  productionByDate
    .filter((group) => group.dateKey !== todayKey && group.dateKey !== tomorrowKey)
    .forEach((group) => {
      group.items.forEach((item) => {
        nextDaysTotals.set(item.productName, (nextDaysTotals.get(item.productName) ?? 0) + item.quantity);
      });
    });

  const summaryCards = [
    { key: "today", title: "Hoje", items: itemsByDate.get(todayKey) ?? [] },
    { key: "tomorrow", title: "Amanhã", items: itemsByDate.get(tomorrowKey) ?? [] },
    {
      key: "next-days",
      title: "Próximos 3 dias",
      items: Array.from(nextDaysTotals, ([productName, quantity]) => ({ productName, quantity })).sort((first, second) =>
        first.productName.localeCompare(second.productName),
      ),
    },
  ];

  return (
    <section className="entity-list-group">
      <header>
        <div>
          <strong>Produção do dia</strong>
          <p>Produtos iguais agrupados por período de entrega</p>
        </div>
      </header>

      <div className="dashboard-grid dashboard-grid-3">
        {summaryCards.map((summaryCard) => (
          <Card className="dashboard-card" key={summaryCard.key}>
            <section className="entity-list-group">
              <header>
                <div>
                  <strong>{summaryCard.title}</strong>
                  <p>Total agrupado por produto</p>
                </div>

                <Badge>{summaryCard.items.length}</Badge>
              </header>

              {summaryCard.items.length ? (
                <div className="entity-list-view dashboard-card-list">
                  {summaryCard.items.map((item) => (
                    <article className="entity-row entity-row-with-side-action" key={item.productName}>
                      <div className="entity-row-clickable">
                        <div className="entity-row-main">
                          <strong className="entity-title">{item.productName}</strong>
                        </div>
                      </div>

                      <aside className="entity-row-side">
                        <strong className="entity-value">{item.quantity}</strong>
                      </aside>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state dashboard-empty-state">
                  <span>Nenhuma produção prevista.</span>
                </div>
              )}
            </section>
          </Card>
        ))}
      </div>
    </section>
  );
}
