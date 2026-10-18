import { afterEach, describe, expect, it, vi } from "vitest";

import * as admin from "../../api/_financial/admin";
import { handleCorrectPaymentRequest } from "../../api/financial/correct-payment";

function useProductionGate(): void {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "production");
}

function stubAdmissionDocument(snapshot: {
  exists: boolean;
  allowedGoogleEmails?: unknown;
}): void {
  const db = {
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        exists: snapshot.exists,
        data: () => ({ allowedGoogleEmails: snapshot.allowedGoogleEmails }),
      }),
    })),
  } as unknown as ReturnType<typeof admin.getFinancialAdminDb>;

  vi.spyOn(admin, "getFinancialAdminDb").mockReturnValue(db);
}

describe("GET /api/financial/correct-payment readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 204 when Production has a usable Google admission allowlist", async () => {
    useProductionGate();
    stubAdmissionDocument({ exists: true, allowedGoogleEmails: ["operator@example.test"] });

    const response = await handleCorrectPaymentRequest(new Request("https://example.test/api/financial/correct-payment"));

    expect(response.status).toBe(204);
  });

  it.each([
    { exists: false, allowedGoogleEmails: ["operator@example.test"] },
    { exists: true, allowedGoogleEmails: [] },
    { exists: true, allowedGoogleEmails: ["invalid-email"] },
    { exists: true, allowedGoogleEmails: ["operator@example.test", "invalid-email"] },
  ])("returns a disabled response for an absent or unusable allowlist", async (snapshot) => {
    useProductionGate();
    stubAdmissionDocument(snapshot);

    const response = await handleCorrectPaymentRequest(new Request("https://example.test/api/financial/correct-payment"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });

  it("keeps the readiness route blocked in Preview without reading Firestore", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    const getDb = vi.spyOn(admin, "getFinancialAdminDb");

    const response = await handleCorrectPaymentRequest(new Request("https://example.test/api/financial/correct-payment"));

    expect(response.status).toBe(503);
    expect(getDb).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });

  it("reports missing Production Admin credentials safely and keeps INTERNAL_ERROR", async () => {
    useProductionGate();
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "production-project");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handleCorrectPaymentRequest(new Request("https://example.test/api/financial/correct-payment"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: { code: "INTERNAL_ERROR" } });
    expect(log).toHaveBeenCalledWith("Financial payment correction readiness failed", {
      name: "FirebaseAdminConfigurationError",
      code: "FIREBASE_ADMIN_CREDENTIALS_MISSING",
    });
  });
});
