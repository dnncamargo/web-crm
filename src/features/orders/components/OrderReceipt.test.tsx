import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Product } from "../../products/productTypes";
import type { Order } from "../orderTypes";
import { OrderReceipt } from "./OrderReceipt";

const order: Order = {
  id: "order-1",
  clientId: "client-1",
  clientName: "Cliente Teste",
  deliveryDateTime: "data inválida para o teste",
  items: [],
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  amountPaid: 0,
  orderStatus: "active",
  tagIds: [],
};

const products: Product[] = [];

describe("OrderReceipt", () => {
  it("uses the supplied store display name for the static logo alt text", () => {
    const markup = renderToStaticMarkup(
      <OrderReceipt
        order={order}
        products={products}
        storeDisplayName="Loja Central"
      />,
    );

    expect(markup).toContain('alt="Loja Central"');
    expect(markup).toContain('src="/brand/brand-mark-print.bmp"');
  });
});
