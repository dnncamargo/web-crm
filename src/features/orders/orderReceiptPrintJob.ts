import type { OrderReceiptDocument } from "./orderReceiptDocument";
import { wrapPrintText } from "../printers/printJobLayout";
import type { PrintJob, PrintJobRaster } from "../printers/printJobTypes";

export interface OrderReceiptPrintJobOptions {
  columns: number;
  brandName: string;
  logo?: PrintJobRaster;
}

function addWrappedText(commands: PrintJob["commands"], text: string, columns: number) {
  for (const line of wrapPrintText(text, columns)) {
    commands.push({ type: "text", text: line });
  }
}

export function createOrderReceiptPrintJob(
  document: OrderReceiptDocument,
  options: OrderReceiptPrintJobOptions,
): PrintJob {
  const commands: PrintJob["commands"] = [];

  commands.push({ type: "alignment", alignment: "center" });

  if (options.logo) {
    commands.push({ type: "raster", raster: options.logo });
  } else {
    commands.push({ type: "bold", enabled: true });
    addWrappedText(commands, options.brandName, options.columns);
    commands.push({ type: "bold", enabled: false });
  }

  addWrappedText(commands, document.title, options.columns);
  addWrappedText(commands, `Entrega: ${document.deliveryDateTime}`, options.columns);

  commands.push({ type: "alignment", alignment: "left" });
  commands.push({ type: "keyValue", label: "Cliente", value: document.customerName });
  addWrappedText(commands, "Entrega", options.columns);

  if (document.fulfillment.type === "delivery") {
    for (const line of document.fulfillment.lines) {
      addWrappedText(commands, line, options.columns);
    }
  } else {
    addWrappedText(commands, document.fulfillment.label, options.columns);
  }

  commands.push({ type: "rule" });
  addWrappedText(commands, "Itens", options.columns);

  for (const item of document.items) {
    commands.push({ type: "keyValue", label: item.name, value: item.total });
    addWrappedText(commands, item.details, options.columns);

    if (item.notes) {
      addWrappedText(commands, `Observação: ${item.notes}`, options.columns);
    }
  }

  commands.push({ type: "rule" });
  addWrappedText(commands, "Resumo", options.columns);

  for (const row of document.summary.rows) {
    commands.push({ type: "keyValue", label: row.label, value: row.value });
  }

  if (document.summary.settled) {
    addWrappedText(commands, "Quitado", options.columns);
  }

  if (document.summary.creditGenerated) {
    commands.push({
      type: "keyValue",
      label: document.summary.creditGenerated.label,
      value: document.summary.creditGenerated.value,
    });
  }

  commands.push({ type: "bold", enabled: true });
  commands.push({ type: "keyValue", label: "TOTAL", value: document.summary.total });
  commands.push({ type: "bold", enabled: false });
  commands.push({ type: "feed", lines: 3 });
  commands.push({ type: "cut", mode: "partial" });

  return {
    columns: options.columns,
    codePage: "cp1252",
    commands,
  };
}
