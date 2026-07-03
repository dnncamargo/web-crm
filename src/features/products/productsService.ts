import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import type {
  NewProductData,
  Product,
  UpdateProductData,
} from "./productTypes";

const productsCollection = collection(db, "products");

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedFields) as T;
  }

  if (value !== null && typeof value === "object") {
    const cleanedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)]);

    return Object.fromEntries(cleanedEntries) as T;
  }

  return value;
}

export function listenProducts(
  onChange: (products: Product[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const productsQuery = query(productsCollection, orderBy("createdAt", "desc"));

  return onSnapshot(
    productsQuery,
    (snapshot) => {
      const products = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Product[];

      onChange(products);
    },
    onError
  );
}

export async function createProduct(data: NewProductData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(productsCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProduct(
  productId: string,
  data: UpdateProductData
) {
  const productRef = doc(db, "products", productId);
  const cleanedData = removeUndefinedFields(data);

  return updateDoc(productRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleProductActive(productId: string, active: boolean) {
  const productRef = doc(db, "products", productId);

  return updateDoc(productRef, {
    active,
    updatedAt: serverTimestamp(),
  });
}