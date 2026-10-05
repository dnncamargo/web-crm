export const APP_ROUTES = {
  settings: "/configuracoes",
  appearance: "/configuracoes/aparencia",
  printers: "/configuracoes/impressoras",
  diagnostic: "/configuracoes/impressoras/diagnostico",
  legacyDiagnostic: "/diagnostics/android-print-wake",
  companionActivation: "/android-print-bridge/activate",
} as const;

export function getDiagnosticRoute(printerId?: string) {
  if (!printerId) {
    return APP_ROUTES.diagnostic;
  }

  const params = new URLSearchParams({ printer: printerId });
  return `${APP_ROUTES.diagnostic}?${params.toString()}`;
}
