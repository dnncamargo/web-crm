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
const weekDayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];
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
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}
function createCalendarDays(referenceDate: Date): CalendarDay[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const firstCalendarDay = new Date(firstDayOfMonth);
  firstCalendarDay.setDate(firstCalendarDay.getDate() - firstCalendarDay.getDay());
  const days: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstCalendarDay);
    date.setDate(firstCalendarDay.getDate() + index);
    days.push({ date, dateKey: toDateKey(date), dayNumber: date.getDate(), currentMonth: date.getMonth() === month });
  }
  return days;
}
function getTodayKey() {
  return toDateKey(new Date());
}
function formatSelectedDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) {
    return dateKey;
  }
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}
export function OrderCalendarView({ orders, onRequestEditOrder }: OrderCalendarViewProps) {
  const todayKey = getTodayKey();
  const initialReferenceDate = useMemo(() => {
    const firstOrderWithDate = orders.find((order) => order.deliveryDateTime);
    if (!firstOrderWithDate) {
      return new Date();
    }
    const date = new Date(firstOrderWithDate.deliveryDateTime);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [orders]);
  const [referenceDate, setReferenceDate] = useState(initialReferenceDate);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const calendarDays = useMemo(() => createCalendarDays(referenceDate), [referenceDate]);
  const ordersByDate = useMemo(() => {
    return orders.reduce<Record<string, Order[]>>((groups, order) => {
      const dateKey = getOrderDateKey(order);
      return { ...groups, [dateKey]: [...(groups[dateKey] ?? []), order] };
    }, {});
  }, [orders]);
  const selectedOrders = useMemo(() => {
    return [...(ordersByDate[selectedDateKey] ?? [])].sort((first, second) => first.deliveryDateTime.localeCompare(second.deliveryDateTime));
  }, [ordersByDate, selectedDateKey]);
  function goToPreviousMonth() {
    setReferenceDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  }
  function goToNextMonth() {
    setReferenceDate((currentDate) => new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  }
  function goToCurrentMonth() {
    const today = new Date();
    setReferenceDate(today);
    setSelectedDateKey(toDateKey(today));
  }
  return (
    <div className="ios-calendar-view">
      {" "}
      <section className="ios-calendar-card">
        {" "}
        <header className="ios-calendar-header">
          {" "}
          <button type="button" onClick={goToPreviousMonth}>
            {" "}
            ←{" "}
          </button>{" "}
          <div>
            {" "}
            <strong>{getMonthLabel(referenceDate)}</strong>{" "}
          </div>{" "}
          <button type="button" onClick={goToNextMonth}>
            {" "}
            →{" "}
          </button>{" "}
        </header>{" "}
        <div className="ios-calendar-weekdays">
          {" "}
          {weekDayLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}{" "}
        </div>{" "}
        <div className="ios-calendar-grid">
          {" "}
          {calendarDays.map((day) => {
            const dayOrders = ordersByDate[day.dateKey] ?? [];
            const hasOrders = dayOrders.length > 0;
            const selected = selectedDateKey === day.dateKey;
            const today = todayKey === day.dateKey;
            return (
              <button
                type="button"
                key={day.dateKey}
                className={["ios-calendar-day", day.currentMonth ? "" : "muted", selected ? "selected" : "", today ? "today" : ""].filter(Boolean).join(" ")}
                onClick={() => setSelectedDateKey(day.dateKey)}
              >
                {" "}
                <span>{day.dayNumber}</span> <small className={hasOrders ? "calendar-dot visible" : "calendar-dot"} />{" "}
              </button>
            );
          })}{" "}
        </div>{" "}
        <div className="ios-calendar-footer">
          {" "}
          <Button type="button" variant="ghost" onClick={goToCurrentMonth}>
            {" "}
            Hoje{" "}
          </Button>{" "}
        </div>{" "}
      </section>{" "}
      <section className="selected-day-orders">
        {" "}
        <header>
          {" "}
          <strong>{formatSelectedDateLabel(selectedDateKey)}</strong>{" "}
          <span>
            {" "}
            {selectedOrders.length} {selectedOrders.length === 1 ? "pedido" : "pedidos"}{" "}
          </span>{" "}
        </header>{" "}
        {selectedOrders.length === 0 ? (
          <div className="empty-day-orders">
            {" "}
            <span>Nenhum pedido para este dia.</span>{" "}
          </div>
        ) : (
          <div className="selected-day-order-list">
            {" "}
            {selectedOrders.map((order) => {
              const paymentStatus = getPaymentStatus(order);
              return (
                <button type="button" className="selected-day-order" key={order.id} onClick={() => onRequestEditOrder(order)}>
                  {" "}
                  <div>
                    {" "}
                    <strong>
                      {" "}
                      {getOrderTime(order)} · {order.clientName}{" "}
                    </strong>{" "}
                    <small> {order.items.map((item) => `${item.quantity}× ${item.productName}`).join(" · ")} </small>{" "}
                  </div>{" "}
                  <div className="selected-day-order-meta">
                    {" "}
                    <Badge>{getPaymentStatusLabel(paymentStatus)}</Badge> <span>{formatCurrencyBR(order.total)}</span>{" "}
                  </div>{" "}
                </button>
              );
            })}{" "}
          </div>
        )}{" "}
      </section>{" "}
    </div>
  );
}
