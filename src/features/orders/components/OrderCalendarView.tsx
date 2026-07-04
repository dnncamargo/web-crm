import { useMemo, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR } from "../../../utils/money";
import type { Order } from "../orderTypes";
import { getPaymentStatus, getPaymentStatusLabel } from "../orderUtils";

interface OrderCalendarViewProps {
  orders: Order[];
  onRequestEditOrder: (order: Order) => void;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  currentMonth: boolean;
}

const weekDayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getOrderDateKey(order: Order) {
  return order.deliveryDateTime.slice(0, 10);
}

function getOrderTime(order: Order) {
  if (!order.deliveryDateTime.includes("T")) {
    return "";
  }

  return order.deliveryDateTime.split("T")[1]?.slice(0, 5) ?? "";
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function createCalendarDays(referenceDate: Date): CalendarDay[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const firstCalendarDay = new Date(firstDayOfMonth);

  firstCalendarDay.setDate(
    firstCalendarDay.getDate() - firstCalendarDay.getDay()
  );

  const days: CalendarDay[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstCalendarDay);

    date.setDate(firstCalendarDay.getDate() + index);

    days.push({
      date,
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      currentMonth: date.getMonth() === month,
    });
  }

  return days;
}

export function OrderCalendarView({
  orders,
  onRequestEditOrder,
}: OrderCalendarViewProps) {
  const initialReferenceDate = useMemo(() => {
    const firstOrderWithDate = orders.find((order) => order.deliveryDateTime);

    if (!firstOrderWithDate) {
      return new Date();
    }

    const date = new Date(firstOrderWithDate.deliveryDateTime);

    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [orders]);

  const [referenceDate, setReferenceDate] = useState(initialReferenceDate);

  const calendarDays = useMemo(
    () => createCalendarDays(referenceDate),
    [referenceDate]
  );

  const ordersByDate = useMemo(() => {
    return orders.reduce<Record<string, Order[]>>((groups, order) => {
      const dateKey = getOrderDateKey(order);

      return {
        ...groups,
        [dateKey]: [...(groups[dateKey] ?? []), order],
      };
    }, {});
  }, [orders]);

  function goToPreviousMonth() {
    setReferenceDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setReferenceDate(
      (currentDate) =>
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  }

  function goToCurrentMonth() {
    setReferenceDate(new Date());
  }

  return (
    <div className="order-calendar">
      <div className="order-calendar-header">
        <div>
          <strong>{getMonthLabel(referenceDate)}</strong>
          <span>Pedidos distribuídos por data de entrega</span>
        </div>

        <div className="order-calendar-actions">
          <Button type="button" variant="ghost" onClick={goToPreviousMonth}>
            ←
          </Button>

          <Button type="button" variant="secondary" onClick={goToCurrentMonth}>
            Hoje
          </Button>

          <Button type="button" variant="ghost" onClick={goToNextMonth}>
            →
          </Button>
        </div>
      </div>

      <div className="order-calendar-weekdays">
        {weekDayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="order-calendar-grid">
        {calendarDays.map((day) => {
          const dayOrders = ordersByDate[day.dateKey] ?? [];

          return (
            <section
              className={
                day.currentMonth
                  ? "order-calendar-cell"
                  : "order-calendar-cell muted"
              }
              key={day.dateKey}
            >
              <header>
                <span>{day.dayNumber}</span>

                {dayOrders.length > 0 && (
                  <small>
                    {dayOrders.length}{" "}
                    {dayOrders.length === 1 ? "pedido" : "pedidos"}
                  </small>
                )}
              </header>

              <div className="order-calendar-cell-list">
                {dayOrders.slice(0, 3).map((order) => {
                  const paymentStatus = getPaymentStatus(order);

                  return (
                    <button
                      type="button"
                      className="order-calendar-chip"
                      key={order.id}
                      onClick={() => onRequestEditOrder(order)}
                    >
                      <span>
                        {getOrderTime(order)} {order.clientName}
                      </span>

                      <small>
                        {formatCurrencyBR(order.total)} ·{" "}
                        {getPaymentStatusLabel(paymentStatus)}
                      </small>
                    </button>
                  );
                })}

                {dayOrders.length > 3 && (
                  <Badge>{`+${dayOrders.length - 3} pedidos`}</Badge>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}