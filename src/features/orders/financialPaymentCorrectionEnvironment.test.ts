import { describe, expect, it } from "vitest";

import { isLocalFinancialPaymentCorrectionEnvironmentEnabled } from "./financialPaymentCorrectionEnvironment";

const localEnvironment = {
  dev: true,
  hostname: "localhost",
  financialTestMode: "enabled",
  financialLocalExecution: "enabled",
  financialTestProjectId: "demo-web-crm-financial",
  firebaseProjectId: "demo-web-crm-financial",
  firestoreEmulatorHost: "127.0.0.1:8080",
  authEmulatorHost: "http://127.0.0.1:9099",
};

describe("financial payment correction local environment", () => {
  it("enables correction only with the explicit local emulator configuration", () => {
    expect(isLocalFinancialPaymentCorrectionEnvironmentEnabled(localEnvironment)).toBe(true);
  });

  it.each([
    { ...localEnvironment, dev: false },
    { ...localEnvironment, hostname: "crm-preview.vercel.app" },
    { ...localEnvironment, authEmulatorHost: undefined },
    { ...localEnvironment, firebaseProjectId: "production-project" },
    { ...localEnvironment, firestoreEmulatorHost: "firestore.googleapis.com:8080" },
    { ...localEnvironment, authEmulatorHost: "https://127.0.0.1:9099" },
  ])("keeps correction unavailable when any local-only requirement is missing", (environment) => {
    expect(isLocalFinancialPaymentCorrectionEnvironmentEnabled(environment)).toBe(false);
  });
});
