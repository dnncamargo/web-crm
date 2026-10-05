import { describe, expect, it } from "vitest";

import { PrintCompanionError } from "../printers/printCompanionTypes";
import { getOrderPrintActionMode, getShortOrderPrintError } from "./orderPrintStatus";

describe("order print action and status", () => {
  it("keeps one visible Imprimir action and selects a real wake link only when needed", () => {
    expect(getOrderPrintActionMode({ readiness: "ready", busy: false, canWake: true, canUseDirectFallback: false })).toBe("direct");
    expect(getOrderPrintActionMode({ readiness: "wake-required", busy: false, canWake: true, canUseDirectFallback: false })).toBe("wake");
    expect(getOrderPrintActionMode({ readiness: "unknown", busy: false, canWake: false, canUseDirectFallback: false })).toBe("disabled");
    expect(getOrderPrintActionMode({ readiness: "unknown", busy: false, canWake: false, canUseDirectFallback: true })).toBe("direct");
    expect(getOrderPrintActionMode({ readiness: "wake-required", busy: true, canWake: true, canUseDirectFallback: false })).toBe("disabled");
  });

  it("keeps status text short and free of internal print payloads", () => {
    const error = new PrintCompanionError(
      "protocol_error",
      "token=secret nonce=private host=192.168.0.50 data=receipt-base64",
    );

    const status = getShortOrderPrintError(error);
    expect(status).toBe("Não foi possível concluir a impressão.");
    expect(status).not.toMatch(/token|nonce|host|data|base64|192\.168/);
  });
});
