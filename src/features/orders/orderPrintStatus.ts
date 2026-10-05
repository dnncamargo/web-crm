import { PrintCompanionError } from "../printers/printCompanionTypes";

export type CompanionReadiness = "unknown" | "ready" | "wake-required";
export type OrderPrintActionMode = "direct" | "wake" | "disabled";

export function getOrderPrintActionMode({
  readiness,
  busy,
  canWake,
  canUseDirectFallback,
}: {
  readiness: CompanionReadiness;
  busy: boolean;
  canWake: boolean;
  canUseDirectFallback: boolean;
}): OrderPrintActionMode {
  if (busy) {
    return "disabled";
  }

  if (readiness === "ready" || canUseDirectFallback) {
    return "direct";
  }

  return canWake ? "wake" : "disabled";
}

export function getShortOrderPrintError(error: unknown) {
  if (error instanceof PrintCompanionError) {
    switch (error.code) {
      case "companion_offline":
      case "service_stopping":
        return "Não foi possível conectar ao serviço de impressão.";
      case "pairing_required":
      case "pairing_expired":
        return "O serviço de impressão precisa ser ativado novamente.";
      case "printer_connection_failed":
      case "printer_timeout":
        return "Não foi possível conectar à impressora.";
      default:
        return "Não foi possível concluir a impressão.";
    }
  }

  return "Não foi possível concluir a impressão.";
}
