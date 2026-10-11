import { FinancialApiError } from "./errors";

function isLoopbackEmulatorHost(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(normalized)
    || normalized === "::1"
    || /^\[::1\](?::\d{1,5})?$/.test(normalized);
}

/**
 * Financial writes are intentionally available only to explicit local emulator
 * runs. No request field can change this decision.
 */
export function assertFinancialWriteTestGate(environment: NodeJS.ProcessEnv = process.env): void {
  const expectedProjectId = environment.FINANCIAL_TEST_PROJECT_ID;
  const actualProjectId = environment.GCLOUD_PROJECT ?? environment.FIREBASE_PROJECT_ID;
  const isVercelPreviewOrProduction = environment.VERCEL === "1" && environment.VERCEL_ENV !== "development";
  const isLocalRuntime = environment.VERCEL_ENV === "development" || environment.VERCEL !== "1";

  const allowed =
    environment.FINANCIAL_TEST_MODE === "enabled"
    && environment.FINANCIAL_LOCAL_EXECUTION === "enabled"
    && isLocalRuntime
    && !isVercelPreviewOrProduction
    && isLoopbackEmulatorHost(environment.FIRESTORE_EMULATOR_HOST)
    && typeof expectedProjectId === "string"
    && expectedProjectId.startsWith("demo-")
    && actualProjectId === expectedProjectId;

  if (!allowed) {
    throw new FinancialApiError(503, "FINANCIAL_OPERATION_DISABLED", "Operação financeira indisponível.");
  }
}
