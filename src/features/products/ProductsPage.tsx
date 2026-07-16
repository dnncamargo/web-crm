import { useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { isProductStructuralGroup } from "../tags/tagConfig";
import { useTags } from "../tags/useTags";
import { ProductDetailsPanelContent } from "./components/ProductDetailsPanelContent";
import { ProductForm } from "./components/ProductForm";
import { ProductListView } from "./components/ProductListView";
import type { NewProductData, Product } from "./productTypes";
import { useProducts } from "./useProducts";

type ProductPanelState =
  | { type: "create-product" }
  | { type: "view-product"; product: Product }
  | null;

export function ProductsPage() {
  const {
    filteredProducts,
    showOnlyActive,
    setShowOnlyActive,
    loadingProducts,
    productsError,
    addProduct,
    editProduct,
  } = useProducts();

  const { activeTags, getTagsByEntityAndGroup } = useTags();

  const [panel, setPanel] = useState<ProductPanelState>(null);
  const [stackedEditProduct, setStackedEditProduct] =
    useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const productCategories = getTagsByEntityAndGroup("product", "Categoria");

  const productUnits = getTagsByEntityAndGroup("product", "Unidade de venda");

  const tagLabelsById = useMemo(
    () => Object.fromEntries(activeTags.map((tag) => [tag.id, tag.label])),
    [activeTags]
  );

  const productAvailableTags = useMemo(
    () =>
      activeTags.filter((tag) => {
        const isProductOrGlobalTag =
          tag.entity === "product" || tag.entity === "global";

        const isStructuredProductTag =
          tag.entity === "product" && isProductStructuralGroup(tag.group);

        return isProductOrGlobalTag && !isStructuredProductTag;
      }),
    [activeTags]
  );

  const mainPanelSize =
    panel?.type === "view-product" && stackedEditProduct
      ? "fullscreen"
      : "wide";

  function closePanel() {
    setPanel(null);
    setStackedEditProduct(null);
  }

  function openViewProduct(product: Product) {
    setPanel({ type: "view-product", product });
  }

  function openStackedEditProduct(product: Product) {
    setStackedEditProduct(product);
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

  return (
    <div className="page-stack">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, grupos, unidades e preços sugeridos opcionais."
        action={
          <div className="header-actions">
            <button
              type="button"
              className={
                showFilters
                  ? "round-filter-button active"
                  : "round-filter-button"
              }
              onClick={() => setShowFilters((current) => !current)}
              aria-label="Filtros"
            >
              <Filter size={18} aria-hidden="true" />
            </button>

            <Button
              type="button"
              variant="primary"
              onClick={() => setPanel({ type: "create-product" })}
            >
              + Produto
            </Button>
          </div>
        }
      />

      {showFilters && (
        <Card>
          <div className="toolbar">
            <button
              type="button"
              className={showOnlyActive ? "filter-pill active" : "filter-pill"}
              onClick={() => setShowOnlyActive(!showOnlyActive)}
            >
              Ativos
            </button>
          </div>
        </Card>
      )}

      {loadingProducts && (
        <p className="muted-text">Carregando produtos...</p>
      )}

      {productsError && <p className="error-text">{productsError}</p>}

      {!loadingProducts && filteredProducts.length === 0 && (
        <Card>
          <div className="empty-state">
            <strong>Nenhum produto encontrado.</strong>
            <span>Cadastre produtos para agilizar a criação de pedidos.</span>
          </div>
        </Card>
      )}

      <ProductListView
        products={filteredProducts}
        tagLabelsById={tagLabelsById}
        onRequestViewProduct={openViewProduct}
      />

      <SlidePanel
        open={panel !== null}
        size={mainPanelSize}
        title={
          panel?.type === "view-product"
            ? "Detalhes do produto"
            : "Adicionar produto"
        }
        description={
          panel?.type === "view-product"
            ? "Consulte os dados cadastrados antes de editar."
            : "Cadastre um produto para usar rapidamente nos pedidos."
        }
        onClose={closePanel}
      >
        {panel?.type === "view-product" && (
          <ProductDetailsPanelContent
            product={panel.product}
            tagLabelsById={tagLabelsById}
            onEdit={() => openStackedEditProduct(panel.product)}
          />
        )}

        {panel?.type === "create-product" && (
          <ProductForm
            productCategories={productCategories}
            productUnits={productUnits}
            availableTags={productAvailableTags}
            onCancel={closePanel}
            onSave={handleCreateProduct}
          />
        )}
      </SlidePanel>

      <SlidePanel
        open={stackedEditProduct !== null}
        level={2}
        size="wide"
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
