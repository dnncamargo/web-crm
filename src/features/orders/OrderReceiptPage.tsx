import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { useProducts } from "../products/useProducts";
import { OrderReceipt } from "./components/OrderReceipt";
import { useOrders } from "./useOrders";

export function OrderReceiptPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { products, loadingProducts, productsError } = useProducts();
  const { orders, loadingOrders, ordersError } = useOrders(products);

  const order = orders.find((candidate) => candidate.id === orderId);
  const loading = loadingOrders || loadingProducts;

  return (
    <main className="receipt-page">
      {order && (
        <div className="receipt-toolbar" aria-label="Ações do recibo">
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar
          </Button>
          <Button type="button" onClick={() => window.print()}>
            Imprimir
          </Button>
        </div>
      )}

      {loading && <p className="receipt-state">Carregando pedido...</p>}
      {!loading && ordersError && <p className="receipt-state receipt-state-error">{ordersError}</p>}
      {!loading && productsError && <p className="receipt-state receipt-state-error">{productsError}</p>}
      {!loading && !ordersError && !productsError && !order && (
        <section className="receipt-state">
          <h1>Pedido não encontrado</h1>
          <p>Não foi possível localizar este pedido.</p>
          <Button type="button" variant="secondary" onClick={() => navigate("/pedidos")}>
            Voltar para pedidos
          </Button>
        </section>
      )}

      {order && <OrderReceipt order={order} products={products} />}
    </main>
  );
}
