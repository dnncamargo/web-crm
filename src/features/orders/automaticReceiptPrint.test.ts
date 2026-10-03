import { describe, expect, it, vi } from "vitest";

import type { PrinterConfiguration } from "../printers/printerTypes";
import { printReceiptAutomatically } from "./automaticReceiptPrint";

const printer: PrinterConfiguration = {
  id: "printer-1",
  name: "Térmica",
  transport: "tcp",
  protocol: "escpos",
  host: "192.168.1.99",
  port: 9100,
  paperWidthMm: 80,
  codePage: "cp1252",
  active: true,
};

function createDependencies() {
  return {
    checkHealth: vi.fn<() => Promise<void>>().mockResolvedValue(),
    testConnection: vi.fn<() => Promise<void>>().mockResolvedValue(),
    createBytes: vi.fn<() => Promise<Uint8Array>>().mockResolvedValue(new Uint8Array([0x1b, 0x40])),
    printToPrinter: vi.fn<() => Promise<void>>().mockResolvedValue(),
    browserPrint: vi.fn(),
  };
}

describe("printReceiptAutomatically", () => {
  it("uses the browser when there is no default printer", async () => {
    const dependencies = createDependencies();

    await expect(printReceiptAutomatically(null, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.checkHealth).not.toHaveBeenCalled();
    expect(dependencies.createBytes).not.toHaveBeenCalled();
    expect(dependencies.printToPrinter).not.toHaveBeenCalled();
  });

  it("uses the browser when printer settings are unavailable", async () => {
    const dependencies = createDependencies();
    dependencies.checkHealth.mockRejectedValue(new Error("settings unavailable"));

    await expect(printReceiptAutomatically(printer, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.testConnection).not.toHaveBeenCalled();
    expect(dependencies.createBytes).not.toHaveBeenCalled();
    expect(dependencies.printToPrinter).not.toHaveBeenCalled();
  });

  it("uses the browser when the bridge is unavailable", async () => {
    const dependencies = createDependencies();
    dependencies.checkHealth.mockRejectedValue(new Error("bridge unavailable"));

    await expect(printReceiptAutomatically(printer, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.createBytes).not.toHaveBeenCalled();
    expect(dependencies.printToPrinter).not.toHaveBeenCalled();
  });

  it("uses the browser when the zero-byte printer preflight fails", async () => {
    const dependencies = createDependencies();
    dependencies.testConnection.mockRejectedValue(new Error("printer unavailable"));

    await expect(printReceiptAutomatically(printer, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.createBytes).not.toHaveBeenCalled();
    expect(dependencies.printToPrinter).not.toHaveBeenCalled();
  });

  it("sends the thermal job after a successful bridge and printer preflight", async () => {
    const dependencies = createDependencies();

    await expect(printReceiptAutomatically(printer, dependencies)).resolves.toBe("thermal");

    expect(dependencies.checkHealth).toHaveBeenCalledOnce();
    expect(dependencies.testConnection).toHaveBeenCalledWith({ host: printer.host, port: printer.port });
    expect(dependencies.printToPrinter).toHaveBeenCalledWith(printer, new Uint8Array([0x1b, 0x40]));
    expect(dependencies.browserPrint).not.toHaveBeenCalled();
  });

  it("does not send receipt bytes when byte generation fails during preflight", async () => {
    const dependencies = createDependencies();
    dependencies.createBytes.mockRejectedValue(new Error("unsupported paper"));

    await expect(printReceiptAutomatically(printer, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.printToPrinter).not.toHaveBeenCalled();
  });

  it("does not browser-print after thermal transmission begins and fails", async () => {
    const dependencies = createDependencies();
    const printError = new Error("transmission failed");
    dependencies.printToPrinter.mockRejectedValue(printError);

    await expect(printReceiptAutomatically(printer, dependencies)).rejects.toBe(printError);

    expect(dependencies.browserPrint).not.toHaveBeenCalled();
  });

  it("uses the browser for an incomplete default printer configuration", async () => {
    const dependencies = createDependencies();
    const incompletePrinter = { ...printer, host: "" };

    await expect(printReceiptAutomatically(incompletePrinter, dependencies)).resolves.toBe("browser");

    expect(dependencies.browserPrint).toHaveBeenCalledOnce();
    expect(dependencies.checkHealth).not.toHaveBeenCalled();
  });
});
