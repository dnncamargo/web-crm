import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { useAddresses } from "../addresses/useAddresses";
import { useClients } from "../clients/useClients";
import { useProducts } from "../products/useProducts";
import { OrderCalendarView } from "./components/OrderCalendarView";
import { OrderCard } from "./components/OrderCard";
import { OrderForm } from "./components/OrderForm";
import { OrderListView } from "./components/OrderListView";
import type { NewOrderData, Order } from "./orderTypes";
import { getPaymentStatus } from "./orderUtils";
import { useOrders } from "./useOrders";

type OrderPanelState = { type: "create-order" } | { type: "edit-order"; order: Order } | null;

type OrderViewMode = "cards" | "list" | "calendar";

type OrderPaymentFilter = "all" | "unpaid" | "partial" | "paid";

type OrderSortMode = "deliveryDateTime" | "clientName" | "total";

export function OrdersPage() {
  const { filteredOrders, search, setSearch, showOnlyActive, setShowOnlyActive, loadingOrders, ordersError, addOrder, editOrder } = useOrders();

  const { filteredClients, loading: loadingClients, error: clientsError } = useClients();

  const { activeAddresses, addressesError } = useAddresses();

  const { products, loadingProducts, productsError } = useProducts();

  const [panel, setPanel] = useState<OrderPanelState>(null);
  const [viewMode, setViewMode] = useState<OrderViewMode>("list");
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentFilter>("all");
  const [sortBy, setSortBy] = useState<OrderSortMode>("deliveryDateTime");

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const visibleOrders = useMemo(() => {
    const filteredByPayment = filteredOrders.filter((order) => {
      if (paymentFilter === "all") {
        return true;
      }

      return getPaymentStatus(order) === paymentFilter;
    });

    return [...filteredByPayment].sort((firstOrder, secondOrder) => {
      if (sortBy === "clientName") {
        return firstOrder.clientName.localeCompare(secondOrder.clientName);
      }

      if (sortBy === "total") {
        return secondOrder.total - firstOrder.total;
      }

      return firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime);
    });
  }, [filteredOrders, paymentFilter, sortBy]);

  const calendarOrders = useMemo(() => {
    return filteredOrders.filter((order) => {
      if (paymentFilter === "all") {
        return true;
      }

      return getPaymentStatus(order) === paymentFilter;
    });
  }, [filteredOrders, paymentFilter]);

  const loadingDependencies = loadingClients || loadingProducts;

  function closePanel() {
    setPanel(null);
  }

  async function handleCreateOrder(data: NewOrderData) {
    await addOrder(data);
    closePanel();
  }

  async function handleEditOrder(data: NewOrderData) {
    if (!panel || panel.type !== "edit-order") {
      return;
    }

    await editOrder(panel.order.id, data);
    closePanel();
  }

  function openEditOrder(selectedOrder: Order) {
    setPanel({ type: "edit-order", order: selectedOrder });
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Pedidos"
        description="Registre pedidos com cliente, entrega, itens, pagamento e observações."
        action={
          <Button type="button" variant="secondary" onClick={() => setPanel({ type: "create-order" })} disabled={loadingDependencies}>
            + Pedido
          </Button>
        }
      />

      <Card>
        <div className="toolbar order-toolbar">
          <input className="local-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, produto, endereço ou observação..." />

          <div className="segmented-control">
            <button type="button" className={viewMode === "cards" ? "active" : ""} onClick={() => setViewMode("cards")}>
              Cards
            </button>

            <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
              Lista
            </button>

            <button type="button" className={viewMode === "calendar" ? "active" : ""} onClick={() => setViewMode("calendar")}>
              Calendário
            </button>
          </div>

          <select className="toolbar-select" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as OrderPaymentFilter)}>
            <option value="all">Todos os pagamentos</option>
            <option value="unpaid">A pagar</option>
            <option value="partial">Parcial</option>
            <option value="paid">Pago</option>
          </select>

          {viewMode !== "calendar" && (
            <select className="toolbar-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as OrderSortMode)}>
              <option value="deliveryDateTime">Ordenar por entrega</option>
              <option value="clientName">Ordenar por cliente</option>
              <option value="total">Ordenar por valor</option>
            </select>
          )}

          <button type="button" className={showOnlyActive ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyActive(!showOnlyActive)}>
            Ativos
          </button>
        </div>
      </Card>

      {loadingOrders && <p className="muted-text">Carregando pedidos...</p>}

      {loadingDependencies && <p className="muted-text">Carregando clientes e produtos...</p>}

      {ordersError && <p className="error-text">{ordersError}</p>}
      {clientsError && <p className="error-text">{clientsError}</p>}
      {addressesError && <p className="error-text">{addressesError}</p>}
      {productsError && <p className="error-text">{productsError}</p>}

      {!loadingOrders && visibleOrders.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhum pedido encontrado.</strong>
            <span>Cadastre o primeiro pedido ou ajuste a busca/filtros atuais.</span>
          </div>
        </Card>
      )}

      {viewMode === "cards" && (
        <div className="cards-grid">
          {visibleOrders.map((order) => (
            <OrderCard key={order.id} order={order} onRequestEditOrder={openEditOrder} />
          ))}
        </div>
      )}

      {viewMode === "list" && <OrderListView orders={visibleOrders} onRequestEditOrder={openEditOrder} />}

      {viewMode === "calendar" && <OrderCalendarView orders={calendarOrders} onRequestEditOrder={openEditOrder} />}

      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-order" ? "Editar pedido" : "Adicionar pedido"}
        description={panel?.type === "edit-order" ? "Atualize os dados deste pedido." : "Registre um novo pedido com entrega, itens e pagamento."}
        onClose={closePanel}
      >
        {panel?.type === "create-order" && <OrderForm clients={filteredClients} addresses={activeAddresses} products={activeProducts} onCancel={closePanel} onSave={handleCreateOrder} />}

        {panel?.type === "edit-order" && (
          <OrderForm order={panel.order} clients={filteredClients} addresses={activeAddresses} products={activeProducts} onCancel={closePanel} onSave={handleEditOrder} />
        )}
      </SlidePanel>
    </div>
  );
}
