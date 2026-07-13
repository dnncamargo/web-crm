import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../productTypes";

interface ProductDetailsPanelContentProps {
  product: Product;
  tagLabelsById: Record<string, string>;
  onEdit: () => void;
}

function formatOptionalPrice(value?: number | null) {
  return value ? formatCurrencyBR(value) : "Não informado";
}

export function ProductDetailsPanelContent({
  product,
  tagLabelsById,
  onEdit,
}: ProductDetailsPanelContentProps) {
  return (
    <div className="detail-section">
      <div className="details-grid">
        <div className="detail-block">
          <span>Produto</span>
          <strong>{product.name}</strong>
        </div>

        <div className="detail-block">
          <span>Categoria</span>
          <strong>{product.categoryLabel || "Não definida"}</strong>
        </div>

        <div className="detail-block">
          <span>Unidade</span>
          <strong>{product.unit || "unidade"}</strong>
        </div>

        <div className="detail-block">
          <span>Preço sugerido</span>
          <strong>{formatOptionalPrice(product.suggestedPrice)}</strong>
        </div>

        <div className="detail-block">
          <span>Status</span>
          <strong>{product.active ? "Ativo" : "Inativo"}</strong>
        </div>
      </div>

      <div className="badge-row">
        <Badge>{product.active ? "Ativo" : "Inativo"}</Badge>

        {product.categoryLabel && <Badge>{product.categoryLabel}</Badge>}

        {product.unit && <Badge>{product.unit}</Badge>}
      </div>

      <div className="subtle-list">
        <span>Etiquetas</span>

        {product.tagIds?.length ? (
          product.tagIds.map((tagId) => (
            <small key={tagId}>#{tagLabelsById[tagId] ?? tagId}</small>
          ))
        ) : (
          <small>Nenhuma etiqueta adicional</small>
        )}
      </div>

      {product.notes && (
        <div className="notes-preview">
          <span>Observações</span>
          <p>{product.notes}</p>
        </div>
      )}

      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </div>
  );
}