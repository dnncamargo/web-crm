import type { PrinterConfiguration } from "../printers/printerTypes";

export type OrderPrintRoute = "thermal" | "browser";

export const ORDER_RECEIPT_PRINT_LABEL = "Imprimir";
export const ORDER_RECEIPT_PRINT_BUSY_LABEL = "Imprimindo…";

interface PrintReceiptAutomaticallyOptions {
  printer: PrinterConfiguration | null;
  createJobId: () => string;
  preflight: (printer: PrinterConfiguration) => Promise<void>;
  prepareBytes: () => Promise<Uint8Array>;
  print: (printer: PrinterConfiguration, bytes: Uint8Array, jobId: string) => Promise<void>;
  browserPrint: () => void;
}

export interface OrderPrintResult {
  route: OrderPrintRoute;
  jobId: string;
}

export async function printReceiptAutomatically({
  printer,
  createJobId,
  preflight,
  prepareBytes,
  print,
  browserPrint,
}: PrintReceiptAutomaticallyOptions): Promise<OrderPrintResult> {
  const jobId = createJobId();

  if (!printer) {
    browserPrint();
    return { route: "browser", jobId };
  }

  let bytes: Uint8Array;
  try {
    await preflight(printer);
    bytes = await prepareBytes();
  } catch {
    browserPrint();
    return { route: "browser", jobId };
  }

  let printStarted = false;
  try {
    printStarted = true;
    await print(printer, bytes, jobId);
    return { route: "thermal", jobId };
  } catch (error) {
    if (printStarted) {
      throw error;
    }

    browserPrint();
    return { route: "browser", jobId };
  }
}
