import { FinancialApiError } from "./errors.js";

function isLoopbackEmulatorHost(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();
  return /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(normalized)
    || normalized === "::1"
    || /^\[::1\](?::\d{1,5})?$/.test(normalized);
}

function isFinancialWriteTestEnvironment(environment: NodeJS.ProcessEnv): boolean {
  const expectedProjectId = environment.FINANCIAL_TEST_PROJECT_ID;
  const actualProjectId = environment.GCLOUD_PROJECT ?? environment.FIREBASE_PROJECT_ID;
  const isVercelPreviewOrProduction = environment.VERCEL === "1" && environment.VERCEL_ENV !== "development";
  const isLocalRuntime = environment.VERCEL_ENV === "development" || environment.VERCEL !== "1";

  return environment.FINANCIAL_TEST_MODE === "enabled"
    && environment.FINANCIAL_LOCAL_EXECUTION === "enabled"
    && isLocalRuntime
    && !isVercelPreviewOrProduction
    && isLoopbackEmulatorHost(environment.FIRESTORE_EMULATOR_HOST)
    && typeof expectedProjectId === "string"
    && expectedProjectId.startsWith("demo-")
    && actualProjectId === expectedProjectId;
}

/**
 * All experimental financial writes remain local-Emulator-only.
 * No request field can change this decision.
 */
export function assertFinancialWriteTestGate(environment: NodeJS.ProcessEnv = process.env): void {
  if (!isFinancialWriteTestEnvironment(environment)) {
    throw new FinancialApiError(503, "FINANCIAL_OPERATION_DISABLED", "Operação financeira indisponível.");
  }
}

export type PaymentCorrectionWriteMode = "emulator" | "production";

/**
 * The one production exception is payment correction. Preview stays disabled.
 * The caller must still authenticate the Google allowlisted operator and run
 * the production-specific reconciliation/precondition transaction.
 */
export function assertPaymentCorrectionWriteGate(
  environment: NodeJS.ProcessEnv = process.env,
): PaymentCorrectionWriteMode {
  if (isFinancialWriteTestEnvironment(environment)) {
    return "emulator";
  }

  if (environment.VERCEL === "1" && environment.VERCEL_ENV === "production") {
    return "production";
  }

  throw new FinancialApiError(503, "FINANCIAL_OPERATION_DISABLED", "Operação financeira indisponível.");
}
