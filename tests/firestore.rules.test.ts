import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const projectId = "demo-web-crm-firestore-rules-test";
const testEnvironment: RulesTestEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8"),
  },
});

const admissionConfig = {
  allowedGoogleEmails: ["allowed@example.test", "second@example.test"],
};

const allowedGoogleToken = {
  email: "allowed@example.test",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
};

async function seedAdmissionConfig() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc("config/authAdmission").set(admissionConfig);
  });
}

describe("Firestore authenticated boundary", () => {
  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seedAdmissionConfig();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("denies anonymous reads and writes", async () => {
    const authenticatedDb = testEnvironment.authenticatedContext(
      "seed-user",
      allowedGoogleToken,
    ).firestore();
    await authenticatedDb.doc("appSettings/storeProfile").set({ displayName: "Loja" });
    await authenticatedDb.doc("appSettings/theme").set({ accent: "#b87945" });
    await authenticatedDb.doc("appSettings/printing").set({ defaultPrinterId: null });
    await authenticatedDb.doc("clients/client-1").set({ name: "Cliente de teste" });

    const anonymousDb = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(anonymousDb.doc("appSettings/storeProfile").get());
    await assertFails(anonymousDb.doc("appSettings/theme").get());
    await assertFails(anonymousDb.doc("appSettings/printing").get());
    await assertFails(anonymousDb.doc("clients/client-1").get());
    await assertFails(anonymousDb.doc("clients/client-2").set({ name: "Sem acesso" }));
  });

  it("allows an admitted verified Google identity to read and write CRM data", async () => {
    const authenticatedDb = testEnvironment.authenticatedContext(
      "crm-user",
      allowedGoogleToken,
    ).firestore();

    await assertSucceeds(authenticatedDb.doc("appSettings/storeProfile").set({ displayName: "Loja" }));
    await assertSucceeds(authenticatedDb.doc("appSettings/theme").set({ accent: "#123456" }));
    await assertSucceeds(authenticatedDb.doc("clients/client-1").set({ name: "Cliente" }));
    await assertSucceeds(authenticatedDb.doc("clients/client-1").get());
    await assertSucceeds(authenticatedDb.doc("clients/client-1").update({ active: true }));

    const snapshot = await authenticatedDb.doc("clients/client-1").get();
    expect(snapshot.data()).toMatchObject({ name: "Cliente", active: true });
  });

  it("fails closed when the admission config is missing", async () => {
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("config/authAdmission").delete();
    });

    const authenticatedDb = testEnvironment.authenticatedContext(
      "missing-config-user",
      allowedGoogleToken,
    ).firestore();

    await assertFails(authenticatedDb.doc("clients/client-1").get());
    await assertFails(authenticatedDb.doc("clients/client-1").set({ name: "Sem acesso" }));
  });

  it("normalizes mixed-case Google token emails before matching the allowlist", async () => {
    const mixedCaseDb = testEnvironment.authenticatedContext("mixed-case-google", {
      ...allowedGoogleToken,
      email: "Allowed@Example.Test",
    }).firestore();

    await assertSucceeds(mixedCaseDb.doc("clients/client-1").set({ name: "Cliente" }));
    await assertSucceeds(mixedCaseDb.doc("clients/client-1").get());
  });

  it("denies a different Google identity", async () => {
    const wrongGoogleDb = testEnvironment.authenticatedContext("wrong-google", {
      email: "wrong@example.test",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }).firestore();

    await assertFails(wrongGoogleDb.doc("clients/client-1").get());
    await assertFails(wrongGoogleDb.doc("clients/client-1").set({ name: "Sem acesso" }));
  });

  it("denies an unverified allowed email", async () => {
    const unverifiedDb = testEnvironment.authenticatedContext("unverified", {
      ...allowedGoogleToken,
      email_verified: false,
    }).firestore();

    await assertFails(unverifiedDb.doc("clients/client-1").get());
  });

  it("denies an allowed email authenticated by a non-Google provider", async () => {
    const nonGoogleDb = testEnvironment.authenticatedContext("password-user", {
      ...allowedGoogleToken,
      firebase: { sign_in_provider: "password" },
    }).firestore();

    await assertFails(nonGoogleDb.doc("clients/client-1").get());
  });

  it("keeps the admission config inaccessible and immutable to clients", async () => {
    const allowedDb = testEnvironment.authenticatedContext(
      "crm-user",
      allowedGoogleToken,
    ).firestore();
    const wrongGoogleDb = testEnvironment.authenticatedContext("wrong-google", {
      email: "wrong@example.test",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }).firestore();

    await assertFails(allowedDb.doc("config/authAdmission").get());
    await assertFails(allowedDb.doc("config/authAdmission").set({
      allowedGoogleEmails: ["wrong@example.test"],
    }));
    await assertFails(wrongGoogleDb.doc("config/authAdmission").set({
      allowedGoogleEmails: ["wrong@example.test"],
    }));
  });
});
