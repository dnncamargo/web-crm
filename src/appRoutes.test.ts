import { describe, expect, it } from "vitest";

import { APP_ROUTES, getDiagnosticRoute, getOrderReceiptRoute } from "./appRoutes";

describe("canonical application routes", () => {
  it("keeps settings and diagnostic routes grouped", () => {
    expect(APP_ROUTES.settings).toBe("/configuracoes");
    expect(APP_ROUTES.storeProfile).toBe("/configuracoes/perfil-da-loja");
    expect(APP_ROUTES.appearance).toBe("/configuracoes/aparencia");
    expect(APP_ROUTES.printers).toBe("/configuracoes/impressoras");
    expect(APP_ROUTES.diagnostic).toBe("/configuracoes/impressoras/diagnostico");
    expect(APP_ROUTES.legacyDiagnostic).toBe("/diagnostics/android-print-wake");
    expect(APP_ROUTES.companionActivation).toBe("/android-print-bridge/activate");
    expect(APP_ROUTES.login).toBe("/login");
  });

  it("builds printer-scoped diagnostic links without exposing extra fields", () => {
    expect(getDiagnosticRoute("printer 1")).toBe("/configuracoes/impressoras/diagnostico?printer=printer+1");
  });

  it("encodes receipt order ids as internal route segments", () => {
    expect(getOrderReceiptRoute("order/one")).toBe("/pedidos/order%2Fone/via");
  });
});
