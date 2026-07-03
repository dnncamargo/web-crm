import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { useAddresses } from "../addresses/useAddresses";
import { useClients } from "../clients/useClients";
import { useProducts } from "../products/useProducts";
import { OrderCard } from "./components/OrderCard";
import { OrderForm } from "./components/OrderForm";
import type { NewOrderData, Order } from "./orderTypes";
import { useOrders } from "./useOrders";

type OrderPanelState =
  | { type: "create-order" }
  | { type: "edit-order"; order: Order }
  | null;

export function OrdersPage() {
  const {
    filteredOrders,
    search,
    setSearch,
    showOnlyActive,
    setShowOnlyActive,
    loadingOrders,
    ordersError,
    addOrder,
    editOrder,
  } = useOrders();

  const {
    filteredClients,
    loading: loadingClients,
    error: clientsError,
  } = useClients();

  const { activeAddresses, addressesError } = useAddresses();

  const {
    products,
    loadingProducts,
    productsError,
  } = useProducts();

  const [panel, setPanel] = useState<OrderPanelState>(null);

  const activeProducts = useMemo(
    () => products.filter((product) => product.active),
    [products]
  );

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

  const loadingDependencies = loadingClients || loadingProducts;

  return (
    <div className="page-stack">
      <PageHeader
        title="Pedidos"
        description="Registre pedidos com cliente, entrega, itens, pagamento e observações."
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPanel({ type: "create-order" })}
            disabled={loadingDependencies}
          >
            + Pedido
          </Button>
        }
      />

      <Card>
        <div className="toolbar">
          <input
            className="local-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, produto, endereço ou observação..."
          />

          <button
            type="button"
            className={showOnlyActive ? "filter-pill active" : "filter-pill"}
            onClick={() => setShowOnlyActive(!showOnlyActive)}
          >
            Ativos
          </button>
        </div>
      </Card>

      {loadingOrders && <p className="muted-text">Carregando pedidos...</p>}

      {loadingDependencies && (
        <p className="muted-text">Carregando clientes e produtos...</p>
      )}

      {ordersError && <p className="error-text">{ordersError}</p>}
      {clientsError && <p className="error-text">{clientsError}</p>}
      {addressesError && <p className="error-text">{addressesError}</p>}
      {productsError && <p className="error-text">{productsError}</p>}

      {!loadingOrders && filteredOrders.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhum pedido encontrado.</strong>
            <span>
              Cadastre o primeiro pedido quando tiver ao menos um cliente e um
              produto.
            </span>
          </div>
        </Card>
      )}

      <div className="cards-grid">
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onRequestEditOrder={(selectedOrder) =>
              setPanel({ type: "edit-order", order: selectedOrder })
            }
          />
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-order" ? "Editar pedido" : "Adicionar pedido"}
        description={
          panel?.type === "edit-order"
            ? "Atualize os dados deste pedido."
            : "Registre um novo pedido com entrega, itens e pagamento."
        }
        onClose={closePanel}
      >
        {panel?.type === "create-order" && (
          <OrderForm
            clients={filteredClients}
            addresses={activeAddresses}
            products={activeProducts}
            onCancel={closePanel}
            onSave={handleCreateOrder}
          />
        )}

        {panel?.type === "edit-order" && (
          <OrderForm
            order={panel.order}
            clients={filteredClients}
            addresses={activeAddresses}
            products={activeProducts}
            onCancel={closePanel}
            onSave={handleEditOrder}
          />
        )}
      </SlidePanel>
    </div>
  );
}