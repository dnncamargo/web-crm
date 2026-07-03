import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function TagsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Etiquetas"
        description="Badges e hashtags personalizáveis para clientes, pedidos, produtos e tarefas."
      />

      <Card>
        <div className="empty-state">
          <strong>Etiquetas ainda não implementadas.</strong>
          <span>
            Esta área controlará etiquetas como sem lactose, favorito,
            festa infantil, bolo gelado e outras.
          </span>
        </div>
      </Card>
    </div>
  );
}