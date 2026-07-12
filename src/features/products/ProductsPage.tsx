import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { ProductForm } from "./components/ProductForm";
import { formatCurrencyBR } from "../../utils/money";
import type { NewProductData, Product } from "./productTypes";
import { useProducts } from "./useProducts";
import { useTags } from "../tags/useTags";
import { isProductStructuralGroup } from "../tags/tagConfig";

type ProductPanelState = { type: "create-product" } | { type: "view-product"; product: Product } | null;

export function ProductsPage() {
  const { filteredProducts, showOnlyActive, setShowOnlyActive, loadingProducts, productsError, addProduct, editProduct } = useProducts();

  const [panel, setPanel] = useState<ProductPanelState>(null);
  const [stackedEditProduct, setStackedEditProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { activeTags, getTagsByEntityAndGroup } = useTags();

  const productCategories = getTagsByEntityAndGroup("product", "Categoria");

  const productUnits = getTagsByEntityAndGroup("product", "Unidade de venda");

  const productAvailableTags = useMemo(
    () =>
      activeTags.filter((tag) => {
        const isProductOrGlobalTag = tag.entity === "product" || tag.entity === "global";

        const isStructuredProductTag = tag.entity === "product" && isProductStructuralGroup(tag.group);

        return isProductOrGlobalTag && !isStructuredProductTag;
      }),
    [activeTags],
  );

  function closePanel() {
    setPanel(null);
    setStackedEditProduct(null);
  }

  async function handleCreateProduct(data: NewProductData) {
    await addProduct(data);
    closePanel();
  }

  async function handleEditProduct(data: NewProductData) {
    if (!stackedEditProduct) {
      return;
    }

    await editProduct(stackedEditProduct.id, data);
    closePanel();
  }

  const productsByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();

    filteredProducts.forEach((product) => {
      const category = product.categoryLabel || "Sem categoria";
      groups.set(category, [...(groups.get(category) ?? []), product]);
    });

    return Array.from(groups.entries())
      .map(([category, products]) => ({
        category,
        products: products.sort((firstProduct, secondProduct) => firstProduct.name.localeCompare(secondProduct.name)),
      }))
      .sort((firstGroup, secondGroup) => firstGroup.category.localeCompare(secondGroup.category));
  }, [filteredProducts]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, grupos, unidades e preços sugeridos opcionais."
        action={
          <div className="header-actions">
            <button type="button" className={showFilters ? "round-filter-button active" : "round-filter-button"} onClick={() => setShowFilters((current) => !current)} aria-label="Filtros">
              F
            </button>

            <Button type="button" variant="secondary" onClick={() => setPanel({ type: "create-product" })}>
              + Produto
            </Button>
          </div>
        }
      />

      {showFilters && (
        <Card>
          <div className="toolbar">
            <button type="button" className={showOnlyActive ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyActive(!showOnlyActive)}>
              Ativos
            </button>
          </div>
        </Card>
      )}

      {loadingProducts && <p className="muted-text">Carregando produtos...</p>}

      {productsError && <p className="error-text">{productsError}</p>}

      {!loadingProducts && filteredProducts.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhum produto encontrado.</strong>
            <span>Cadastre produtos para agilizar a criação de pedidos.</span>
          </div>
        </Card>
      )}

      <div className="entity-list-groups">
        {productsByCategory.map((group) => (
          <section className="entity-list-group" key={group.category}>
            <header>
              <strong>{group.category}</strong>
              <span>{group.products.length}</span>
            </header>

            <div className="entity-list">
              {group.products.map((product) => (
                <button type="button" className={!product.active ? "entity-list-row muted-card" : "entity-list-row"} key={product.id} onClick={() => setPanel({ type: "view-product", product })}>
                  <div>
                    <strong>{product.name}</strong>
                  </div>

                  <small>{formatCurrencyBR(product.suggestedPrice)}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        size={panel?.type === "view-product" ? "wide" : "fullscreen"}
        title={panel?.type === "view-product" ? "Detalhes do produto" : "Adicionar produto"}
        description={panel?.type === "view-product" ? "Consulte os dados cadastrados antes de editar." : "Cadastre um produto para usar rapidamente nos pedidos."}
        onClose={closePanel}
      >
        {panel?.type === "view-product" && (
          <div className="detail-section">
            <div className="details-grid">
              <div className="detail-block">
                <span>Produto</span>
                <strong>{panel.product.name}</strong>
              </div>
              <div className="detail-block">
                <span>Categoria</span>
                <strong>{panel.product.categoryLabel || "Não definida"}</strong>
              </div>
              <div className="detail-block">
                <span>Unidade</span>
                <strong>{panel.product.unit || "Não definida"}</strong>
              </div>
              <div className="detail-block">
                <span>Preço sugerido</span>
                <strong>{panel.product.suggestedPrice ? `R$ ${panel.product.suggestedPrice.toFixed(2).replace(".", ",")}` : "Não informado"}</strong>
              </div>
            </div>
            {panel.product.notes && (
              <div className="notes-preview">
                <span>Observações</span>
                <p>{panel.product.notes}</p>
              </div>
            )}
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setStackedEditProduct(panel.product)}>
                Editar
              </Button>
            </div>
          </div>
        )}

        {panel?.type === "create-product" && (
          <ProductForm productCategories={productCategories} productUnits={productUnits} availableTags={productAvailableTags} onCancel={closePanel} onSave={handleCreateProduct} />
        )}
      </SlidePanel>
      <SlidePanel
        open={stackedEditProduct !== null}
        level={2}
        size="fullscreen"
        title="Editar produto"
        description="Atualize este produto mantendo os detalhes visíveis ao fundo."
        onClose={() => setStackedEditProduct(null)}
      >
        {stackedEditProduct && (
          <ProductForm
            product={stackedEditProduct}
            productCategories={productCategories}
            productUnits={productUnits}
            availableTags={productAvailableTags}
            onCancel={() => setStackedEditProduct(null)}
            onSave={handleEditProduct}
          />
        )}
      </SlidePanel>
    </div>
  );
}
