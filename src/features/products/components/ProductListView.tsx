import { Badge } from "../../../components/ui/Badge";
import { formatCurrencyBR } from "../../../utils/money";
import type { Product } from "../productTypes";

interface ProductListViewProps {
  products: Product[];
  tagLabelsById: Record<string, string>;
  onRequestViewProduct: (product: Product) => void;
}

interface ProductGroup {
  category: string;
  products: Product[];
}

function formatOptionalPrice(value?: number | null) {
  return value ? formatCurrencyBR(value) : "Sem preço";
}

function groupProductsByCategory(products: Product[]): ProductGroup[] {
  const groups = new Map<string, Product[]>();

  products.forEach((product) => {
    const category = product.categoryLabel || "Sem categoria";
    groups.set(category, [...(groups.get(category) ?? []), product]);
  });

  return Array.from(groups.entries())
    .map(([category, groupedProducts]) => ({
      category,
      products: groupedProducts.sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name)),
    }))
    .sort((firstGroup, secondGroup) => firstGroup.category.localeCompare(secondGroup.category));
}

export function ProductListView({ products, tagLabelsById, onRequestViewProduct }: ProductListViewProps) {
  const productsByCategory = groupProductsByCategory(products);
  return (
    <div className="entity-list-groups">
      {productsByCategory.map((group) => (
        <section className="entity-list-group" key={group.category}>
          <header>
            <strong>{group.category}</strong>
            <span>{group.products.length}</span>
          </header>

          <div className="entity-list-view">
            {group.products.map((product) => {
              const visibleTags = (product.tagIds ?? []).slice(0, 5);

              return (
                <button type="button" className={!product.active ? "entity-row muted-card" : "entity-row"} key={product.id} onClick={() => onRequestViewProduct(product)}>
                  <div className="entity-row-line">
                    <strong className="entity-title">{product.name}</strong>

                    <small className="entity-value">{formatOptionalPrice(product.suggestedPrice)}</small>
                  </div>

                  <div className="entity-row-line">
                    <div className="entity-badges">
                      {!product.active && <Badge>Inativo</Badge>}

                      {visibleTags.length ? visibleTags.map((tagId) => <Badge key={tagId}>#{tagLabelsById[tagId] ?? tagId}</Badge>) : <Badge>sem-etiquetas</Badge>}
                    </div>

                    <small className="entity-subtitle">{product.unit || "unidade"}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
