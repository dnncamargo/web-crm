import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { formatCurrencyBR } from "../../utils/money";
import { getOrderStatusLabel, getPaymentStatusLabel } from "../orders/orderUtils";
import { useOrders } from "../orders/useOrders";
import type { OrderStatus } from "../orders/orderTypes";
import { getStoreProfile } from "../store-profile/storeProfileService";
import { DEFAULT_STORE_PROFILE } from "../store-profile/storeProfileTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import { projectFinancialReadModel, selectKnownReceiptsInInterval, selectKnownRefundsInInterval, sumProjectedReceipts } from "./projection";
import { legacyReaisToMoneyCents, sumMoneyCents } from "./money";
import type { FinancialControlPeriod, FinancialControlSort } from "./financialControl";
import { canPrintFinancialReport, compareFinancialControlValues, filterOrdersByCreationPeriod, getFinancialEventRowKey, getOrderCreationDate, isValidFinancialControlPeriod, matchesFinancialSearch } from "./financialControl";
import { openFinancialReportPrintWindow } from "./financialReportPrint";
import "./financialControl.css";

type FinancialControlView = "orders" | "cash";
type PaymentFilter = "all" | "unpaid" | "partial" | "paid" | "inconclusive";
type OperationalFilter = "all" | OrderStatus;
type CashEventFilter = "all" | "receipt" | "refund";

function currentMonthPeriod(): FinancialControlPeriod {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const through = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: inputDate(from), through: inputDate(through) };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function formatCivilDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function periodLabel(period: FinancialControlPeriod): string {
  return `${formatDateInput(period.from)} a ${formatDateInput(period.through)}`;
}

function formatDateInput(value: string): string {
  if (!value) return "não definido";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function FinancialControlPage() {
  const { orders, loadingOrders, ordersError } = useOrders();
  const [view, setView] = useState<FinancialControlView>("orders");
  const [ordersPeriod, setOrdersPeriod] = useState(currentMonthPeriod);
  const [cashPeriod, setCashPeriod] = useState(currentMonthPeriod);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [cashSearch, setCashSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [ordersOperationalFilter, setOrdersOperationalFilter] = useState<OperationalFilter>("all");
  const [cashOperationalFilter, setCashOperationalFilter] = useState<OperationalFilter>("all");
  const [cashEventFilter, setCashEventFilter] = useState<CashEventFilter>("all");
  const [ordersSort, setOrdersSort] = useState<FinancialControlSort>("date");
  const [cashSort, setCashSort] = useState<FinancialControlSort>("date");
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(DEFAULT_STORE_PROFILE);
  const [storeProfileLoading, setStoreProfileLoading] = useState(true);
  const [storeProfileUnavailable, setStoreProfileUnavailable] = useState(false);
  const [printError, setPrintError] = useState(false);

  useEffect(() => {
    let active = true;
    void getStoreProfile().then((profile) => {
      if (active) {
        setStoreProfile(profile);
        setStoreProfileLoading(false);
      }
    }).catch(() => {
      if (active) {
        setStoreProfileUnavailable(true);
        setStoreProfileLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  const projection = useMemo(() => projectFinancialReadModel(orders), [orders]);
  const balancesByOrderId = useMemo(() => new Map(projection.orderBalances.map((entry) => [entry.orderId, entry])), [projection.orderBalances]);
  const reconciledOrdersById = useMemo(() => new Map(projection.reconciliation.orders.map((entry) => [entry.orderId, entry])), [projection.reconciliation.orders]);
  const orderTotalCentsById = useMemo(() => {
    const totals = new Map<string, ReturnType<typeof legacyReaisToMoneyCents>>();
    orders.forEach((order) => {
      try {
        totals.set(order.id, legacyReaisToMoneyCents(order.total, "Total do Pedido"));
      } catch {
        // The row will show an inconclusive amount rather than a rounded value.
      }
    });
    return totals;
  }, [orders]);
  const ordersInPeriod = useMemo(() => filterOrdersByCreationPeriod(orders, ordersPeriod), [orders, ordersPeriod]);
  const ordersWithoutCreationDate = useMemo(() => orders.filter((order) => getOrderCreationDate(order) === null), [orders]);

  const visibleOrders = useMemo(() => ordersInPeriod.filter((order) => {
    if (!matchesFinancialSearch(ordersSearch, order.clientName, order.id)) return false;
    if (ordersOperationalFilter !== "all" && order.orderStatus !== ordersOperationalFilter) return false;
    const paymentStatus = balancesByOrderId.get(order.id)?.paymentStatus ?? "inconclusive";
    return paymentFilter === "all" || paymentStatus === paymentFilter;
  }).sort((first, second) => compareFinancialControlValues({
    clientName: first.clientName,
    date: getOrderCreationDate(first),
    valueCents: orderTotalCentsById.get(first.id) ?? 0,
  }, {
    clientName: second.clientName,
    date: getOrderCreationDate(second),
    valueCents: orderTotalCentsById.get(second.id) ?? 0,
  }, ordersSort)), [balancesByOrderId, orderTotalCentsById, ordersInPeriod, ordersOperationalFilter, ordersSearch, ordersSort, paymentFilter]);

  const cashEvents = useMemo(() => {
    const byId = new Map(orders.map((order) => [order.id, order]));
    if (!isValidFinancialControlPeriod(cashPeriod)) return [];
    const start = new Date(`${cashPeriod.from}T00:00:00`);
    const end = new Date(`${cashPeriod.through}T00:00:00`);
    end.setDate(end.getDate() + 1);
    const interval = { startInclusive: start.toISOString(), endExclusive: end.toISOString() };
    const receipts = selectKnownReceiptsInInterval(projection.knownReceipts, {
      ...interval,
    }).map((receipt) => {
      const order = byId.get(receipt.orderId);
      return order ? {
        id: getFinancialEventRowKey(order.id, "receipt", receipt.receiptId),
        orderId: order.id,
        clientName: order.clientName,
        orderStatus: order.orderStatus,
        kind: "receipt" as const,
        date: receipt.receivedAt,
        valueCents: receipt.amountCents,
      } : null;
    }).filter((event) => event !== null);
    const refunds = selectKnownRefundsInInterval(projection.knownRefunds, {
      ...interval,
    }).map((refund) => {
      const order = byId.get(refund.orderId);
      return order ? {
        id: getFinancialEventRowKey(order.id, "refund", refund.refundId),
        orderId: order.id,
        clientName: order.clientName,
        orderStatus: order.orderStatus,
        kind: "refund" as const,
        date: refund.refundedAt,
        valueCents: refund.amountCents,
      } : null;
    }).filter((event) => event !== null);
    return [...receipts, ...refunds];
  }, [cashPeriod, orders, projection.knownReceipts, projection.knownRefunds]);

  const visibleCashEvents = useMemo(() => cashEvents.filter((event) => (
    matchesFinancialSearch(cashSearch, event.clientName, event.orderId)
      && (cashEventFilter === "all" || event.kind === cashEventFilter)
      && (cashOperationalFilter === "all" || event.orderStatus === cashOperationalFilter)
  )).sort((first, second) => compareFinancialControlValues({
    clientName: first.clientName,
    date: first.date,
    valueCents: first.valueCents,
  }, {
    clientName: second.clientName,
    date: second.date,
    valueCents: second.valueCents,
  }, cashSort)), [cashEvents, cashEventFilter, cashOperationalFilter, cashSearch, cashSort]);

  const unknownDateReceiptsMatchingFilters = useMemo(() => {
    if (cashEventFilter === "refund") return [];
    const byId = new Map(orders.map((order) => [order.id, order]));
    return projection.historicalDateUnknownReceipts.filter((receipt) => {
      const order = byId.get(receipt.orderId);
      return order !== undefined
        && matchesFinancialSearch(cashSearch, order.clientName, order.id)
        && (cashOperationalFilter === "all" || order.orderStatus === cashOperationalFilter);
    });
  }, [cashEventFilter, cashOperationalFilter, cashSearch, orders, projection.historicalDateUnknownReceipts]);

  const orderTotals = useMemo(() => {
    const selectedBalances = visibleOrders.map((order) => balancesByOrderId.get(order.id));
    const definitive = selectedBalances.filter((balance) => balance?.balanceCents !== null && balance !== undefined);
    const validTotalCents = visibleOrders.flatMap((order) => {
      const totalCents = orderTotalCentsById.get(order.id);
      return totalCents === undefined ? [] : [totalCents];
    });
    return {
      totalOrdersCents: sumMoneyCents(validTotalCents),
      balanceCents: definitive.reduce((sum, balance) => sum + (balance?.balanceCents ?? 0), 0),
      conclusiveCount: definitive.length,
      inconclusiveCount: visibleOrders.length - definitive.length,
      ordersWithoutValidTotal: visibleOrders.length - validTotalCents.length,
    };
  }, [balancesByOrderId, orderTotalCentsById, visibleOrders]);

  const cashTotals = useMemo(() => {
    const receipts = visibleCashEvents.filter((event) => event.kind === "receipt");
    const refunds = visibleCashEvents.filter((event) => event.kind === "refund");
    return {
      receiptsCents: receipts.reduce((sum, event) => sum + event.valueCents, 0),
      refundsCents: refunds.reduce((sum, event) => sum + event.valueCents, 0),
      receiptCount: receipts.length,
      refundCount: refunds.length,
    };
  }, [visibleCashEvents]);

  const unknownDateReceiptCents = sumProjectedReceipts(unknownDateReceiptsMatchingFilters);
  const currentPeriod = view === "orders" ? ordersPeriod : cashPeriod;
  const activeSearch = view === "orders" ? ordersSearch : cashSearch;
  const activeSort = view === "orders" ? ordersSort : cashSort;
  const currentReportTitle = view === "orders" ? "Pedidos e saldos" : "Movimentações de caixa";
  const reportQueryError = ordersError || (storeProfileUnavailable ? "perfil da loja indisponível" : "");

  function updatePeriod(field: keyof FinancialControlPeriod, value: string) {
    const update = (period: FinancialControlPeriod) => ({ ...period, [field]: value });
    if (view === "orders") setOrdersPeriod(update);
    else setCashPeriod(update);
  }

  function printReport() {
    const report = document.querySelector<HTMLElement>(".financial-report-print");
    setPrintError(!report || !openFinancialReportPrintWindow(report.outerHTML, currentReportTitle));
  }

  return (
    <div className="page-stack financial-control-page">
      <PageHeader
        title="Controle Financeiro"
        description="Consulte a posição atual dos Pedidos e os movimentos efetivos de caixa por período."
        action={<Button type="button" variant="secondary" onClick={printReport} disabled={!canPrintFinancialReport(loadingOrders || storeProfileLoading, reportQueryError, currentPeriod)}><FileText size={16} /> Imprimir A4</Button>}
      />
      {printError && <p className="financial-control-error" role="alert">Não foi possível abrir o relatório. Permita pop-ups para imprimir.</p>}

      <div className="financial-control-tabs" role="group" aria-label="Visão financeira">
        <button type="button" aria-pressed={view === "orders"} className={view === "orders" ? "active" : ""} onClick={() => setView("orders")}>Pedidos e saldos</button>
        <button type="button" aria-pressed={view === "cash"} className={view === "cash" ? "active" : ""} onClick={() => setView("cash")}>Movimentações de caixa</button>
      </div>

      <Card className="financial-control-panel">
        <div className="financial-control-toolbar">
          <label className="financial-control-field">De<input type="date" value={currentPeriod.from} max={currentPeriod.through} onChange={(event) => updatePeriod("from", event.target.value)} /></label>
          <label className="financial-control-field">Até<input type="date" value={currentPeriod.through} min={currentPeriod.from} onChange={(event) => updatePeriod("through", event.target.value)} /></label>
          <label className="financial-control-field financial-control-search">Buscar cliente ou Pedido<input type="search" value={activeSearch} placeholder="Nome ou número do Pedido" onChange={(event) => view === "orders" ? setOrdersSearch(event.target.value) : setCashSearch(event.target.value)} /></label>
          {view === "orders" ? <>
            <label className="financial-control-field">Situação financeira<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}><option value="all">Todas</option><option value="unpaid">A pagar</option><option value="partial">Parcial</option><option value="paid">Pago</option><option value="inconclusive">Inconclusiva</option></select></label>
            <label className="financial-control-field">Situação operacional<select value={ordersOperationalFilter} onChange={(event) => setOrdersOperationalFilter(event.target.value as OperationalFilter)}><option value="all">Todas</option><option value="active">Ativo</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label>
          </> : <>
            <label className="financial-control-field">Movimento<select value={cashEventFilter} onChange={(event) => setCashEventFilter(event.target.value as CashEventFilter)}><option value="all">Entradas e devoluções</option><option value="receipt">Recebimentos</option><option value="refund">Devoluções efetivas</option></select></label>
            <label className="financial-control-field">Situação operacional<select value={cashOperationalFilter} onChange={(event) => setCashOperationalFilter(event.target.value as OperationalFilter)}><option value="all">Todas</option><option value="active">Ativo</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></label>
          </>}
          <label className="financial-control-field">Ordenar por<select value={activeSort} onChange={(event) => view === "orders" ? setOrdersSort(event.target.value as FinancialControlSort) : setCashSort(event.target.value as FinancialControlSort)}><option value="date">Data</option><option value="client">Cliente</option><option value="value">Valor</option></select></label>
        </div>
        <p className="financial-control-criteria">{view === "orders" ? "Critério: data de criação do Pedido. Os valores de saldo são a posição atual, não o fechamento histórico do período." : "Critério: data efetiva do recebimento (receivedAt) ou da devolução (refundedAt). Crédito não representa entrada ou saída de dinheiro."}</p>
      </Card>

      {loadingOrders && <p className="empty-state">Carregando dados financeiros…</p>}
      {!loadingOrders && ordersError && <p className="financial-control-error">Não foi possível carregar os Pedidos: {ordersError}</p>}

      {!loadingOrders && !ordersError && view === "orders" && <>
        <div className="financial-control-metrics">
          <Card><span>Pedidos selecionados</span><strong>{visibleOrders.length}</strong></Card>
          <Card><span>Total dos Pedidos identificados</span><strong>{formatCurrencyBR(orderTotals.totalOrdersCents / 100)}</strong><small>{orderTotals.ordersWithoutValidTotal} com total inválido não incluído</small></Card>
          <Card><span>Saldo atual identificado</span><strong>{formatCurrencyBR(orderTotals.balanceCents / 100)}</strong><small>{orderTotals.conclusiveCount} conclusivo(s); {orderTotals.inconclusiveCount} sem saldo conclusivo</small></Card>
        </div>
        {ordersWithoutCreationDate.length > 0 && <p className="financial-control-note">{ordersWithoutCreationDate.length} Pedido(s) sem data de criação não entram no intervalo selecionado.</p>}
        <Card className="financial-control-table-card"><div className="financial-control-table-wrap"><table className="financial-control-table"><thead><tr><th>Data de criação</th><th>Cliente</th><th>Operacional</th><th>Financeiro</th><th>Total</th><th>Recebido</th><th>Crédito aplicado</th><th>Crédito gerado</th><th>Saldo atual</th></tr></thead><tbody>
          {visibleOrders.map((order) => {
            const balance = balancesByOrderId.get(order.id);
            const createdOn = getOrderCreationDate(order);
            const reconciledOrder = reconciledOrdersById.get(order.id);
            const totalCents = orderTotalCentsById.get(order.id);
            return <tr key={order.id}><td>{createdOn ? formatCivilDate(createdOn) : "Data desconhecida"}</td><td>{order.clientName}</td><td>{getOrderStatusLabel(order.orderStatus)}</td><td>{balance?.paymentStatus ? getPaymentStatusLabel(balance.paymentStatus) : "Inconclusivo"}</td><td>{totalCents === undefined ? "Inconclusivo" : formatCurrencyBR(totalCents / 100)}</td><td>{reconciledOrder?.cashPaidCents === null || reconciledOrder?.cashPaidCents === undefined ? "Inconclusivo" : formatCurrencyBR(reconciledOrder.cashPaidCents / 100)}</td><td>{balance?.creditAppliedCents === null || balance?.creditAppliedCents === undefined ? "Inconclusivo" : formatCurrencyBR(balance.creditAppliedCents / 100)}</td><td>{balance?.creditGeneratedCents === null || balance?.creditGeneratedCents === undefined ? "Inconclusivo" : formatCurrencyBR(balance.creditGeneratedCents / 100)}</td><td>{balance?.balanceCents === null || balance?.balanceCents === undefined ? "Inconclusivo" : formatCurrencyBR(balance.balanceCents / 100)}</td></tr>;
          })}
        </tbody></table></div>{visibleOrders.length === 0 && <p className="empty-state">Nenhum Pedido corresponde ao período e aos filtros.</p>}</Card>
      </>}

      {!loadingOrders && !ordersError && view === "cash" && <>
        <div className="financial-control-metrics">
          <Card><span>Recebimentos no filtro</span><strong>{formatCurrencyBR(cashTotals.receiptsCents / 100)}</strong><small>{cashTotals.receiptCount} movimento(s); somente datas conhecidas</small></Card>
          <Card><span>Devoluções efetivas</span><strong>{formatCurrencyBR(cashTotals.refundsCents / 100)}</strong><small>{cashTotals.refundCount} saída(s); promessa não contabilizada</small></Card>
          <Card><span>Movimento líquido</span><strong>{formatCurrencyBR((cashTotals.receiptsCents - cashTotals.refundsCents) / 100)}</strong><small>Entradas menos devoluções efetivas</small></Card>
        </div>
        {unknownDateReceiptsMatchingFilters.length > 0 && <p className="financial-control-note">Há {unknownDateReceiptsMatchingFilters.length} recebimento(s), totalizando {formatCurrencyBR(unknownDateReceiptCents / 100)}, com data histórica desconhecida e correspondentes aos demais filtros. Eles não entram em nenhum período nem no total acima.</p>}
        <Card className="financial-control-table-card"><div className="financial-control-table-wrap"><table className="financial-control-table"><thead><tr><th>Data efetiva</th><th>Cliente</th><th>Movimento</th><th>Operacional</th><th>Valor</th></tr></thead><tbody>
          {visibleCashEvents.map((event) => <tr key={event.id}><td>{formatDate(event.date)}</td><td>{event.clientName}</td><td>{event.kind === "receipt" ? "Recebimento" : "Devolução efetiva"}</td><td>{getOrderStatusLabel(event.orderStatus)}</td><td className={event.kind === "refund" ? "financial-control-outflow" : ""}>{event.kind === "refund" ? "− " : "+ "}{formatCurrencyBR(event.valueCents / 100)}</td></tr>)}
        </tbody></table></div>{visibleCashEvents.length === 0 && <p className="empty-state">Nenhuma movimentação efetiva corresponde ao período e aos filtros.</p>}</Card>
      </>}

      {!loadingOrders && !ordersError && projection.reconciliation.summary.humanInterventionRequired > 0 && <p className="financial-control-note">No conjunto carregado, a reconciliação identificou {projection.reconciliation.summary.humanInterventionRequired} registro(s) que exigem revisão; esse diagnóstico pode incluir dados fora dos filtros atuais. Valores sem conclusão não são apresentados como saldos definitivos.</p>}

      <section className="financial-report-print" aria-hidden="true">
        <header className="financial-report-header"><div><h1>{storeProfile.displayName || "Identificação da loja indisponível"}</h1>{storeProfile.taxId && <p>{storeProfile.taxId}</p>}{storeProfile.phone && <p>{storeProfile.phone}</p>}</div><div className="financial-report-title"><h2>Relatório financeiro</h2><strong>{currentReportTitle}</strong></div></header>
        {storeProfileUnavailable && <p>O perfil da loja não pôde ser carregado.</p>}
        <p><strong>Período:</strong> {periodLabel(currentPeriod)}</p>
        <p><strong>Critério:</strong> {view === "orders" ? "data de criação do Pedido; saldo na posição atual" : "receivedAt para recebimentos e refundedAt para devoluções efetivas"}</p>
        <p><strong>Filtros:</strong> busca “{activeSearch || "todos"}”; ordenação por {activeSort}; {view === "orders" ? `situação operacional ${ordersOperationalFilter}, financeira ${paymentFilter}` : `movimento ${cashEventFilter}, situação operacional ${cashOperationalFilter}`}</p>
        {view === "orders" ? <>
          <table className="financial-report-table"><thead><tr><th>Data criação</th><th>Cliente</th><th>Operacional</th><th>Financeiro</th><th>Total</th><th>Recebido</th><th>Crédito aplicado</th><th>Crédito gerado</th><th>Saldo atual</th></tr></thead><tbody>{visibleOrders.length === 0 ? <tr><td colSpan={9}>Nenhum Pedido corresponde à seleção.</td></tr> : visibleOrders.map((order) => { const balance = balancesByOrderId.get(order.id); const reconciledOrder = reconciledOrdersById.get(order.id); const totalCents = orderTotalCentsById.get(order.id); const createdOn = getOrderCreationDate(order); return <tr key={order.id}><td>{createdOn ? formatCivilDate(createdOn) : "Desconhecida"}</td><td>{order.clientName}</td><td>{getOrderStatusLabel(order.orderStatus)}</td><td>{balance?.paymentStatus ? getPaymentStatusLabel(balance.paymentStatus) : "Inconclusivo"}</td><td>{totalCents === undefined ? "Inconclusivo" : formatCurrencyBR(totalCents / 100)}</td><td>{reconciledOrder?.cashPaidCents == null ? "Inconclusivo" : formatCurrencyBR(reconciledOrder.cashPaidCents / 100)}</td><td>{balance?.creditAppliedCents == null ? "Inconclusivo" : formatCurrencyBR(balance.creditAppliedCents / 100)}</td><td>{balance?.creditGeneratedCents == null ? "Inconclusivo" : formatCurrencyBR(balance.creditGeneratedCents / 100)}</td><td>{balance?.balanceCents == null ? "Inconclusivo" : formatCurrencyBR(balance.balanceCents / 100)}</td></tr>; })}</tbody></table>
          {ordersWithoutCreationDate.length > 0 && <p>Pedidos sem data de criação fora deste intervalo: {ordersWithoutCreationDate.length}.</p>}
          <p className="financial-report-total">Total identificado dos Pedidos: {formatCurrencyBR(orderTotals.totalOrdersCents / 100)} · total inválido excluído: {orderTotals.ordersWithoutValidTotal} · saldo atual identificado: {formatCurrencyBR(orderTotals.balanceCents / 100)} · saldos inconclusivos: {orderTotals.inconclusiveCount}</p>
        </> : <>
          <table className="financial-report-table"><thead><tr><th>Data efetiva</th><th>Cliente</th><th>Movimento</th><th>Situação operacional</th><th>Valor</th></tr></thead><tbody>{visibleCashEvents.length === 0 ? <tr><td colSpan={5}>Nenhuma movimentação corresponde à seleção.</td></tr> : visibleCashEvents.map((event) => <tr key={event.id}><td>{formatDate(event.date)}</td><td>{event.clientName}</td><td>{event.kind === "receipt" ? "Recebimento" : "Devolução efetiva"}</td><td>{getOrderStatusLabel(event.orderStatus)}</td><td>{event.kind === "refund" ? "− " : "+ "}{formatCurrencyBR(event.valueCents / 100)}</td></tr>)}</tbody></table>
          <p className="financial-report-total">Recebimentos: {formatCurrencyBR(cashTotals.receiptsCents / 100)} · Devoluções: {formatCurrencyBR(cashTotals.refundsCents / 100)} · líquido: {formatCurrencyBR((cashTotals.receiptsCents - cashTotals.refundsCents) / 100)}</p>
          {unknownDateReceiptsMatchingFilters.length > 0 && <p>Recebimentos correspondentes aos demais filtros, fora do período por data desconhecida: {unknownDateReceiptsMatchingFilters.length} ({formatCurrencyBR(unknownDateReceiptCents / 100)}).</p>}
        </>}
        <footer className="financial-report-footer">Emitido em {new Date().toLocaleString("pt-BR")} · {storeProfile.displayName || "Loja"}</footer>
      </section>
    </div>
  );
}
