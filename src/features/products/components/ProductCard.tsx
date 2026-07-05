import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Switch } from "../../../components/ui/Switch";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../productTypes";

interface ProductCardProps {
  product: Product;
  onRequestViewProduct: (product: Product) => void;
  onRequestEditProduct: (product: Product) => void;
  onActiveChange: (product: Product, active: boolean) => Promise<void>;
}

export function ProductCard({ product, onRequestViewProduct, onRequestEditProduct, onActiveChange }: ProductCardProps) {
  return (
    <Card className={!product.active ? "muted-card clickable-card" : "clickable-card"} onClick={() => onRequestViewProduct(product)} role="button" tabIndex={0}>
      <div className="client-card-header">
        <div>
          <h2>{product.name}</h2>
          <p>{product.categoryLabel || "Sem categoria definida"}</p>
        </div>
      </div>

      <div className="client-meta">
        <span>Unidade: {product.unit || "Não definida"}</span>
        <span>Preço sugerido: {formatCurrencyBR(product.suggestedPrice)}</span>
      </div>

      <div className="badge-row">
        {!product.categoryId && <Badge>sem-categoria</Badge>}
        {!product.suggestedPrice && <Badge>sem-preco</Badge>}
        {!product.unit && <Badge>sem-unidade</Badge>}

        {product.categoryLabel && <Badge>{product.categoryLabel}</Badge>}

        {product.tagIds?.slice(0, 3).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      {product.notes && (
        <div className="notes-preview product-notes-preview">
          <span>Observações</span>
          <p>{product.notes}</p>
        </div>
      )}

      <div className="card-actions">
        <Button type="button" variant="secondary" onClick={(event) => {
          event.stopPropagation();
          onRequestEditProduct(product);
        }}>
          Editar produto
        </Button>

        <Button type="button" variant="ghost" onClick={(event) => event.stopPropagation()}>
          Usar em pedido
        </Button>
      </div>

      <div className="card-footer" onClick={(event) => event.stopPropagation()}>
        <Switch label="Produto ativo" checked={product.active} onChange={(checked) => onActiveChange(product, checked)} />
      </div>
    </Card>
  );
}
