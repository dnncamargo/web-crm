import type { OrderReceiptDocument } from "./orderReceiptDocument";
import { wrapPrintText } from "../printers/printJobLayout";
import type { PrintJob, PrintJobRaster } from "../printers/printJobTypes";

export interface OrderReceiptPrintJobOptions {
  columns: number;
  brandName: string;
  logo?: PrintJobRaster;
  pixQr?: PrintJobRaster;
}

function addWrappedText(commands: PrintJob["commands"], text: string, columns: number) {
  for (const line of wrapPrintText(text, columns)) {
    commands.push({ type: "text", text: line });
  }
}

function addBoldWrappedText(commands: PrintJob["commands"], text: string, columns: number) {
  commands.push({ type: "bold", enabled: true });
  addWrappedText(commands, text, columns);
  commands.push({ type: "bold", enabled: false });
}

function addKeyValue(
  commands: PrintJob["commands"],
  label: string,
  value: string,
  options: { labelBold?: boolean; valueBold?: boolean } = {},
) {
  commands.push({ type: "keyValue", label, value, ...options });
}

export function createOrderReceiptPrintJob(
  document: OrderReceiptDocument,
  options: OrderReceiptPrintJobOptions,
): PrintJob {
  const commands: PrintJob["commands"] = [];

  commands.push({ type: "alignment", alignment: "center" });

  if (options.logo) {
    commands.push({ type: "raster", raster: options.logo });
    commands.push({ type: "feed", lines: 1 });
  } else {
    commands.push({ type: "bold", enabled: true });
    addWrappedText(commands, options.brandName, options.columns);
    commands.push({ type: "bold", enabled: false });
  }

  addBoldWrappedText(commands, document.title, options.columns);
  addWrappedText(commands, `Entrega: ${document.deliveryDateTime}`, options.columns);

  commands.push({ type: "alignment", alignment: "left" });
  addKeyValue(commands, "Cliente:", document.customerName, { labelBold: true });
  addBoldWrappedText(commands, "Entrega", options.columns);

  if (document.fulfillment.type === "delivery") {
    for (const line of document.fulfillment.lines) {
      addWrappedText(commands, line, options.columns);
    }
  } else {
    addWrappedText(commands, document.fulfillment.label, options.columns);
  }

  commands.push({ type: "rule" });
  addBoldWrappedText(commands, "Itens", options.columns);

  for (const item of document.items) {
    addKeyValue(commands, item.name, item.total, { valueBold: item.total.startsWith("R$") });
    addWrappedText(commands, item.details, options.columns);

    if (item.notes) {
      addWrappedText(commands, `Observação: ${item.notes}`, options.columns);
    }
  }

  commands.push({ type: "rule" });
  addBoldWrappedText(commands, "Resumo", options.columns);

  for (const row of document.summary.rows) {
    addKeyValue(commands, row.label, row.value, { valueBold: row.value.startsWith("R$") });
  }

  if (document.summary.settled) {
    addWrappedText(commands, "Quitado", options.columns);
  }

  if (document.summary.creditGenerated) {
    addKeyValue(
      commands,
      document.summary.creditGenerated.label,
      document.summary.creditGenerated.value,
      { valueBold: document.summary.creditGenerated.value.startsWith("R$") },
    );
  }

  commands.push({ type: "bold", enabled: true });
  addKeyValue(commands, "TOTAL", document.summary.total);
  commands.push({ type: "bold", enabled: false });

  if (options.pixQr) {
    commands.push({ type: "alignment", alignment: "center" });
    commands.push({ type: "raster", raster: options.pixQr });
  }

  commands.push({ type: "feed", lines: 3 });
  commands.push({ type: "cut", mode: "partial" });

  return {
    columns: options.columns,
    codePage: "cp1252",
    commands,
  };
}
