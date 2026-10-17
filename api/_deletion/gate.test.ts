import { describe, expect, it } from "vitest";

import { FinancialApiError } from "../_financial/errors";
import { assertDeletionWriteEnabled } from "./gate";

describe("safe deletion write gate", () => {
  it("stays disabled by default, including on production", () => {
    for (const environment of [
      {},
      { VERCEL: "1", VERCEL_ENV: "production" },
      { VERCEL: "1", VERCEL_ENV: "preview", SAFE_DELETION_PRODUCTION_ENABLED: "enabled" },
    ]) {
      expect(() => assertDeletionWriteEnabled(environment)).toThrowError(FinancialApiError);
    }
  });

  it("allows an explicitly configured demo-project Emulator run", () => {
    expect(() => assertDeletionWriteEnabled({
      SAFE_DELETION_TEST_MODE: "enabled",
      SAFE_DELETION_LOCAL_EXECUTION: "enabled",
      SAFE_DELETION_TEST_PROJECT_ID: "demo-safe-deletion",
      GCLOUD_PROJECT: "demo-safe-deletion",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    })).not.toThrow();
  });

  it("requires the explicit production flag and does not enable preview writes", () => {
    expect(() => assertDeletionWriteEnabled({
      VERCEL: "1",
      VERCEL_ENV: "production",
      SAFE_DELETION_PRODUCTION_ENABLED: "enabled",
    })).not.toThrow();
    expect(() => assertDeletionWriteEnabled({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      SAFE_DELETION_PRODUCTION_ENABLED: "enabled",
    })).toThrowError(FinancialApiError);
  });
});
