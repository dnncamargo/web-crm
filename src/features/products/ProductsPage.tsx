import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function ProductsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Produtos"
        description="Biblioteca de produtos, unidades e preços sugeridos opcionais."
      />

      <Card>
        <div className="empty-state">
          <strong>Produtos ainda não implementados.</strong>
          <span>
            Os produtos poderão ter preço sugerido, mas o preço obrigatório será
            definido no pedido.
          </span>
        </div>
      </Card>
    </div>
  );
}