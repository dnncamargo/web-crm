import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../orderTypes";
import { OrderCalendarView } from "./OrderCalendarView";

describe("OrderCalendarView", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on the current month and selects today's date regardless of order dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12));

    const olderOrder: Order = {
      id: "older-order",
      clientId: "client-1",
      clientName: "Cliente",
      deliveryDateTime: "2025-01-15T10:00:00",
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      total: 0,
      amountPaid: 0,
      orderStatus: "active",
      tagIds: [],
    };

    const markup = renderToStaticMarkup(
      <OrderCalendarView orders={[olderOrder]} products={[]} onRequestEditOrder={() => undefined} />,
    );

    expect(markup).toContain("<strong>julho de 2026</strong>");
    expect(markup).toMatch(/class="ios-calendar-day selected today">[\s\S]*?<span>15<\/span>/);
  });
});
