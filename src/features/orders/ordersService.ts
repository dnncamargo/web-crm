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
import type { NewOrderData, Order, UpdateOrderData } from "./orderTypes";

const ordersCollection = collection(db, "orders");

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

export function listenOrders(
  onChange: (orders: Order[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const ordersQuery = query(
    ordersCollection,
    orderBy("deliveryDateTime", "asc")
  );

  return onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      })) as Order[];

      onChange(orders);
    },
    onError
  );
}

export async function createOrder(data: NewOrderData) {
  const cleanedData = removeUndefinedFields(data);

  return addDoc(ordersCollection, {
    ...cleanedData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateOrder(orderId: string, data: UpdateOrderData) {
  const orderRef = doc(db, "orders", orderId);
  const cleanedData = removeUndefinedFields(data);

  return updateDoc(orderRef, {
    ...cleanedData,
    updatedAt: serverTimestamp(),
  });
}