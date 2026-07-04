import { useMemo } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatCurrencyBR } from "../../utils/money";
import { useClients } from "../clients/useClients";
import { useOrders } from "../orders/useOrders";
import { getPaymentStatus, getPaymentStatusLabel } from "../orders/orderUtils";
import { useTasks } from "../tasks/useTasks";
import { formatTaskDateBR, getTaskDueStatus, getTaskDueStatusLabel } from "../tasks/taskUtils";
import {
  formatDateKeyBR,
  formatDateKeyShort,
  getClientLastInteractionDateKey,
  getClientNextContactDateKey,
  getDateKeyFromDateTime,
  getTimeFromDateTime,
  getTodayKey,
  getUpcomingDateKeys,
  shouldSuggestClientContact,
} from "./todayUtils";
export function TodayPage() {
  const { orders, loadingOrders, ordersError } = useOrders();
  const { filteredClients, loading: loadingClients, error: clientsError } = useClients();
  const { tasks, loadingTasks, tasksError } = useTasks();
  const todayKey = getTodayKey();
  const upcomingDateKeys = useMemo(() => getUpcomingDateKeys(5), []);
  const upcomingDeliveries = useMemo(() => {
    return orders
      .filter((order) => {
        if (order.orderStatus !== "active") {
          return false;
        }
        const deliveryDateKey = getDateKeyFromDateTime(order.deliveryDateTime);
        return upcomingDateKeys.includes(deliveryDateKey);
      })
      .sort((firstOrder, secondOrder) => firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime));
  }, [orders, upcomingDateKeys]);

  const deliveryDateKeysWithOrders = useMemo(() => {
    return upcomingDateKeys.filter((dateKey) => upcomingDeliveries.some((order) => getDateKeyFromDateTime(order.deliveryDateTime) === dateKey));
  }, [upcomingDateKeys, upcomingDeliveries]);

  const pendingPayments = useMemo(() => {
    return orders
      .filter((order) => {
        if (order.orderStatus !== "active") {
          return false;
        }
        const paymentStatus = getPaymentStatus(order);
        return paymentStatus === "unpaid" || paymentStatus === "partial";
      })
      .sort((firstOrder, secondOrder) => firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime));
  }, [orders]);
  const openTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.done)
      .sort((firstTask, secondTask) => {
        if (!firstTask.dueDate && secondTask.dueDate) {
          return 1;
        }
        if (firstTask.dueDate && !secondTask.dueDate) {
          return -1;
        }
        if (firstTask.dueDate && secondTask.dueDate) {
          return firstTask.dueDate.localeCompare(secondTask.dueDate);
        }
        return firstTask.title.localeCompare(secondTask.title);
      })
      .slice(0, 8);
  }, [tasks]);
  const contactSuggestions = useMemo(() => {
    return filteredClients
      .filter(shouldSuggestClientContact)
      .sort((firstClient, secondClient) => {
        const firstDate = getClientNextContactDateKey(firstClient) ?? todayKey;
        const secondDate = getClientNextContactDateKey(secondClient) ?? todayKey;
        return firstDate.localeCompare(secondDate);
      })
      .slice(0, 8);
  }, [filteredClients, todayKey]);
  const loading = loadingOrders || loadingClients || loadingTasks;
  return (
    <div className="page-stack">
      {" "}
      <PageHeader title="Hoje" description="Resumo operacional de entregas, pagamentos, tarefas e contatos." /> {loading && <p className="muted-text">Carregando informações de hoje...</p>}{" "}
      {ordersError && <p className="error-text">{ordersError}</p>} {clientsError && <p className="error-text">{clientsError}</p>} {tasksError && <p className="error-text">{tasksError}</p>}{" "}
      <section className="today-overview-grid">
        {" "}
        <Card>
          {" "}
          <div className="today-metric-card">
            {" "}
            <span>Próximas entregas</span> <strong>{upcomingDeliveries.length}</strong> <small>Hoje até {formatDateKeyBR(upcomingDateKeys[5])}</small>{" "}
          </div>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <div className="today-metric-card">
            {" "}
            <span>Pagamentos pendentes</span> <strong>{pendingPayments.length}</strong>{" "}
            <small> {formatCurrencyBR(pendingPayments.reduce((sum, order) => sum + Math.max(order.total - order.amountPaid, 0), 0))} </small>{" "}
          </div>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <div className="today-metric-card">
            {" "}
            <span>Tarefas abertas</span> <strong>{tasks.filter((task) => !task.done).length}</strong> <small>Organizadas por prazo</small>{" "}
          </div>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <div className="today-metric-card">
            {" "}
            <span>Sugestões de contato</span> <strong>{contactSuggestions.length}</strong> <small>Clientes com contato previsto</small>{" "}
          </div>{" "}
        </Card>{" "}
      </section>{" "}
      <section className="today-section">
        {" "}
        <div className="today-section-header">
          {" "}
          <div>
            {" "}
            <h2>Entregas</h2> <p>Hoje e próximos 5 dias</p>{" "}
          </div>{" "}
        </div>{" "}
        <div className="today-date-groups">
          {" "}
          {deliveryDateKeysWithOrders.length === 0 ? (
            <Card>
              <div className="empty-state">
                <strong>Nenhuma entrega próxima.</strong>
                <span>Não há entregas previstas para hoje e os próximos 5 dias.</span>
              </div>
            </Card>
          ) : (
            deliveryDateKeysWithOrders.map((dateKey) => {
              const dateOrders = upcomingDeliveries.filter((order) => getDateKeyFromDateTime(order.deliveryDateTime) === dateKey);

              return (
                <Card key={dateKey}>
                  <div className="today-date-group">
                    <header>
                      <strong>{dateKey === todayKey ? "Hoje" : formatDateKeyShort(dateKey)}</strong>

                      <Badge>{`${dateOrders.length} ${dateOrders.length === 1 ? "entrega" : "entregas"}`}</Badge>
                    </header>

                    <div className="today-list">
                      {dateOrders.map((order) => (
                        <article className="today-list-item" key={order.id}>
                          <div>
                            <strong>
                              {getTimeFromDateTime(order.deliveryDateTime)} · {order.clientName}
                            </strong>

                            <span>{order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")}</span>
                          </div>

                          <small>{formatCurrencyBR(order.total)}</small>
                        </article>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
          {deliveryDateKeysWithOrders.map((dateKey) => {
            const dateOrders = upcomingDeliveries.filter((order) => getDateKeyFromDateTime(order.deliveryDateTime) === dateKey);
            return (
              <Card key={dateKey}>
                {" "}
                <div className="today-date-group">
                  {" "}
                  <header>
                    {" "}
                    <strong> {dateKey === todayKey ? "Hoje" : formatDateKeyShort(dateKey)} </strong>
                    <Badge> {`${dateOrders.length} ${dateOrders.length === 1 ? "entrega" : "entregas"}`} </Badge>{" "}
                  </header>{" "}
                  {dateOrders.length === 0 ? (
                    <p className="muted-text">Nenhuma entrega neste dia.</p>
                  ) : (
                    <div className="today-list">
                      {" "}
                      {dateOrders.map((order) => (
                        <article className="today-list-item" key={order.id}>
                          {" "}
                          <div>
                            {" "}
                            <strong>
                              {" "}
                              {getTimeFromDateTime(order.deliveryDateTime)} · {order.clientName}{" "}
                            </strong>{" "}
                            <span> {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")} </span>{" "}
                          </div>{" "}
                          <small>{formatCurrencyBR(order.total)}</small>{" "}
                        </article>
                      ))}{" "}
                    </div>
                  )}{" "}
                </div>{" "}
              </Card>
            );
          })}{" "}
        </div>{" "}
      </section>{" "}
      <section className="today-columns">
        {" "}
        <Card>
          {" "}
          <div className="today-panel">
            {" "}
            <header>
              {" "}
              <div>
                {" "}
                <h2>Pagamentos pendentes</h2> <p>Pedidos a pagar ou parcialmente pagos</p>{" "}
              </div>{" "}
            </header>{" "}
            {pendingPayments.length === 0 ? (
              <p className="muted-text">Nenhum pagamento pendente.</p>
            ) : (
              <div className="today-list">
                {" "}
                {pendingPayments.slice(0, 8).map((order) => {
                  const paymentStatus = getPaymentStatus(order);
                  const remaining = Math.max(order.total - order.amountPaid, 0);
                  return (
                    <article className="today-list-item" key={order.id}>
                      {" "}
                      <div>
                        {" "}
                        <strong>{order.clientName}</strong>{" "}
                        <span>
                          {" "}
                          {getPaymentStatusLabel(paymentStatus)} · Restante {formatCurrencyBR(remaining)}{" "}
                        </span>{" "}
                      </div>{" "}
                      <small>{formatDateKeyBR(getDateKeyFromDateTime(order.deliveryDateTime))}</small>{" "}
                    </article>
                  );
                })}{" "}
              </div>
            )}{" "}
          </div>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <div className="today-panel">
            {" "}
            <header>
              {" "}
              <div>
                {" "}
                <h2>Tarefas abertas</h2> <p>Lembretes e etapas ainda pendentes</p>{" "}
              </div>{" "}
            </header>{" "}
            {openTasks.length === 0 ? (
              <p className="muted-text">Nenhuma tarefa aberta.</p>
            ) : (
              <div className="today-list">
                {" "}
                {openTasks.map((task) => {
                  const dueStatus = getTaskDueStatus(task);
                  return (
                    <article className="today-list-item" key={task.id}>
                      {" "}
                      <div>
                        {" "}
                        <strong>{task.title}</strong> <span>{task.clientName || "Sem cliente vinculado"}</span>{" "}
                      </div>{" "}
                      <small> {task.dueDate ? formatTaskDateBR(task.dueDate) : getTaskDueStatusLabel(dueStatus)} </small>{" "}
                    </article>
                  );
                })}{" "}
              </div>
            )}{" "}
          </div>{" "}
        </Card>{" "}
        <Card>
          {" "}
          <div className="today-panel">
            {" "}
            <header>
              {" "}
              <div>
                {" "}
                <h2>Sugestões de contato</h2> <p>Clientes com frequência de contato vencida</p>{" "}
              </div>{" "}
            </header>{" "}
            {contactSuggestions.length === 0 ? (
              <p className="muted-text">Nenhum contato sugerido agora.</p>
            ) : (
              <div className="today-list">
                {" "}
                {contactSuggestions.map((client) => {
                  const lastInteractionDateKey = getClientLastInteractionDateKey(client);
                  const nextContactDateKey = getClientNextContactDateKey(client);
                  return (
                    <article className="today-list-item" key={client.id}>
                      {" "}
                      <div>
                        {" "}
                        <strong>{client.name}</strong> <span> {lastInteractionDateKey ? `Última interação: ${formatDateKeyBR(lastInteractionDateKey)}` : "Sem interação registrada"} </span>{" "}
                      </div>{" "}
                      <small> {nextContactDateKey ? formatDateKeyBR(nextContactDateKey) : "Sem previsão"} </small>{" "}
                    </article>
                  );
                })}{" "}
              </div>
            )}{" "}
          </div>{" "}
        </Card>{" "}
      </section>{" "}
    </div>
  );
}
