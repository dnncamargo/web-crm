import type { PrinterConfiguration } from "../printers/printerTypes";
import type { PrinterDestination } from "../printers/printerTransport";

export type AutomaticReceiptPrintRoute = "browser" | "thermal";

export interface AutomaticReceiptPrintDependencies {
  checkHealth: () => Promise<void>;
  testConnection: (destination: PrinterDestination) => Promise<void>;
  createBytes: () => Promise<Uint8Array>;
  printToPrinter: (printer: PrinterConfiguration, bytes: Uint8Array) => Promise<void>;
  browserPrint: () => void;
}

function isValidPrinterConfiguration(
  printer: PrinterConfiguration | null,
): printer is PrinterConfiguration {
  return Boolean(
    printer &&
      printer.active === true &&
      typeof printer.id === "string" &&
      printer.id.trim() &&
      typeof printer.name === "string" &&
      printer.name.trim() &&
      printer.transport === "tcp" &&
      printer.protocol === "escpos" &&
      printer.codePage === "cp1252" &&
      typeof printer.host === "string" &&
      printer.host.trim() &&
      typeof printer.port === "number" &&
      Number.isInteger(printer.port) &&
      printer.port >= 1 &&
      printer.port <= 65_535 &&
      typeof printer.paperWidthMm === "number" &&
      Number.isFinite(printer.paperWidthMm) &&
      printer.paperWidthMm > 0,
  );
}

function getDestination(printer: PrinterConfiguration): PrinterDestination {
  return {
    host: printer.host,
    port: printer.port,
  };
}

export async function printReceiptAutomatically(
  printer: PrinterConfiguration | null,
  dependencies: AutomaticReceiptPrintDependencies,
): Promise<AutomaticReceiptPrintRoute> {
  if (!isValidPrinterConfiguration(printer)) {
    dependencies.browserPrint();
    return "browser";
  }

  const destination = getDestination(printer);
  let printStarted = false;

  try {
    await dependencies.checkHealth();
    await dependencies.testConnection(destination);

    const bytes = await dependencies.createBytes();

    if (bytes.length === 0) {
      dependencies.browserPrint();
      return "browser";
    }

    printStarted = true;
    await dependencies.printToPrinter(printer, bytes);
    return "thermal";
  } catch (error) {
    if (!printStarted) {
      dependencies.browserPrint();
      return "browser";
    }

    throw error;
  }
}
