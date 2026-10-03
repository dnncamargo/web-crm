import { describe, expect, it } from "vitest";

import type { Product } from "../products/productTypes";
import { encodePrintJob } from "../printers/escposEncoder";
import type { PrintJobRaster } from "../printers/printJobTypes";
import { ORDER_RECEIPT_BRAND_NAME } from "./orderReceiptBrand";
import type { Order } from "./orderTypes";
import { createOrderReceiptDocument } from "./orderReceiptDocument";
import { createOrderReceiptPrintJob } from "./orderReceiptPrintJob";

function checksum(bytes: Uint8Array) {
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

const products: Product[] = [
  { id: "live", name: "Nome atual", active: true, tagIds: [] },
];

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    clientId: "client-1",
    clientName: "Cliente Teste",
    deliveryDateTime: "data inválida para o teste",
    items: [
      { id: "item-live", productId: "live", productName: "Nome antigo", quantity: 2, unit: "kg", unitPrice: 10, total: 20 },
      { id: "item-fallback", productId: "missing", productName: "Produto salvo", quantity: 1, unitPrice: 5, total: 5 },
    ],
    subtotal: 25,
    deliveryFee: 5,
    total: 30,
    amountPaid: 10,
    orderStatus: "active",
    tagIds: [],
    ...overrides,
  };
}

describe("OrderReceiptDocument", () => {
  const logo: PrintJobRaster = {
    widthDots: 8,
    heightDots: 1,
    data: new Uint8Array([0xaa]),
  };

  it("preserves delivery address semantics without Address.label", () => {
    const document = createOrderReceiptDocument(createOrder({
      addressSnapshot: {
        label: "Casa",
        street: "Rua A",
        number: "10",
        complement: "Apto 2",
        neighborhood: "Centro",
        city: "Porto",
        state: "SP",
        reference: "Portão azul",
      },
    }), products);

    expect(document.fulfillment).toEqual({
      type: "delivery",
      lines: ["Rua A, 10", "Apto 2 · Centro", "Porto/SP", "Referência: Portão azul"],
    });
  });

  it("represents missing address as pickup", () => {
    expect(createOrderReceiptDocument(createOrder(), products).fulfillment).toEqual({
      type: "pickup",
      label: "Retirada pelo cliente",
    });
  });

  it("uses the live product name and stored fallback", () => {
    const document = createOrderReceiptDocument(createOrder(), products);

    expect(document.items.map((item) => item.name)).toEqual(["Nome atual", "Produto salvo"]);
  });

  it("keeps paid/remaining, applied credit and generated credit in the summary", () => {
    const document = createOrderReceiptDocument(createOrder({
      amountPaid: 10,
      creditApplied: 5,
      creditGenerated: 2,
    }), products);

    expect(document.summary.rows).toEqual([
      { label: "Subtotal", value: "R$\u00a025,00" },
      { label: "Entrega", value: "R$\u00a05,00" },
      { label: "Pago", value: "R$\u00a010,00" },
      { label: "Crédito usado", value: "R$\u00a05,00" },
      { label: "Restante", value: "R$\u00a015,00" },
    ]);
    expect(document.summary.creditGenerated).toEqual({ label: "Crédito gerado", value: "R$\u00a02,00" });
    expect(document.summary.settled).toBe(false);
  });

  it("marks the receipt settled when effective paid amount covers the total", () => {
    const document = createOrderReceiptDocument(createOrder({ amountPaid: 25, creditApplied: 5 }), products);

    expect(document.summary.rows).toEqual([
      { label: "Subtotal", value: "R$\u00a025,00" },
      { label: "Entrega", value: "R$\u00a05,00" },
      { label: "Pago", value: "R$\u00a025,00" },
      { label: "Crédito usado", value: "R$\u00a05,00" },
    ]);
    expect(document.summary.settled).toBe(true);
  });

  it("maps a complete order receipt to deterministic ESC/POS bytes", () => {
    const document = createOrderReceiptDocument(createOrder({
      addressSnapshot: {
        label: "Casa",
        street: "Rua A",
        number: "10",
        city: "Porto",
        state: "SP",
      },
      amountPaid: 30,
      items: [{
        id: "item-1",
        productId: "live",
        productName: "Nome antigo",
        quantity: 2,
        unit: "kg",
        unitPrice: 10,
        total: 20,
        notes: "Sem açúcar",
      }],
      subtotal: 20,
      deliveryFee: 10,
      total: 30,
    }), products);
    const job = createOrderReceiptPrintJob(document, {
      columns: 48,
      brandName: ORDER_RECEIPT_BRAND_NAME,
    });
    const bytes = encodePrintJob(job);

    expect(job.commands.filter((command) => command.type === "text").every((command) => command.text.length <= 48)).toBe(true);
    expect(checksum(bytes)).toBe("189aa66e");
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x01]);
  });

  it("places the raster logo before the receipt without duplicating the brand text", () => {
    const document = createOrderReceiptDocument(createOrder(), products);
    const job = createOrderReceiptPrintJob(document, {
      columns: 48,
      brandName: ORDER_RECEIPT_BRAND_NAME,
      logo,
    });
    const rasterIndex = job.commands.findIndex((command) => command.type === "raster");
    const titleIndex = job.commands.findIndex(
      (command) => command.type === "text" && command.text === "Pedido",
    );

    expect(job.commands.slice(0, 4)).toEqual([
      { type: "alignment", alignment: "center" },
      { type: "raster", raster: logo },
      { type: "text", text: "Pedido" },
      { type: "text", text: "Entrega: data inválida para o teste" },
    ]);
    expect(rasterIndex).toBeGreaterThanOrEqual(0);
    expect(rasterIndex).toBeLessThan(titleIndex);
    expect(job.commands.filter((command) => command.type === "text" && command.text === ORDER_RECEIPT_BRAND_NAME)).toHaveLength(0);
    expect(job.commands.filter((command) => command.type === "cut")).toHaveLength(1);
    const bytes = encodePrintJob(job);

    expect(Array.from(bytes.slice(5, 17))).toEqual([
      0x1b, 0x61, 0x01,
      0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0xaa,
    ]);
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x01]);
  });

  it("uses a centered bold textual brand fallback when the logo is unavailable", () => {
    const document = createOrderReceiptDocument(createOrder(), products);
    const job = createOrderReceiptPrintJob(document, {
      columns: 48,
      brandName: ORDER_RECEIPT_BRAND_NAME,
    });

    expect(job.commands.slice(0, 6)).toEqual([
      { type: "alignment", alignment: "center" },
      { type: "bold", enabled: true },
      { type: "text", text: ORDER_RECEIPT_BRAND_NAME },
      { type: "bold", enabled: false },
      { type: "text", text: "Pedido" },
      { type: "text", text: "Entrega: data inválida para o teste" },
    ]);
    expect(job.commands.filter((command) => command.type === "cut")).toHaveLength(1);
    expect(Array.from(encodePrintJob(job)).slice(-4)).toEqual([0x1d, 0x56, 0x42, 0x01]);
  });
});
