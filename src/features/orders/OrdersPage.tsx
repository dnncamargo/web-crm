import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function OrdersPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Pedidos"
        description="Lista, calendário, pagamentos e entregas ficarão aqui."
      />

      <Card>
        <div className="empty-state">
          <strong>Pedidos ainda não implementados.</strong>
          <span>
            Depois dos clientes, criaremos o fluxo de pedido com itens,
            pagamento parcial e entrega.
          </span>
        </div>
      </Card>
    </div>
  );
}