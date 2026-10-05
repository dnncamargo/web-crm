export type BridgeStatus = "unknown" | "checking" | "online" | "offline";
export type FlowStatus = "idle" | "preparing" | "configuring" | "testing" | "pass" | "fail";
export type DiagnosticStage = "idle" | "wake" | "health" | "pair" | "config" | "test";

export function getFlowLabel(flowStatus: FlowStatus, bridgeStatus: BridgeStatus, currentStage: DiagnosticStage) {
  if (flowStatus === "pass") {
    return "Pronto";
  }

  if (flowStatus === "fail") {
    return "Falha";
  }

  if (flowStatus === "configuring") {
    return "Configurando";
  }

  if (flowStatus === "testing") {
    return "Testando";
  }

  if (flowStatus === "preparing" || bridgeStatus === "checking" || bridgeStatus === "online") {
    return currentStage === "idle" ? "Aguardando ativação" : "Conectando";
  }

  return bridgeStatus === "offline" ? "Falha" : "Aguardando ativação";
}
