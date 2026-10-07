import { describe, expect, it } from "vitest";

import type { Product } from "../products/productTypes";
import type { PrintJobRaster } from "../printers/printJobTypes";
import type { PrinterConfiguration } from "../printers/printerTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import {
  isOrderReceiptPixOptionDisabled,
  isPreparedReceiptCurrent,
  type PreparedReceiptIdentity,
} from "./orderReceiptPreparation";
import type { Order } from "./orderTypes";

const order: Order = {
  id: "order-1",
  clientId: "client-1",
  clientName: "Cliente",
  deliveryDateTime: "2026-01-01T12:00:00",
  items: [],
  subtotal: 100,
  deliveryFee: 0,
  total: 100,
  amountPaid: 0,
  orderStatus: "active",
  tagIds: [],
};
const products: Product[] = [];
const storeProfile: StoreProfile = { displayName: "Loja" };
const printer: PrinterConfiguration = {
  id: "printer-1",
  name: "Balcão",
  transport: "tcp",
  protocol: "escpos",
  host: "192.168.0.50",
  port: 9100,
  paperWidthMm: 80,
  codePage: "cp1252",
  active: true,
};
const pixQr: PrintJobRaster = { widthDots: 8, heightDots: 1, data: new Uint8Array([0x80]) };

function createPrepared(overrides: Partial<PreparedReceiptIdentity> = {}): PreparedReceiptIdentity {
  return {
    order,
    products,
    storeProfile,
    printer,
    includePix: false,
    pixPayload: null,
    pixQr: null,
    ...overrides,
  };
}

describe("prepared receipt freshness", () => {
  it("disables the Pix option while printing or while an attempt is frozen", () => {
    expect(isOrderReceiptPixOptionDisabled(false, true)).toBe(true);
    expect(isOrderReceiptPixOptionDisabled(true, false)).toBe(true);
    expect(isOrderReceiptPixOptionDisabled(false, false)).toBe(false);
  });

  it("accepts the unchanged no-Pix preparation", () => {
    expect(isPreparedReceiptCurrent(createPrepared(), order, products, storeProfile, printer, false, null, null)).toBe(true);
  });

  it.each([
    [true, null, null],
    [true, "payload-pix", null],
    [true, "payload-pix", pixQr],
  ] as const)("rejects a preparation after Pix identity changes", (includePix, payload, raster) => {
    expect(isPreparedReceiptCurrent(createPrepared(), order, products, storeProfile, printer, includePix, payload, raster)).toBe(false);
  });

  it("accepts the newly prepared Pix receipt identity", () => {
    const payload = "payload-pix";
    const prepared = createPrepared({ includePix: true, pixPayload: payload, pixQr });

    expect(isPreparedReceiptCurrent(prepared, order, products, storeProfile, printer, true, payload, pixQr)).toBe(true);
  });

  it("rejects a different raster even when the payload is unchanged", () => {
    const nextRaster: PrintJobRaster = { widthDots: 8, heightDots: 1, data: new Uint8Array([0x40]) };
    const prepared = createPrepared({ includePix: true, pixPayload: "payload-pix", pixQr });

    expect(isPreparedReceiptCurrent(prepared, order, products, storeProfile, printer, true, "payload-pix", nextRaster)).toBe(false);
  });
});
