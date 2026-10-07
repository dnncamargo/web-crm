import type { Product } from "../products/productTypes";
import type { PrintJobRaster } from "../printers/printJobTypes";
import type { PrinterConfiguration } from "../printers/printerTypes";
import type { StoreProfile } from "../store-profile/storeProfileTypes";
import type { Order } from "./orderTypes";

export interface PreparedReceiptIdentity {
  order: Order;
  products: Product[];
  storeProfile: StoreProfile;
  printer: PrinterConfiguration;
  includePix: boolean;
  pixPayload: string | null;
  pixQr: PrintJobRaster | null;
}

export function isOrderReceiptPixOptionDisabled(
  thermalPrintBusy: boolean,
  hasPendingPrintAttempt: boolean,
) {
  return thermalPrintBusy || hasPendingPrintAttempt;
}

export function isPreparedReceiptCurrent(
  preparedReceipt: PreparedReceiptIdentity | null,
  order: Order | undefined,
  products: Product[],
  storeProfile: StoreProfile | null,
  printer: PrinterConfiguration | null,
  includePix: boolean,
  pixPayload: string | null,
  pixQr: PrintJobRaster | null,
) {
  return Boolean(
    preparedReceipt &&
    preparedReceipt.order === order &&
    preparedReceipt.products === products &&
    preparedReceipt.storeProfile === storeProfile &&
    preparedReceipt.printer.id === printer?.id &&
    preparedReceipt.includePix === includePix &&
    preparedReceipt.pixPayload === pixPayload &&
    preparedReceipt.pixQr === pixQr,
  );
}
