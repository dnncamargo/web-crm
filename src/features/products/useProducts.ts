import { useEffect, useMemo, useState } from "react";

import type {
  NewProductData,
  Product,
  UpdateProductData,
} from "./productTypes";
import {
  createProduct,
  listenProducts,
  toggleProductActive,
  updateProduct,
} from "./productsService";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    const unsubscribe = listenProducts(
      (loadedProducts) => {
        setProducts(loadedProducts);
        setLoadingProducts(false);
      },
      (firebaseError) => {
        setProductsError(firebaseError.message);
        setLoadingProducts(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      if (showOnlyActive && !product.active) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

    const searchableText = [
        product.name,
        product.categoryLabel,
        product.unit,
        product.notes,
        ...(product.tagIds ?? []),
        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [products, search, showOnlyActive]);

  async function addProduct(data: NewProductData) {
    await createProduct(data);
  }

  async function editProduct(productId: string, data: UpdateProductData) {
    await updateProduct(productId, data);
  }

  async function setProductActive(product: Product, active: boolean) {
    await toggleProductActive(product.id, active);
  }

  return {
    products,
    filteredProducts,
    search,
    setSearch,
    showOnlyActive,
    setShowOnlyActive,
    loadingProducts,
    productsError,
    addProduct,
    editProduct,
    setProductActive,
  };
}