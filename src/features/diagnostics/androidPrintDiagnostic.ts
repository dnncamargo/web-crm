import { PRINT_COMPANION_ORIGIN } from "../printers/printCompanionTypes";

export const ANDROID_PRINT_DIAGNOSTIC_VERSION = "1.0.2" as const;
export const EXPECTED_COMPANION_APP_VERSION = "1.0.0" as const;
export const EXPECTED_COMPANION_VERSION_CODE = 1 as const;
export const ANDROID_PRINT_PRODUCTION_ORIGIN = PRINT_COMPANION_ORIGIN;
export const ANDROID_PRINT_DIAGNOSTIC_PATH = "/diagnostics/android-print-wake" as const;

export function isAndroidPrintDiagnosticProduction(origin: string) {
  return origin === ANDROID_PRINT_PRODUCTION_ORIGIN;
}

export function getProductionDiagnosticUrl() {
  return `${ANDROID_PRINT_PRODUCTION_ORIGIN}${ANDROID_PRINT_DIAGNOSTIC_PATH}`;
}
