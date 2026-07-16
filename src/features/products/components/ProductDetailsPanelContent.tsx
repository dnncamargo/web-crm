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

export function ProductDetailsPanelContent({ product, tagLabelsById, onEdit }: ProductDetailsPanelContentProps) {
  const tagLabels = product.tagIds?.map((tagId) => (tagLabelsById[tagId] ?? tagId).replace(/^#+/, "")) ?? [];

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-2">
        <section className="panel-column panel-column-scroll is-plain">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Resumo do produto</span>
              <small>Identificação, classificação e preço.</small>
            </div>

            <div className="compact-summary-box panel-details-summary">
              <span>
                Produto: <strong>{product.name}</strong>
              </span>
              <span>
                Categoria: <strong>{product.categoryLabel || "Não definida"}</strong>
              </span>
              <span>
                Unidade: <strong>{product.unit || "unidade"}</strong>
              </span>
              <span>
                Preço sugerido: <strong>{formatOptionalPrice(product.suggestedPrice)}</strong>
              </span>
              <span className="summary-full">
                Status: <strong>{product.active ? "Ativo" : "Inativo"}</strong>
              </span>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-section-title">
              <span>Marcadores</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              <Badge>{product.active ? "Ativo" : "Inativo"}</Badge>
              {product.categoryLabel && <Badge>{product.categoryLabel}</Badge>}
              {product.unit && <Badge>{product.unit}</Badge>}
            </div>
          </section>
        </section>

        <section className="panel-column panel-column-scroll">
          <section className="panel-section">
            <div className="panel-section-title">
              <span>Etiquetas</span>
            </div>

            <div className="panel-badges panel-badges-visible">
              {tagLabels.length ? tagLabels.map((label) => <Badge key={label}>{label}</Badge>) : <Badge>Sem etiquetas</Badge>}
            </div>
          </section>

          {product.notes && (
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Observações</span>
              </div>

              <div className="panel-note">
                <p>{product.notes}</p>
              </div>
            </section>
          )}
        </section>
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          <Button type="button" variant="primary" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
