import { useMemo } from "react";

import { useClients } from "../clients/useClients";
import { useOrders } from "../orders/useOrders";
import { getOrderBalanceInfo, getPaymentStatus } from "../orders/orderUtils";
import { useTasks } from "../tasks/useTasks";
import {
  addDaysToDateKey,
  getClientNextContactDateKey,
  getDateKeyFromDateTime,
  getTodayKey,
  getUpcomingDateKeys,
  shouldSuggestClientContact,
} from "./todayUtils";

export function useTodayDashboard() {
  const { orders, loadingOrders, ordersError } = useOrders();
  const {
    filteredClients,
    loading: loadingClients,
    error: clientsError,
  } = useClients();
  const { tasks, loadingTasks, tasksError } = useTasks();

  const todayKey = getTodayKey();

  const upcomingDateKeys = useMemo(() => getUpcomingDateKeys(4), []);

  const upcomingDeliveries = useMemo(() => {
    return orders
      .filter(
        (order) =>
          order.orderStatus === "active" &&
          upcomingDateKeys.includes(getDateKeyFromDateTime(order.deliveryDateTime))
      )
      .sort((firstOrder, secondOrder) =>
        firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime)
      );
  }, [orders, upcomingDateKeys]);

  const deliveryDateKeysWithOrders = useMemo(() => {
    return upcomingDateKeys.filter((dateKey) =>
      upcomingDeliveries.some(
        (order) => getDateKeyFromDateTime(order.deliveryDateTime) === dateKey
      )
    );
  }, [upcomingDateKeys, upcomingDeliveries]);

  const deliverySummaryCards = useMemo(() => {
    const tomorrowKey = addDaysToDateKey(todayKey, 1);
    const weekKeys = [2, 3, 4].map((days) => addDaysToDateKey(todayKey, days));

    return [
      {
        key: "today",
        title: "Hoje",
        orders: upcomingDeliveries.filter(
          (order) => getDateKeyFromDateTime(order.deliveryDateTime) === todayKey
        ),
      },
      {
        key: "tomorrow",
        title: "Amanhã",
        orders: upcomingDeliveries.filter(
          (order) =>
            getDateKeyFromDateTime(order.deliveryDateTime) === tomorrowKey
        ),
      },
      {
        key: "week",
        title: "Semana",
        orders: upcomingDeliveries.filter((order) =>
          weekKeys.includes(getDateKeyFromDateTime(order.deliveryDateTime))
        ),
      },
    ].filter((card) => card.orders.length > 0);
  }, [todayKey, upcomingDeliveries]);

  const productionByDate = useMemo(() => {
    return deliveryDateKeysWithOrders.map((dateKey) => {
      const totalsByProduct = new Map<string, number>();

      upcomingDeliveries
        .filter(
          (order) => getDateKeyFromDateTime(order.deliveryDateTime) === dateKey
        )
        .forEach((order) => {
          order.items.forEach((item) => {
            totalsByProduct.set(
              item.productName,
              (totalsByProduct.get(item.productName) ?? 0) + item.quantity
            );
          });
        });

      return {
        dateKey,
        items: Array.from(totalsByProduct.entries())
          .map(([productName, quantity]) => ({
            productName,
            quantity,
          }))
          .sort((firstItem, secondItem) =>
            firstItem.productName.localeCompare(secondItem.productName)
          ),
      };
    });
  }, [deliveryDateKeysWithOrders, upcomingDeliveries]);

  const pendingPayments = useMemo(() => {
    return orders
      .filter((order) => {
        if (order.orderStatus !== "active") {
          return false;
        }

        const paymentStatus = getPaymentStatus(order);

        return paymentStatus === "unpaid" || paymentStatus === "partial";
      })
      .sort((firstOrder, secondOrder) =>
        firstOrder.deliveryDateTime.localeCompare(secondOrder.deliveryDateTime)
      );
  }, [orders]);

  const pendingPaymentsTotal = useMemo(() => {
    return pendingPayments.reduce((sum, order) => {
      const balanceInfo = getOrderBalanceInfo(order);

      return balanceInfo.type === "remaining"
        ? sum + balanceInfo.amount
        : sum;
    }, 0);
  }, [pendingPayments]);

  const openTasks = useMemo(() => {
    return tasks
      .filter((task) => !task.done)
      .sort((firstTask, secondTask) => {
        if (!firstTask.dueDate && secondTask.dueDate) return 1;
        if (firstTask.dueDate && !secondTask.dueDate) return -1;

        if (firstTask.dueDate && secondTask.dueDate) {
          return firstTask.dueDate.localeCompare(secondTask.dueDate);
        }

        return firstTask.title.localeCompare(secondTask.title);
      })
      .slice(0, 8);
  }, [tasks]);

  const openTasksTotal = useMemo(() => {
    return tasks.filter((task) => !task.done).length;
  }, [tasks]);

  const contactSuggestions = useMemo(() => {
    return filteredClients
      .filter(shouldSuggestClientContact)
      .sort((firstClient, secondClient) => {
        const firstDate = getClientNextContactDateKey(firstClient) ?? todayKey;
        const secondDate = getClientNextContactDateKey(secondClient) ?? todayKey;

        return firstDate.localeCompare(secondDate);
      })
      .slice(0, 8);
  }, [filteredClients, todayKey]);

  const loading = loadingOrders || loadingClients || loadingTasks;

  return {
    todayKey,
    upcomingDateKeys,
    upcomingDeliveries,
    deliverySummaryCards,
    productionByDate,
    pendingPayments,
    pendingPaymentsTotal,
    openTasks,
    openTasksTotal,
    contactSuggestions,
    loading,
    ordersError,
    clientsError,
    tasksError,
  };
}