import { describe, expect, it } from "vitest";

import { encodeCp1252, encodePrintJob } from "./escposEncoder";
import { formatPrintKeyValue, wrapPrintText } from "./printJobLayout";
import { createPrinterIntegrityTestJob } from "./printerIntegrityPrintJob";
import type { PrintJob } from "./printJobTypes";

function checksum(bytes: Uint8Array) {
  let hash = 0x811c9dc5;

  for (const byte of bytes) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

describe("CP1252", () => {
  it("encodes the Portuguese receipt characters deterministically", () => {
    expect(Array.from(encodeCp1252("João Conceição Ângela André Luís Antônio Açúcar × · R$ 123,45"))).toEqual([
      0x4a, 0x6f, 0xe3, 0x6f, 0x20, 0x43, 0x6f, 0x6e, 0x63, 0x65, 0x69, 0xe7, 0xe3, 0x6f, 0x20, 0xc2,
      0x6e, 0x67, 0x65, 0x6c, 0x61, 0x20, 0x41, 0x6e, 0x64, 0x72, 0xe9, 0x20, 0x4c, 0x75, 0xed, 0x73,
      0x20, 0x41, 0x6e, 0x74, 0xf4, 0x6e, 0x69, 0x6f, 0x20, 0x41, 0xe7, 0xfa, 0x63, 0x61, 0x72, 0x20,
      0xd7, 0x20, 0xb7, 0x20, 0x52, 0x24, 0x20, 0x31, 0x32, 0x33, 0x2c, 0x34, 0x35,
    ]);
  });

  it("replaces unsupported characters with question marks", () => {
    expect(Array.from(encodeCp1252("Café 🙂"))).toEqual([0x43, 0x61, 0x66, 0xe9, 0x20, 0x3f]);
  });
});

describe("PrintJob layout and ESC/POS", () => {
  it("creates the 80 mm physical printer integrity test job", () => {
    const job = createPrinterIntegrityTestJob({
      id: "printer-1",
      name: "Balcão",
      model: "TA-TP510W",
      transport: "tcp",
      protocol: "escpos",
      host: "192.168.0.50",
      port: 9100,
      paperWidthMm: 80,
      codePage: "cp1252",
      active: false,
    });

    expect(job.codePage).toBe("cp1252");
    expect(job.columns).toBe(48);
    expect(job.commands.slice(0, 4)).toEqual([
      { type: "alignment", alignment: "center" },
      { type: "bold", enabled: true },
      { type: "text", text: "TESTE DE IMPRESSÃO" },
      { type: "bold", enabled: false },
    ]);
    expect(job.commands).toContainEqual({ type: "alignment", alignment: "left" });
    expect(job.commands).toContainEqual({ type: "bold", enabled: true });
    expect(job.commands).toContainEqual({ type: "bold", enabled: false });
    expect(job.commands).toContainEqual({ type: "text", text: "João · Conceição · Açúcar" });
    expect(job.commands.at(-2)).toEqual({ type: "feed", lines: 4 });
    expect(job.commands.at(-1)).toEqual({ type: "cut", mode: "partial" });

    const bytes = encodePrintJob(job);

    expect(Array.from(bytes)).toEqual(expect.arrayContaining([0xe3, 0xe7, 0xfa, 0xd7, 0xb7]));
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x01]);
  });

  it("keeps the integrity test explicitly limited to the supported 80 mm width", () => {
    expect(() => createPrinterIntegrityTestJob({
      id: "printer-1",
      name: "Balcão",
      transport: "tcp",
      protocol: "escpos",
      host: "192.168.0.50",
      port: 9100,
      paperWidthMm: 58,
      codePage: "cp1252",
      active: true,
    })).toThrow("apenas para papel de 80 mm");
  });

  it("wraps text deterministically", () => {
    expect(wrapPrintText("Alpha beta gamma", 10)).toEqual(["Alpha beta", "gamma"]);
    expect(wrapPrintText("12345678901", 10)).toEqual(["1234567890", "1"]);
    expect(wrapPrintText("linha um\nlinha dois", 12)).toEqual(["linha um", "linha dois"]);
  });

  it("right-aligns key/value rows without exceeding the columns", () => {
    const row = formatPrintKeyValue("Subtotal", "R$ 123,45", 20)[0] ?? "";
    const wrapped = formatPrintKeyValue("Uma etiqueta muito longa", "R$ 1,00", 12);

    expect(row).toHaveLength(20);
    expect(row.endsWith("R$ 123,45")).toBe(true);
    expect(wrapped.every((line) => line.length <= 12)).toBe(true);
    expect(wrapped.at(-1)).toBe("     R$ 1,00");
  });

  it("emits initialize, CP1252, alignment and bold command bytes", () => {
    const job: PrintJob = {
      columns: 48,
      codePage: "cp1252",
      commands: [
        { type: "alignment", alignment: "left" },
        { type: "alignment", alignment: "center" },
        { type: "alignment", alignment: "right" },
        { type: "bold", enabled: true },
        { type: "bold", enabled: false },
      ],
    };

    expect(Array.from(encodePrintJob(job))).toEqual([
      0x1b, 0x40, 0x1b, 0x74, 0x10,
      0x1b, 0x61, 0x00, 0x1b, 0x61, 0x01, 0x1b, 0x61, 0x02,
      0x1b, 0x45, 0x01, 0x1b, 0x45, 0x00,
    ]);
  });

  it("encodes raster dimensions/data and rejects malformed data", () => {
    const job: PrintJob = {
      columns: 48,
      codePage: "cp1252",
      commands: [{ type: "raster", raster: { widthDots: 9, heightDots: 2, data: new Uint8Array([1, 2, 3, 4]) } }],
    };

    expect(Array.from(encodePrintJob(job))).toEqual([
      0x1b, 0x40, 0x1b, 0x74, 0x10,
      0x1d, 0x76, 0x30, 0x00, 0x02, 0x00, 0x02, 0x00, 1, 2, 3, 4,
    ]);

    expect(() => encodePrintJob({
      ...job,
      commands: [{ type: "raster", raster: { widthDots: 9, heightDots: 2, data: new Uint8Array([1]) } }],
    })).toThrow("exactly 4 bytes");
  });

  it("emits the canonical partial-cut bytes", () => {
    const bytes = encodePrintJob({ columns: 48, codePage: "cp1252", commands: [{ type: "cut", mode: "partial" }] });

    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x01]);
  });

  it("produces a deterministic complete receipt byte stream", () => {
    const job: PrintJob = {
      columns: 24,
      codePage: "cp1252",
      commands: [
        { type: "alignment", alignment: "center" },
        { type: "text", text: "Pedido" },
        { type: "text", text: "João" },
        { type: "alignment", alignment: "left" },
        { type: "keyValue", label: "TOTAL", value: "R$ 123,45" },
        { type: "bold", enabled: true },
        { type: "text", text: "Pago" },
        { type: "bold", enabled: false },
        { type: "feed", lines: 3 },
        { type: "cut", mode: "partial" },
      ],
    };
    const bytes = encodePrintJob(job);

    expect(checksum(bytes)).toBe("31b70d0f");
    expect(Array.from(bytes.slice(-7))).toEqual([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x01]);
  });
});
