import { describe, expect, it, vi } from "vitest";

import type { PrinterConfiguration } from "../printers/printerTypes";
import {
  ORDER_RECEIPT_PRINT_BUSY_LABEL,
  ORDER_RECEIPT_PRINT_LABEL,
  printReceiptAutomatically,
} from "./orderPrintFlow";

const printer: PrinterConfiguration = {
  id: "printer-1",
  name: "Balcão",
  transport: "tcp",
  protocol: "escpos",
  host: "192.168.0.50",
  port: 9100,
  paperWidthMm: 80,
  codePage: "cp1252",
  active: true,
};

function createOptions(overrides: Partial<Parameters<typeof printReceiptAutomatically>[0]> = {}) {
  return {
    printer,
    createJobId: vi.fn(() => "job-1"),
    preflight: vi.fn(async () => undefined),
    prepareBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    print: vi.fn(async () => undefined),
    browserPrint: vi.fn(),
    ...overrides,
  };
}

describe("order print cutover", () => {
  it("keeps one visible print action", () => {
    expect(ORDER_RECEIPT_PRINT_LABEL).toBe("Imprimir");
    expect(ORDER_RECEIPT_PRINT_BUSY_LABEL).toBe("Imprimindo…");
  });

  it("uses the browser when no valid thermal printer exists", async () => {
    const options = createOptions({ printer: null });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "browser" });
    expect(options.browserPrint).toHaveBeenCalledTimes(1);
    expect(options.preflight).not.toHaveBeenCalled();
    expect(options.print).not.toHaveBeenCalled();
  });

  it("falls back before print when the companion preflight is offline", async () => {
    const options = createOptions({
      preflight: vi.fn(async () => {
        throw new Error("companion offline");
      }),
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "browser" });
    expect(options.browserPrint).toHaveBeenCalledTimes(1);
    expect(options.print).not.toHaveBeenCalled();
  });

  it("falls back before print when the printer preflight fails", async () => {
    const options = createOptions({
      preflight: vi.fn(async () => {
        throw new Error("printer unavailable");
      }),
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "browser" });
    expect(options.browserPrint).toHaveBeenCalledTimes(1);
    expect(options.print).not.toHaveBeenCalled();
  });

  it("sends prepared bytes through the canonical print client once", async () => {
    const options = createOptions();

    await expect(printReceiptAutomatically(options)).resolves.toEqual({ route: "thermal", jobId: "job-1" });
    expect(options.prepareBytes).toHaveBeenCalledTimes(1);
    expect(options.print).toHaveBeenCalledTimes(1);
    expect(options.print).toHaveBeenCalledWith(printer, new Uint8Array([1, 2, 3]), "job-1");
    expect(options.browserPrint).not.toHaveBeenCalled();
  });

  it("creates a new job id for each explicit intention", async () => {
    const createJobId = vi.fn()
      .mockReturnValueOnce("job-1")
      .mockReturnValueOnce("job-2");
    const jobIds: string[] = [];
    const options = createOptions({
      createJobId,
      print: vi.fn(async (_printer: PrinterConfiguration, _bytes: Uint8Array, jobId: string) => {
        jobIds.push(jobId);
      }),
    });

    await printReceiptAutomatically(options);
    await printReceiptAutomatically(options);

    expect(createJobId).toHaveBeenCalledTimes(2);
    expect(jobIds).toEqual(["job-1", "job-2"]);
  });

  it("never falls back after the physical print call has started", async () => {
    const options = createOptions({
      print: vi.fn(async () => {
        throw new Error("print rejected after send started");
      }),
    });

    await expect(printReceiptAutomatically(options)).rejects.toThrow("print rejected after send started");
    expect(options.browserPrint).not.toHaveBeenCalled();
  });

  it("keeps printing when logo preparation degrades to a job without a logo", async () => {
    const options = createOptions({
      prepareBytes: vi.fn(async () => new Uint8Array([0x1b, 0x40])),
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "thermal" });
    expect(options.print).toHaveBeenCalledTimes(1);
  });
});
