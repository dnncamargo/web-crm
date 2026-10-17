import { FinancialApiError } from "../_financial/errors.js";

function isLoopbackEmulatorHost(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(normalized)
    || normalized === "::1"
    || /^\[::1\](?::\d{1,5})?$/.test(normalized);
}

export function assertDeletionWriteEnabled(environment: NodeJS.ProcessEnv = process.env): void {
  const expectedProjectId = environment.SAFE_DELETION_TEST_PROJECT_ID;
  const actualProjectId = environment.GCLOUD_PROJECT ?? environment.FIREBASE_PROJECT_ID;
  const localEmulatorEnabled = environment.SAFE_DELETION_TEST_MODE === "enabled"
    && environment.SAFE_DELETION_LOCAL_EXECUTION === "enabled"
    && environment.VERCEL !== "1"
    && isLoopbackEmulatorHost(environment.FIRESTORE_EMULATOR_HOST)
    && typeof expectedProjectId === "string"
    && expectedProjectId.startsWith("demo-")
    && actualProjectId === expectedProjectId;
  const productionEnabled = environment.VERCEL === "1"
    && environment.VERCEL_ENV === "production"
    && environment.SAFE_DELETION_PRODUCTION_ENABLED === "enabled";

  if (!localEmulatorEnabled && !productionEnabled) {
    throw new FinancialApiError(503, "SAFE_DELETION_DISABLED", "A exclusão segura está desativada neste ambiente.");
  }
}
