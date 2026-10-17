import { getApps } from "firebase-admin/app";
import { describe, expect, it } from "vitest";

import { getFinancialAdminDb, parseFirebaseServiceAccountJson } from "../../api/_financial/admin";

const testServiceAccountJson = JSON.stringify({
  type: "service_account",
  project_id: "demo-web-crm-financial",
  client_email: "financial-admin@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST ONLY\n-----END PRIVATE KEY-----\n",
});

describe("Firebase Admin configuration", () => {
  it("parses a service account and verifies the expected project", () => {
    expect(parseFirebaseServiceAccountJson(testServiceAccountJson, "demo-web-crm-financial")).toMatchObject({
      projectId: "demo-web-crm-financial",
      clientEmail: "financial-admin@example.iam.gserviceaccount.com",
    });
  });

  it("rejects malformed credentials without including their contents in the error", () => {
    const privateMaterial = "PRIVATE TEST MATERIAL";
    let caughtError: unknown;

    try {
      parseFirebaseServiceAccountJson(JSON.stringify({
        type: "service_account",
        project_id: "demo-web-crm-financial",
        client_email: "financial-admin@example.iam.gserviceaccount.com",
        private_key: privateMaterial,
      }));
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError).toMatchObject({ code: "FIREBASE_ADMIN_CREDENTIALS_INVALID" });
    if (caughtError instanceof Error) {
      expect(caughtError.message).not.toContain(privateMaterial);
    }
  });

  it("rejects credentials for a different Firebase project", () => {
    expect(() => parseFirebaseServiceAccountJson(testServiceAccountJson, "unexpected-project"))
      .toThrow("Firebase Admin server configuration is invalid.");
  });

  it("reuses the default Firebase Admin app and Firestore instance", () => {
    const db = getFinancialAdminDb();

    expect(getFinancialAdminDb()).toBe(db);
    expect(getApps().filter((app) => app.name === "[DEFAULT]")).toHaveLength(1);
    expect(getApps().find((app) => app.name === "[DEFAULT]")?.options.projectId).toBe("demo-web-crm-financial");
  });
});
