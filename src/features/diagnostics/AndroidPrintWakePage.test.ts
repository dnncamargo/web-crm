import { describe, expect, it } from "vitest";

import { getFlowLabel } from "./androidPrintDiagnosticUi";

describe("Android diagnostic status labels", () => {
  it("uses sentence case without a badge-style status token", () => {
    expect(getFlowLabel("idle", "unknown", "idle")).toBe("Aguardando ativação");
    expect(getFlowLabel("preparing", "checking", "health")).toBe("Conectando");
    expect(getFlowLabel("configuring", "online", "config")).toBe("Configurando");
    expect(getFlowLabel("testing", "online", "test")).toBe("Testando");
    expect(getFlowLabel("pass", "online", "test")).toBe("Pronto");
    expect(getFlowLabel("fail", "offline", "test")).toBe("Falha");
    expect(getFlowLabel("idle", "unknown", "idle")).not.toContain("#");
  });
});
