import { PageHeader } from "../../components/ui/PageHeader";
import { TodayDeliveriesSection } from "./components/TodayDeliveriesSection";
import { TodayOverviewGrid } from "./components/TodayOverviewGrid";
import { TodayOtherInforms } from "./components/TodayOtherInforms";
import { TodayProductionSection } from "./components/TodayProductionSection";
import { useTodayDashboard } from "./useTodayDashboard";

export function TodayPage() {
  const {
    todayKey,
    upcomingDateKeys,
    upcomingDeliveries,
    deliverySummaryCards,
    productionByDate,
    pendingPayments,
    pendingPaymentsTotal,
    openTasks,
    openTasksTotal,
    contactSuggestions,
    loading,
    ordersError,
    clientsError,
    tasksError,
  } = useTodayDashboard();

  return (
    <div className="page-stack">
      <PageHeader
        title="Hoje"
        description="Resumo operacional de entregas, pagamentos, tarefas e contatos."
      />

      {loading && (
        <p className="muted-text">Carregando informações de hoje...</p>
      )}

      {ordersError && <p className="error-text">{ordersError}</p>}
      {clientsError && <p className="error-text">{clientsError}</p>}
      {tasksError && <p className="error-text">{tasksError}</p>}

      {/* Visão geral das atividades de hoje */}
      <TodayOverviewGrid
        upcomingDeliveriesCount={upcomingDeliveries.length}
        pendingPaymentsCount={pendingPayments.length}
        pendingPaymentsTotal={pendingPaymentsTotal}
        openTasksTotal={openTasksTotal}
        contactSuggestionsCount={contactSuggestions.length}
        finalUpcomingDateKey={upcomingDateKeys[4]}
      />

      {/* Seção de produção do dia */}
      <TodayProductionSection
        todayKey={todayKey}
        productionByDate={productionByDate}
      />

      {/* Seção de entregas do dia até os próximos 5 dias */}
      <TodayDeliveriesSection deliverySummaryCards={deliverySummaryCards} />

      {/* Outras informações pendentes */}
      <TodayOtherInforms
        pendingPayments={pendingPayments}
        contactSuggestions={contactSuggestions}
        openTasks={openTasks}
      />
    </div>
  );
}