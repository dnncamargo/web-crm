import { describe, expect, it } from "vitest";

import { isFinancialApiError } from "./errors";
import { assertFinancialWriteTestGate } from "./gate";

const enabledEnvironment: NodeJS.ProcessEnv = {
  FINANCIAL_TEST_MODE: "enabled",
  FINANCIAL_LOCAL_EXECUTION: "enabled",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FINANCIAL_TEST_PROJECT_ID: "demo-web-crm-financial",
  GCLOUD_PROJECT: "demo-web-crm-financial",
};

describe("financial write test gate", () => {
  it("permite somente a combinação local explícita com emulador demo", () => {
    expect(() => assertFinancialWriteTestGate(enabledEnvironment)).not.toThrow();
    expect(() => assertFinancialWriteTestGate({
      ...enabledEnvironment,
      FIRESTORE_EMULATOR_HOST: "[::1]:8080",
    })).not.toThrow();
  });

  it.each([
    { ...enabledEnvironment, FINANCIAL_TEST_MODE: "disabled" },
    { ...enabledEnvironment, FIRESTORE_EMULATOR_HOST: undefined },
    { ...enabledEnvironment, FIRESTORE_EMULATOR_HOST: "::ffff:192.168.1.10" },
    { ...enabledEnvironment, GCLOUD_PROJECT: "production-project" },
    { ...enabledEnvironment, VERCEL: "1", VERCEL_ENV: "preview" },
  ])("falha fechada fora da configuração autorizada", (environment) => {
    try {
      assertFinancialWriteTestGate(environment);
      throw new Error("A proteção deveria recusar a escrita.");
    } catch (error) {
      expect(isFinancialApiError(error) && error.status).toBe(503);
    }
  });
});
