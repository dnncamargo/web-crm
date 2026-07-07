import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { useAddresses } from "../addresses/useAddresses";
import { useClients } from "../clients/useClients";
import { useProducts } from "../products/useProducts";
import { useTags } from "../tags/useTags";
import { OrderCalendarView } from "./components/OrderCalendarView";
import { OrderCard } from "./components/OrderCard";
import { OrderForm } from "./components/OrderForm";
import { OrderListView } from "./components/OrderListView";
import type { NewOrderData, Order } from "./orderTypes";
import { getPaymentStatus } from "./orderUtils";
import { useOrders } from "./useOrders";
import { OrderDetailsPanelContent } from "./components/OrderDetailsPanelContent";

type OrderPanelState = { type: "create-order" } | { type: "edit-order"; order: Order } | { type: "view-order"; order: Order } | null;

type OrderViewMode = "cards" | "list" | "calendar";

type OrderPaymentFilter = "all" | "unpaid" | "partial" | "paid";

type OrderSortMode = "deliveryDateTime" | "clientName" | "total";

export function OrdersPage() {
  const { orders, filteredOrders, showOnlyActive, setShowOnlyActive, loadingOrders, ordersError, addOrder, editOrder } = useOrders();

  const { filteredClients, loading: loadingClients, error: clientsError, editClient } = useClients();

  const { activeAddresses, addressesError, addAddress } = useAddresses();

  const { products, loadingProducts, productsError } = useProducts();
  const { activeTags } = useTags();

  const [panel, setPanel] = useState<OrderPanelState>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<OrderViewMode>("list");
  const [paymentFilter, setPaymentFilter] = useState<OrderPaymentFilter>("all");
  const [sortBy, setSortBy] = useState<OrderSortMode>("deliveryDateTime");
  const [stackedEditOrder, setStackedEditOrder] = useState<Order | null>(null);
  const [orderFormIsDirty, setOrderFormIsDirty] = useState(false);
  const [stackedOrderFormIsDirty, setStackedOrderFormIsDirty] = useState(false);

  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);

  const orderItemTags = useMemo(
    () =>
      activeTags.filter((tag) => {
        const isAvailableForOrderItem = tag.entity === "product" || tag.entity === "order" || tag.entity === "global";

        const isProductCategory = tag.entity === "product" && tag.group === "Categoria";

        return isAvailableForOrderItem && !isProductCategory;
      }),
    [activeTags],
  );

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
    setStackedEditOrder(null);
    setOrderFormIsDirty(false);
  }

  function requestCloseOrderFormPanel() {
    if (!orderFormIsDirty) {
      closePanel();
      return;
    }

    const shouldClose = window.confirm("Você tem informações não salvas neste pedido. Deseja fechar mesmo assim?");

    if (shouldClose) {
      closePanel();
    }
  }

  function requestCloseStackedOrderFormPanel() {
    if (!stackedOrderFormIsDirty) {
      setStackedEditOrder(null);
      return;
    }

    const shouldClose = window.confirm("Você tem alterações não salvas neste pedido. Deseja fechar mesmo assim?");

    if (shouldClose) {
      setStackedEditOrder(null);
      setStackedOrderFormIsDirty(false);
    }
  }

  async function registerOrderInteraction(data: NewOrderData) {
    const now = new Date().toISOString();

    await editClient(data.clientId, {
      lastInteractionAt: now,
      lastOrderAt: now,
      lastInteractionType: "pedido",
    });
  }

  async function handleCreateOrder(data: NewOrderData) {
    await addOrder(data);
    await registerOrderInteraction(data);
    closePanel();
  }

  async function handleEditOrder(data: NewOrderData) {
    if (!panel || panel.type !== "edit-order") {
      return;
    }

    await editOrder(panel.order.id, data);

    if (panel.order.clientId !== data.clientId) {
      await registerOrderInteraction(data);
    }

    closePanel();
  }

  async function handleStackedEditOrder(data: NewOrderData) {
    if (!stackedEditOrder) {
      return;
    }

    await editOrder(stackedEditOrder.id, data);

    if (stackedEditOrder.clientId !== data.clientId) {
      await registerOrderInteraction(data);
    }

    setStackedEditOrder(null);
    setPanel(null);
  }

  function openViewOrder(selectedOrder: Order) {
    setPanel({ type: "view-order", order: selectedOrder });
  }

  function openEditOrder(selectedOrder: Order) {
    setPanel({ type: "edit-order", order: selectedOrder });
  }

  function openStackedEditOrder(selectedOrder: Order) {
    setStackedEditOrder(selectedOrder);
  }

  const mainPanelSize = panel?.type === "view-order" && stackedEditOrder ? "fullscreen" : panel?.type === "view-order" ? "wide" : "fullscreen";

  return (
    <div className="page-stack">
      <PageHeader
        title="Pedidos"
        description="Registre pedidos com cliente, entrega, itens, pagamento e observações."
        action={
          <div className="header-actions">
            <button
              type="button"
              className={showFilters ? "round-filter-button active" : "round-filter-button"}
              onClick={() => setShowFilters((current) => !current)}
              aria-label="Filtros e ordenações"
            >
              F
            </button>

            <Button type="button" variant="secondary" onClick={() => setPanel({ type: "create-order" })} disabled={loadingDependencies}>
              + Pedido
            </Button>
          </div>
        }
      />
      {showFilters && (
        <Card>
          <div className="toolbar order-toolbar">
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
      )}
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
            <span>Cadastre o primeiro pedido ou ajuste os filtros atuais.</span>
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
      {viewMode === "list" && <OrderListView orders={visibleOrders} onRequestViewOrder={openViewOrder} />}
      {viewMode === "calendar" && <OrderCalendarView orders={calendarOrders} onRequestEditOrder={openViewOrder} />}
      <SlidePanel
        open={panel !== null}
        level={1}
        size={mainPanelSize}
        closeOnBackdrop={panel?.type === "view-order"}
        title={panel?.type === "edit-order" ? "Editar pedido" : panel?.type === "view-order" ? "Detalhes do pedido" : "Adicionar pedido"}
        description={
          panel?.type === "edit-order"
            ? "Atualize os dados deste pedido."
            : panel?.type === "view-order"
              ? "Consulte as informações completas antes de editar."
              : "Registre um novo pedido com dados, itens e pagamento."
        }
        onClose={panel?.type === "view-order" ? closePanel : requestCloseOrderFormPanel}
      >
        {" "}
        {panel?.type === "view-order" && <OrderDetailsPanelContent order={panel.order} onEdit={() => openStackedEditOrder(panel.order)} />}
        {panel?.type === "create-order" && (
          <OrderForm
            orders={orders}
            clients={filteredClients}
            addresses={activeAddresses}
            products={activeProducts}
            itemTags={orderItemTags}
            onCancel={requestCloseOrderFormPanel}
            onSave={handleCreateOrder}
            onCreateAddress={addAddress}
            onDirtyChange={setOrderFormIsDirty}
          />
        )}
        {panel?.type === "edit-order" && (
          <OrderForm
            order={panel.order}
            orders={orders}
            clients={filteredClients}
            addresses={activeAddresses}
            products={activeProducts}
            itemTags={orderItemTags}
            onCancel={requestCloseOrderFormPanel}
            onSave={handleEditOrder}
            onCreateAddress={addAddress}
            onDirtyChange={setOrderFormIsDirty}
          />
        )}
      </SlidePanel>
      <SlidePanel
        open={stackedEditOrder !== null}
        level={2}
        size="fullscreen"
        closeOnBackdrop={false}
        title="Editar pedido"
        description="Edite este pedido mantendo os detalhes visíveis ao fundo."
        onClose={requestCloseStackedOrderFormPanel}
      >
        {stackedEditOrder && (
          <OrderForm
            order={stackedEditOrder}
            orders={orders}
            clients={filteredClients}
            addresses={activeAddresses}
            products={activeProducts}
            itemTags={orderItemTags}
            onCancel={requestCloseStackedOrderFormPanel}
            onSave={handleStackedEditOrder}
            onCreateAddress={addAddress}
            onDirtyChange={setStackedOrderFormIsDirty}
          />
        )}
      </SlidePanel>{" "}
    </div>
  );
}
