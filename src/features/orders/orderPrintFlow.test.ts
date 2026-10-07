import { describe, expect, it, vi } from "vitest";

import { createPrintCompanionResumeOwner } from "../printers/printCompanionResumeOwner";
import { PrintCompanionError } from "../printers/printCompanionTypes";
import type { PrinterConfiguration } from "../printers/printerTypes";
import {
  ORDER_RECEIPT_PRINT_BUSY_LABEL,
  ORDER_RECEIPT_PRINT_LABEL,
  resumeFrozenOrderPrint,
  printReceiptAutomatically,
} from "./orderPrintFlow";
import { createOrderPrintAttempt } from "./orderPrintAttempt";

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
    orderId: "order-1",
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

  it("does not open browser printing for a recoverable offline companion", async () => {
    const onRecoverableCompanion = vi.fn();
    const options = createOptions({
      preflight: vi.fn(async () => {
        throw new PrintCompanionError("companion_offline", "offline");
      }),
      onRecoverableCompanion,
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "wake", jobId: "job-1" });
    expect(options.browserPrint).not.toHaveBeenCalled();
    expect(options.print).not.toHaveBeenCalled();
    expect(onRecoverableCompanion).toHaveBeenCalledTimes(1);
    expect(onRecoverableCompanion.mock.calls[0]?.[0]).toMatchObject({
      intent: "print",
      jobId: "job-1",
      printer,
    });
  });

  it("uses the same explicit recovery path for pairing_required", async () => {
    const onRecoverableCompanion = vi.fn();
    const options = createOptions({
      preflight: vi.fn(async () => {
        throw new PrintCompanionError("pairing_required", "pairing required");
      }),
      onRecoverableCompanion,
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "wake" });
    expect(onRecoverableCompanion).toHaveBeenCalledTimes(1);
    expect(options.browserPrint).not.toHaveBeenCalled();
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

  it("does not fall back to browser printing when Pix bytes fail to prepare", async () => {
    const options = createOptions({
      fallbackToBrowserOnPrepareError: false,
      prepareBytes: vi.fn(async () => {
        throw new Error("QR raster is not ready");
      }),
    });

    await expect(printReceiptAutomatically(options)).rejects.toThrow("QR raster is not ready");
    expect(options.browserPrint).not.toHaveBeenCalled();
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

  it("resumes with the frozen printer, bytes and original job id", async () => {
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-1",
      orderId: "order-1",
      jobId: "job-1",
      printer,
      bytes: new Uint8Array([0, 27, 255]),
    });
    const owner = createPrintCompanionResumeOwner();
    const resumeCompanion = vi.fn(async () => undefined);
    const preflight = vi.fn(async () => undefined);
    const print = vi.fn(async () => undefined);
    const onSuccess = vi.fn();
    const result = await resumeFrozenOrderPrint({
      attempt,
      owner,
      isCurrentAttempt: () => true,
      resumeCompanion,
      preflight,
      print,
      onSuccess,
    });

    expect(result).toBe("printed");
    expect(resumeCompanion).toHaveBeenCalledTimes(1);
    expect(preflight).toHaveBeenCalledWith(expect.objectContaining({ host: printer.host, port: printer.port }));
    expect(print).toHaveBeenCalledWith(
      expect.objectContaining({ host: printer.host, port: printer.port }),
      new Uint8Array([0, 27, 255]),
      "job-1",
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("cannot print a stale attempt after it is replaced", async () => {
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-old",
      orderId: "order-1",
      jobId: "job-old",
      printer,
      bytes: new Uint8Array([1]),
    });
    const print = vi.fn(async () => undefined);

    const result = await resumeFrozenOrderPrint({
      attempt,
      owner: createPrintCompanionResumeOwner(),
      isCurrentAttempt: () => false,
      resumeCompanion: vi.fn(async () => undefined),
      preflight: vi.fn(async () => undefined),
      print,
      onSuccess: vi.fn(),
    });

    expect(result).toBe("ignored");
    expect(print).not.toHaveBeenCalled();
  });

  it("cannot double-print when a lifecycle callback arrives during resume", async () => {
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-1",
      orderId: "order-1",
      jobId: "job-1",
      printer,
      bytes: new Uint8Array([1, 2]),
    });
    const owner = createPrintCompanionResumeOwner();
    let resolveResume: (() => void) | undefined;
    const resumeCompanion = vi.fn(() => new Promise<void>((resolve) => {
      resolveResume = resolve;
    }));
    const print = vi.fn(async () => undefined);
    const options = {
      attempt,
      owner,
      isCurrentAttempt: () => true,
      resumeCompanion,
      preflight: vi.fn(async () => undefined),
      print,
      onSuccess: vi.fn(),
    };

    const first = resumeFrozenOrderPrint(options);
    const second = resumeFrozenOrderPrint(options);
    resolveResume?.();
    await Promise.all([first, second]);

    expect(resumeCompanion).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("does not expose browser printing when resume fails after a wake", async () => {
    const attempt = createOrderPrintAttempt({
      attemptId: "attempt-1",
      orderId: "order-1",
      jobId: "job-1",
      printer,
      bytes: new Uint8Array([1]),
    });
    const print = vi.fn(async () => undefined);
    const browserPrint = vi.fn();

    await expect(resumeFrozenOrderPrint({
      attempt,
      owner: createPrintCompanionResumeOwner(),
      isCurrentAttempt: () => true,
      resumeCompanion: vi.fn(async () => {
        throw new PrintCompanionError("companion_offline", "offline after wake");
      }),
      preflight: vi.fn(async () => undefined),
      print,
      onSuccess: vi.fn(),
    })).rejects.toThrow("offline after wake");

    expect(browserPrint).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it("keeps printing when logo preparation degrades to a job without a logo", async () => {
    const options = createOptions({
      prepareBytes: vi.fn(async () => new Uint8Array([0x1b, 0x40])),
    });

    await expect(printReceiptAutomatically(options)).resolves.toMatchObject({ route: "thermal" });
    expect(options.print).toHaveBeenCalledTimes(1);
  });
});
