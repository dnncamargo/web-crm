import { describe, expect, it } from "vitest";

import type { PrinterConfiguration } from "./printerTypes";
import { resolveDefaultPrinter } from "./printerUtils";

const activePrinter: PrinterConfiguration = {
  id: "active",
  name: "Balcão",
  transport: "tcp",
  protocol: "escpos",
  host: "192.168.0.50",
  port: 9100,
  paperWidthMm: 80,
  codePage: "cp1252",
  active: true,
};

describe("resolveDefaultPrinter", () => {
  it("returns null when no default is configured", () => {
    expect(resolveDefaultPrinter([activePrinter], null)).toBeNull();
  });

  it("returns null when the configured default is unknown", () => {
    expect(resolveDefaultPrinter([activePrinter], "unknown")).toBeNull();
  });

  it("returns null when the configured default is inactive", () => {
    expect(resolveDefaultPrinter([{ ...activePrinter, active: false }], "active")).toBeNull();
  });

  it("returns the matching active default printer", () => {
    expect(resolveDefaultPrinter([activePrinter], "active")).toBe(activePrinter);
  });
});
