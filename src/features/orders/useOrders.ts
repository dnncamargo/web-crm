import { useEffect, useMemo, useState } from "react";

import type { Product } from "../products/productTypes";
import type { NewOrderData, Order, UpdateOrderData } from "./orderTypes";
import { getOrderItemProductName } from "./orderUtils";
import { correctOrderPayment, createOrder, deleteOrder, listenOrders, registerOrderPayment, updateOrder, type CorrectOrderPaymentInput, type RegisterOrderPaymentInput } from "./ordersService";
import type { OrderPayment } from "./orderTypes";

export function useOrders(products: Product[] = []) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState("");

  useEffect(() => {
    const unsubscribe = listenOrders(
      (loadedOrders) => {
        setOrders(loadedOrders);
        setLoadingOrders(false);
      },
      (firebaseError) => {
        setOrdersError(firebaseError.message);
        setLoadingOrders(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (showOnlyActive && order.orderStatus !== "active") {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        order.clientName,
        order.addressSnapshot?.street,
        order.addressSnapshot?.neighborhood,
        order.addressSnapshot?.city,
        order.notes,
        ...order.items.map((item) => getOrderItemProductName(item, products)),
        ...(order.tagIds ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [orders, products, search, showOnlyActive]);

  async function addOrder(data: NewOrderData) {
    await createOrder(data);
  }

  async function editOrder(orderId: string, data: UpdateOrderData) {
    await updateOrder(orderId, data);
  }

  async function removeOrder(orderId: string, testDataConfirmation?: string) {
    await deleteOrder(orderId, testDataConfirmation);
  }

  async function registerPayment(orderId: string, input: RegisterOrderPaymentInput) {
    await registerOrderPayment(orderId, input);
  }

  async function correctPayment(order: Order, payment: OrderPayment, input: CorrectOrderPaymentInput) {
    await correctOrderPayment(order, payment, input);
  }

  return {
    orders,
    filteredOrders,
    search,
    setSearch,
    showOnlyActive,
    setShowOnlyActive,
    loadingOrders,
    ordersError,
    addOrder,
    editOrder,
    removeOrder,
    registerPayment,
    correctPayment,
  };
}
