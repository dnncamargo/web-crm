import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Product } from "../../products/productTypes";
import { createStaticPixPayload } from "../../pix/pixBrCode";
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

  it("keeps the default receipt free of Pix presentation", () => {
    const markup = renderToStaticMarkup(
      <OrderReceipt order={order} products={products} storeDisplayName="Loja Central" />,
    );

    expect(markup).not.toContain("pix-qr-code");
    expect(markup).not.toContain("Copia e Cola");
  });

  it("renders the canonical Pix amount with the QR presentation", () => {
    const payload = createStaticPixPayload({
      key: "123e4567-e12b-12d1-a456-426655440000",
      merchantName: "Loja Central",
      merchantCity: "Campos",
      amount: 70,
    });
    const markup = renderToStaticMarkup(
      <OrderReceipt
        order={order}
        products={products}
        storeDisplayName="Loja Central"
        pixPayload={payload}
        pixAmount={70}
      />,
    );

    expect(markup).toContain('aria-label="Pagamento Pix"');
    expect(markup).toContain("Valor Pix:");
    expect(markup).toContain("R$ 70,00");
    expect(markup).toContain("<title>QR Code Pix</title>");
    expect(markup).toContain('width="256"');
    expect(markup).not.toContain(payload);
    expect(markup).not.toContain("123e4567-e12b-12d1-a456-426655440000");
    expect(markup).not.toContain("Copia e Cola");
  });

  it("does not render the Pix amount when the QR presentation is not supplied", () => {
    const markup = renderToStaticMarkup(
      <OrderReceipt
        order={order}
        products={products}
        storeDisplayName="Loja Central"
        pixAmount={70}
      />,
    );

    expect(markup).not.toContain("Valor Pix");
  });
});
