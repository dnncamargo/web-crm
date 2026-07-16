import { Card } from "../../../components/ui/Card";
import { formatCurrencyBR } from "../../../utils/money";
import type { Client } from "../../clients/clientTypes";
import type { Order } from "../../orders/orderTypes";
import { getPaymentStatus, getPaymentStatusLabel } from "../../orders/orderUtils";
import type { Task } from "../../tasks/taskTypes";
import { formatTaskDateBR, getTaskDueStatus, getTaskDueStatusLabel } from "../../tasks/taskUtils";
import { formatDateKeyBR, getClientLastInteractionDateKey, getClientNextContactDateKey, getDateKeyFromDateTime } from "../todayUtils";

interface TodayOtherInformsProps {
  pendingPayments: Order[];
  contactSuggestions: Client[];
  openTasks: Task[];
}

export function TodayOtherInforms({ pendingPayments, contactSuggestions, openTasks }: TodayOtherInformsProps) {
  return (
    <section className="entity-list-group">
      <header>
        <div>
          <strong>Outras informações e pendências</strong>
          <p>Pagamentos, contatos e tarefas que pedem atenção</p>
        </div>
      </header>

      <div className="dashboard-grid dashboard-grid-3">
        <Card className="dashboard-card">
          <section className="entity-list-group">
            <header>
              <div>
                <strong>Pagamentos pendentes</strong>
                <p>Pedidos a pagar ou parcialmente pagos</p>
              </div>
            </header>

            {pendingPayments.length ? (
              <div className="entity-list-view dashboard-card-list">
                {pendingPayments.slice(0, 8).map((order) => {
                  const paymentStatus = getPaymentStatus(order);
                  const remaining = Math.max(order.total - order.amountPaid, 0);

                  return (
                    <article className="entity-row-with-side-action" key={order.id}>
                      <div className="entity-row-clickable">
                        <div className="entity-row-main">
                          <strong className="entity-title">{order.clientName}</strong>
                          <span className="entity-subtitle">
                            {getPaymentStatusLabel(paymentStatus)} · Restante {formatCurrencyBR(remaining)}
                          </span>
                        </div>
                      </div>

                      <aside className="entity-row-side">
                        <strong className="entity-value">{formatDateKeyBR(getDateKeyFromDateTime(order.deliveryDateTime))}</strong>
                      </aside>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state dashboard-empty-state">
                <span>Nenhum pagamento pendente.</span>
              </div>
            )}
          </section>
        </Card>

        <Card className="dashboard-card">
          <section className="entity-list-group">
            <header>
              <div>
                <strong>Sugestões de contato</strong>
                <p>Clientes com frequência de contato vencida</p>
              </div>
            </header>

            {contactSuggestions.length ? (
              <div className="entity-list-view dashboard-card-list">
                {contactSuggestions.map((client) => {
                  const lastInteractionDateKey = getClientLastInteractionDateKey(client);
                  const nextContactDateKey = getClientNextContactDateKey(client);

                  return (
                    <article className="entity-row-with-side-action" key={client.id}>
                      <div className="entity-row-clickable">
                        <div className="entity-row-main">
                          <strong className="entity-title">{client.name}</strong>
                          <span className="entity-subtitle">
                            {lastInteractionDateKey ? `Última interação: ${formatDateKeyBR(lastInteractionDateKey)}` : "Sem interação registrada"}
                          </span>
                        </div>
                      </div>

                      <aside className="entity-row-side">
                        <strong className="entity-value">{nextContactDateKey ? formatDateKeyBR(nextContactDateKey) : "Sem previsão"}</strong>
                      </aside>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state dashboard-empty-state">
                <span>Nenhum contato sugerido agora.</span>
              </div>
            )}
          </section>
        </Card>

        <Card className="dashboard-card">
          <section className="entity-list-group">
            <header>
              <div>
                <strong>Tarefas abertas</strong>
                <p>Lembretes e etapas ainda pendentes</p>
              </div>
            </header>

            {openTasks.length ? (
              <div className="entity-list-view dashboard-card-list">
                {openTasks.map((task) => {
                  const dueStatus = getTaskDueStatus(task);

                  return (
                    <article className="entity-row-with-side-action" key={task.id}>
                      <div className="entity-row-clickable">
                        <div className="entity-row-main">
                          <strong className="entity-title">{task.title}</strong>
                          <span className="entity-subtitle">{task.clientName || "Sem cliente vinculado"}</span>
                        </div>
                      </div>

                      <aside className="entity-row-side">
                        <strong className="entity-value">{task.dueDate ? formatTaskDateBR(task.dueDate) : getTaskDueStatusLabel(dueStatus)}</strong>
                      </aside>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state dashboard-empty-state">
                <span>Nenhuma tarefa aberta.</span>
              </div>
            )}
          </section>
        </Card>
      </div>
    </section>
  );
}
