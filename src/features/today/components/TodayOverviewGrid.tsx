import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import { formatDateKeyBR } from "../todayUtils";

interface TodayOverviewGridProps {
  upcomingDeliveriesCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  openTasksTotal: number;
  contactSuggestionsCount: number;
  finalUpcomingDateKey?: string;
}

export function TodayOverviewGrid({
  upcomingDeliveriesCount,
  pendingPaymentsCount,
  pendingPaymentsTotal,
  openTasksTotal,
  contactSuggestionsCount,
  finalUpcomingDateKey,
}: TodayOverviewGridProps) {
  return (
    <section className="dashboard-grid dashboard-grid-4">
      <Card className="dashboard-card">
        <article className="entity-row-with-side-action">
          <div className="entity-row-clickable">
            <div className="entity-row-main">
              <strong className="entity-title">Próximas entregas</strong>
              <span className="entity-subtitle">
                {finalUpcomingDateKey
                  ? `Hoje até ${formatDateKeyBR(finalUpcomingDateKey)}`
                  : "Sem período definido"}
              </span>
            </div>
          </div>

          <aside className="entity-row-side">
            <strong className="entity-value">{upcomingDeliveriesCount}</strong>
          </aside>
        </article>
      </Card>

      <Card className="dashboard-card">
        <article className="entity-row-with-side-action">
          <div className="entity-row-clickable">
            <div className="entity-row-main">
              <strong className="entity-title">Pagamentos pendentes</strong>
              <span className="entity-subtitle">
                {formatCurrencyBR(pendingPaymentsTotal)}
              </span>
            </div>
          </div>

          <aside className="entity-row-side">
            <strong className="entity-value">{pendingPaymentsCount}</strong>
          </aside>
        </article>
      </Card>

      <Card className="dashboard-card">
        <article className="entity-row-with-side-action">
          <div className="entity-row-clickable">
            <div className="entity-row-main">
              <strong className="entity-title">Tarefas abertas</strong>
              <span className="entity-subtitle">Organizadas por prazo</span>
            </div>
          </div>

          <aside className="entity-row-side">
            <strong className="entity-value">{openTasksTotal}</strong>
          </aside>
        </article>
      </Card>

      <Card className="dashboard-card">
        <article className="entity-row-with-side-action">
          <div className="entity-row-clickable">
            <div className="entity-row-main">
              <strong className="entity-title">Sugestões de contato</strong>
              <span className="entity-subtitle">
                Clientes com contato previsto
              </span>
            </div>
          </div>

          <aside className="entity-row-side">
            <strong className="entity-value">{contactSuggestionsCount}</strong>
          </aside>
        </article>
      </Card>
    </section>
  );
}
