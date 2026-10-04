import { describe, expect, it } from "vitest";

import {
  ANDROID_PRINT_DIAGNOSTIC_VERSION,
  EXPECTED_COMPANION_APP_VERSION,
  EXPECTED_COMPANION_VERSION_CODE,
  getProductionDiagnosticUrl,
  isAndroidPrintDiagnosticProduction,
} from "./androidPrintDiagnostic";

describe("Android print diagnostic metadata", () => {
  it("keeps the diagnostic and companion baselines explicit", () => {
    expect(ANDROID_PRINT_DIAGNOSTIC_VERSION).toBe("1.0.2");
    expect(EXPECTED_COMPANION_APP_VERSION).toBe("1.0.0");
    expect(EXPECTED_COMPANION_VERSION_CODE).toBe(1);
  });

  it("allows only the canonical production origin", () => {
    expect(isAndroidPrintDiagnosticProduction("https://deliciasdoporto.vercel.app")).toBe(true);
    expect(isAndroidPrintDiagnosticProduction("https://web-preview.vercel.app")).toBe(false);
    expect(isAndroidPrintDiagnosticProduction("http://localhost:5173")).toBe(false);
  });

  it("builds the canonical production diagnostic URL", () => {
    expect(getProductionDiagnosticUrl()).toBe("https://deliciasdoporto.vercel.app/diagnostics/android-print-wake");
  });
});
