import type { PrinterConfiguration } from "./printerTypes";

export function resolveDefaultPrinter(
  printers: PrinterConfiguration[],
  defaultPrinterId: string | null,
): PrinterConfiguration | null {
  if (defaultPrinterId === null) {
    return null;
  }

  return printers.find(
    (printer) => printer.id === defaultPrinterId && printer.active,
  ) ?? null;
}
