import { describe, expect, it } from "vitest";

import type { PrinterConfiguration } from "./printerTypes";
import { resolveDefaultPrinter, resolveDiagnosticPrinter } from "./printerUtils";

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

describe("resolveDiagnosticPrinter", () => {
  const inactivePrinter = { ...activePrinter, id: "inactive", name: "Cozinha", active: false };
  const secondActivePrinter = { ...activePrinter, id: "second", name: "Expedição" };

  it("prefers an existing query printer, including an inactive one", () => {
    expect(resolveDiagnosticPrinter([activePrinter, inactivePrinter], "active", "inactive")).toBe(inactivePrinter);
  });

  it("falls back to the active default, then the first active and first printer", () => {
    expect(resolveDiagnosticPrinter([activePrinter, secondActivePrinter], "second", "unknown")).toBe(secondActivePrinter);
    expect(resolveDiagnosticPrinter([activePrinter, secondActivePrinter], "unknown", null)).toBe(activePrinter);
    expect(resolveDiagnosticPrinter([{ ...activePrinter, active: false }, secondActivePrinter], "unknown", null)).toBe(secondActivePrinter);
    expect(resolveDiagnosticPrinter([inactivePrinter], "unknown", null)).toBe(inactivePrinter);
    expect(resolveDiagnosticPrinter([], null, null)).toBeNull();
  });
});
