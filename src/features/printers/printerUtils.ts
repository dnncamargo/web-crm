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

export function resolveDiagnosticPrinter(
  printers: PrinterConfiguration[],
  defaultPrinterId: string | null,
  requestedPrinterId: string | null,
): PrinterConfiguration | null {
  const requestedPrinter = requestedPrinterId === null
    ? null
    : printers.find((printer) => printer.id === requestedPrinterId) ?? null;

  return requestedPrinter
    ?? resolveDefaultPrinter(printers, defaultPrinterId)
    ?? printers.find((printer) => printer.active)
    ?? printers[0]
    ?? null;
}
