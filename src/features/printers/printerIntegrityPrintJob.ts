import type { PrinterConfiguration } from "./printerTypes";
import type { PrintJob } from "./printJobTypes";
import { getPrintColumnsForPaperWidth } from "./printJobLayout";

export function createPrinterIntegrityTestJob(printer: PrinterConfiguration): PrintJob {
  const columns = getPrintColumnsForPaperWidth(printer.paperWidthMm);

  return {
    columns,
    codePage: "cp1252",
    commands: [
      { type: "alignment", alignment: "center" },
      { type: "bold", enabled: true },
      { type: "text", text: "TESTE DE IMPRESSÃO" },
      { type: "bold", enabled: false },
      { type: "feed", lines: 1 },
      { type: "alignment", alignment: "left" },
      { type: "keyValue", label: "Impressora", value: printer.name },
      { type: "keyValue", label: "Modelo", value: printer.model || "Não informado" },
      { type: "keyValue", label: "Papel", value: `${printer.paperWidthMm} mm` },
      { type: "keyValue", label: "Protocolo", value: "ESC/POS" },
      { type: "keyValue", label: "Codificação", value: "CP1252" },
      { type: "feed", lines: 1 },
      { type: "text", text: "João · Conceição · Açúcar" },
      { type: "text", text: "R$ 123,45 × 2" },
      { type: "feed", lines: 1 },
      { type: "rule" },
      { type: "bold", enabled: true },
      { type: "text", text: "Negrito: OK" },
      { type: "bold", enabled: false },
      { type: "text", text: "Alinhamento: OK" },
      { type: "text", text: "Transporte TCP: OK" },
      { type: "feed", lines: 1 },
      { type: "alignment", alignment: "center" },
      { type: "text", text: "FIM DO TESTE" },
      { type: "feed", lines: 4 },
      { type: "cut", mode: "partial" },
    ],
  };
}
