import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { SlidePanel } from "../../components/ui/SlidePanel";
import { ProductCard } from "./components/ProductCard";
import { ProductForm } from "./components/ProductForm";
import type { NewProductData, Product } from "./productTypes";
import { useProducts } from "./useProducts";
import { useTags } from "../tags/useTags";

type ProductPanelState = { type: "create-product" } | { type: "edit-product"; product: Product } | null;

export function ProductsPage() {
  const { filteredProducts, search, setSearch, showOnlyActive, setShowOnlyActive, loadingProducts, productsError, addProduct, editProduct, setProductActive } = useProducts();

  const [panel, setPanel] = useState<ProductPanelState>(null);
  const { getTagsByEntityAndGroup } = useTags();

  const productCategories = getTagsByEntityAndGroup("product", "Categoria");

  function closePanel() {
    setPanel(null);
  }

  async function handleCreateProduct(data: NewProductData) {
    await addProduct(data);
    closePanel();
  }

  async function handleEditProduct(data: NewProductData) {
    if (!panel || panel.type !== "edit-product") {
      return;
    }

    await editProduct(panel.product.id, data);
    closePanel();
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, grupos, unidades e preços sugeridos opcionais."
        action={
          <Button type="button" variant="secondary" onClick={() => setPanel({ type: "create-product" })}>
            + Produto
          </Button>
        }
      />

      <Card>
        <div className="toolbar">
          <input className="local-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, grupo, unidade ou etiqueta..." />

          <button type="button" className={showOnlyActive ? "filter-pill active" : "filter-pill"} onClick={() => setShowOnlyActive(!showOnlyActive)}>
            Ativos
          </button>
        </div>
      </Card>

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

      <div className="cards-grid">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} onRequestEditProduct={(selectedProduct) => setPanel({ type: "edit-product", product: selectedProduct })} onActiveChange={setProductActive} />
        ))}
      </div>

      <SlidePanel
        open={panel !== null}
        title={panel?.type === "edit-product" ? "Editar produto" : "Adicionar produto"}
        description={panel?.type === "edit-product" ? "Atualize os dados deste produto." : "Cadastre um produto para usar rapidamente nos pedidos."}
        onClose={closePanel}
      >
        {panel?.type === "create-product" && <ProductForm
                                               productCategories={productCategories} 
                                               onCancel={closePanel} 
                                               onSave={handleCreateProduct} 
                                            />}

        {panel?.type === "edit-product" && <ProductForm 
                                              product={panel.product} 
                                              productCategories={productCategories} 
                                              onCancel={closePanel} 
                                              onSave={handleEditProduct} 
                                            />}
      </SlidePanel>
    </div>
  );
}
