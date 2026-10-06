export const APP_ROUTES = {
  login: "/login",
  settings: "/configuracoes",
  storeProfile: "/configuracoes/perfil-da-loja",
  appearance: "/configuracoes/aparencia",
  printers: "/configuracoes/impressoras",
  diagnostic: "/configuracoes/impressoras/diagnostico",
  legacyDiagnostic: "/diagnostics/android-print-wake",
  companionActivation: "/android-print-bridge/activate",
} as const;

export function getOrderReceiptRoute(orderId: string) {
  return `/pedidos/${encodeURIComponent(orderId)}/via`;
}

export function getDiagnosticRoute(printerId?: string) {
  if (!printerId) {
    return APP_ROUTES.diagnostic;
  }

  const params = new URLSearchParams({ printer: printerId });
  return `${APP_ROUTES.diagnostic}?${params.toString()}`;
}
