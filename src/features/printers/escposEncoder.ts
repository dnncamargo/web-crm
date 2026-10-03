import { formatPrintKeyValue, wrapPrintText } from "./printJobLayout";
import type { PrintJob, PrintJobCommand, PrintJobRaster } from "./printJobTypes";

const CP1252_SPECIAL_BYTES: ReadonlyMap<string, number> = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

export function encodeCp1252(text: string) {
  const bytes: number[] = [];

  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0x3f;

    if (codePoint <= 0x7f || (codePoint >= 0xa0 && codePoint <= 0xff)) {
      bytes.push(codePoint);
      continue;
    }

    bytes.push(CP1252_SPECIAL_BYTES.get(character) ?? 0x3f);
  }

  return Uint8Array.from(bytes);
}

function assertValidRaster(raster: PrintJobRaster) {
  if (!Number.isInteger(raster.widthDots) || raster.widthDots <= 0) {
    throw new Error("Raster width must be a positive integer");
  }

  if (!Number.isInteger(raster.heightDots) || raster.heightDots <= 0) {
    throw new Error("Raster height must be a positive integer");
  }

  if (!(raster.data instanceof Uint8Array)) {
    throw new Error("Raster data must be a Uint8Array");
  }

  const rowBytes = Math.ceil(raster.widthDots / 8);
  const expectedLength = rowBytes * raster.heightDots;

  if (raster.data.length !== expectedLength) {
    throw new Error(`Raster data must contain exactly ${expectedLength} bytes`);
  }

  if (raster.widthDots > 0xffff || raster.heightDots > 0xffff) {
    throw new Error("Raster dimensions must fit in two bytes");
  }
}

function appendBytes(target: number[], bytes: Uint8Array | number[]) {
  target.push(...bytes);
}

function appendTextLine(target: number[], text: string, columns: number) {
  for (const line of wrapPrintText(text, columns)) {
    appendBytes(target, encodeCp1252(line));
    target.push(0x0a);
  }
}

function appendRaster(target: number[], raster: PrintJobRaster) {
  assertValidRaster(raster);
  const widthBytes = Math.ceil(raster.widthDots / 8);

  appendBytes(target, [0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, widthBytes >> 8, raster.heightDots & 0xff, raster.heightDots >> 8]);
  appendBytes(target, raster.data);
}

function appendCommand(target: number[], command: PrintJobCommand, columns: number) {
  switch (command.type) {
    case "text":
      appendTextLine(target, command.text, columns);
      return;
    case "alignment":
      appendBytes(target, [0x1b, 0x61, { left: 0, center: 1, right: 2 }[command.alignment]]);
      return;
    case "bold":
      appendBytes(target, [0x1b, 0x45, command.enabled ? 1 : 0]);
      return;
    case "keyValue":
      for (const line of formatPrintKeyValue(command.label, command.value, columns)) {
        appendBytes(target, encodeCp1252(line));
        target.push(0x0a);
      }
      return;
    case "rule": {
      const character = [...(command.character ?? "-")][0] ?? "-";
      appendTextLine(target, character.repeat(columns), columns);
      return;
    }
    case "feed":
      if (!Number.isInteger(command.lines) || command.lines < 0) {
        throw new Error("Feed lines must be a non-negative integer");
      }
      target.push(...Array.from({ length: command.lines }, () => 0x0a));
      return;
    case "raster":
      appendRaster(target, command.raster);
      return;
    case "cut":
      if (command.mode === "partial") {
        appendBytes(target, [0x1d, 0x56, 0x42, 0x01]);
      }
      return;
  }
}

export function encodePrintJob(job: PrintJob) {
  if (job.codePage !== "cp1252") {
    throw new Error(`Unsupported print job code page: ${job.codePage}`);
  }

  if (!Number.isInteger(job.columns) || job.columns <= 0) {
    throw new Error("PrintJob columns must be a positive integer");
  }

  const bytes: number[] = [0x1b, 0x40, 0x1b, 0x74, 0x10];

  for (const command of job.commands) {
    appendCommand(bytes, command, job.columns);
  }

  return Uint8Array.from(bytes);
}
