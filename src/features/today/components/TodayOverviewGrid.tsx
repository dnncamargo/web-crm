import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import { formatDateKeyBR } from "../todayUtils";

interface TodayOverviewGridProps {
  upcomingDeliveriesCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsTotal: number;
  openTasksTotal: number;
  contactSuggestionsCount: number;
  finalUpcomingDateKey: string;
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
    <section className="today-overview-grid">
      <Card>
        <div className="today-metric-card">
          <span>Próximas entregas</span>
          <strong>{upcomingDeliveriesCount}</strong>
          <small>Hoje até {formatDateKeyBR(finalUpcomingDateKey)}</small>
        </div>
      </Card>

      <Card>
        <div className="today-metric-card">
          <span>Pagamentos pendentes</span>
          <strong>{pendingPaymentsCount}</strong>
          <small>{formatCurrencyBR(pendingPaymentsTotal)}</small>
        </div>
      </Card>

      <Card>
        <div className="today-metric-card">
          <span>Tarefas abertas</span>
          <strong>{openTasksTotal}</strong>
          <small>Organizadas por prazo</small>
        </div>
      </Card>

      <Card>
        <div className="today-metric-card">
          <span>Sugestões de contato</span>
          <strong>{contactSuggestionsCount}</strong>
          <small>Clientes com contato previsto</small>
        </div>
      </Card>
    </section>
  );
}