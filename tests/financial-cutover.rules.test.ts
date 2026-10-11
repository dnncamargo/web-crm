import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { runTransaction, writeBatch } from "firebase/firestore";
import { afterAll, beforeEach, describe, it } from "vitest";

const projectId = "demo-web-crm-financial-cutover-rules";
const testEnvironment: RulesTestEnvironment = await initializeTestEnvironment({
  projectId,
  firestore: {
    rules: readFileSync(
      resolve(process.cwd(), "tests/fixtures/firestore.financial-cutover.rules"),
      "utf8",
    ),
  },
});

const admissionConfig = {
  allowedGoogleEmails: ["allowed@example.test"],
};

const allowedGoogleToken = {
  email: "allowed@example.test",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
};

function allowedDb() {
  return testEnvironment.authenticatedContext("allowed-user", allowedGoogleToken).firestore();
}

async function seed() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    await database.doc("config/authAdmission").set(admissionConfig);
    await database.doc("orders/order-1").set({ total: 100, orderStatus: "active", amountPaid: 0 });
    await database.doc("clientFinancial/client-1").set({
      state: "ready",
      availableCreditCents: 0,
      revision: 0,
    });
    await database.doc("clientFinancial/client-1/operations/operation-1").set({ internal: true });
  });
}

describe("candidate financial-authority cutover Rules", () => {
  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await seed();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it("admits only verified Google identities listed by normalized email", async () => {
    const anonymous = testEnvironment.unauthenticatedContext().firestore();
    const mixedCase = testEnvironment.authenticatedContext("mixed-case", {
      ...allowedGoogleToken,
      email: "Allowed@Example.Test",
    }).firestore();
    const unverified = testEnvironment.authenticatedContext("unverified", {
      ...allowedGoogleToken,
      email_verified: false,
    }).firestore();
    const nonGoogle = testEnvironment.authenticatedContext("password-user", {
      ...allowedGoogleToken,
      firebase: { sign_in_provider: "password" },
    }).firestore();
    const unlisted = testEnvironment.authenticatedContext("unlisted", {
      ...allowedGoogleToken,
      email: "unlisted@example.test",
    }).firestore();

    await assertFails(anonymous.doc("clients/client-1").get());
    await assertSucceeds(mixedCase.doc("clients/client-1").get());
    await assertFails(unverified.doc("clients/client-1").get());
    await assertFails(nonGoogle.doc("clients/client-1").get());
    await assertFails(unlisted.doc("clients/client-1").get());
  });

  it("fails closed when admission is absent and keeps it inaccessible", async () => {
    const database = allowedDb();
    await assertFails(database.doc("config/authAdmission").get());
    await assertFails(database.doc("config/authAdmission").set(admissionConfig));

    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("config/authAdmission").delete();
    });

    await assertFails(database.doc("clients/client-1").get());
  });

  it("allows admitted reads of orders and the UI projection but not internal operations", async () => {
    const database = allowedDb();

    await assertSucceeds(database.doc("orders/order-1").get());
    await assertSucceeds(database.collection("orders").get());
    await assertSucceeds(database.doc("clientFinancial/client-1").get());
    await assertFails(database.doc("clientFinancial/client-1/operations/operation-1").get());
  });

  it("denies every direct order write shape, including partial financial and operational fields", async () => {
    const database = allowedDb();
    const order = database.doc("orders/order-1");

    await assertFails(database.doc("orders/order-create").set({ total: 50 }));
    await assertFails(order.update({ notes: "partial update" }));
    await assertFails(order.update({ orderStatus: "completed" }));
    await assertFails(order.update({ total: 120 }));
    await assertFails(order.update({ payments: [{ id: "payment-1", amount: 10, receivedAt: null }] }));
    await assertFails(order.update({ amountPaid: 10 }));
    await assertFails(order.update({ creditApplied: 10 }));
    await assertFails(order.update({ creditGenerated: 10 }));
    await assertFails(order.delete());
  });

  it("denies order writes inside batch and transaction commits", async () => {
    const database = allowedDb();
    const order = database.doc("orders/order-1");
    const batch = writeBatch(database);
    batch.update(order, { total: 120 });

    await assertFails(batch.commit());
    await assertFails(runTransaction(database, async (transaction) => {
      transaction.update(order, { amountPaid: 10 });
    }));
  });

  it("denies nested order paths so no broader match can bypass the boundary", async () => {
    const database = allowedDb();

    await assertFails(database.doc("orders/order-1/internal/attempt").set({ bypass: true }));
    await assertFails(database.doc("orders/order-1/internal/attempt").get());
  });

  it("denies every clientFinancial and operations mutation", async () => {
    const database = allowedDb();
    const aggregator = database.doc("clientFinancial/client-1");
    const operation = database.doc("clientFinancial/client-1/operations/operation-1");

    await assertFails(database.doc("clientFinancial/client-create").set({ state: "ready" }));
    await assertFails(aggregator.update({ revision: 1 }));
    await assertFails(aggregator.update({ availableCreditCents: 100 }));
    await assertFails(aggregator.update({ state: "blocked" }));
    await assertFails(aggregator.delete());
    await assertFails(database.doc("clientFinancial/client-1/operations/operation-create").set({ internal: true }));
    await assertFails(operation.update({ internal: false }));
    await assertFails(operation.delete());
  });

  it("keeps the current non-financial browser collections writable", async () => {
    const database = allowedDb();

    await assertSucceeds(database.doc("clients/client-1").set({ name: "Cliente" }));
    await assertSucceeds(database.doc("clients/client-1").update({ active: true }));
    await assertSucceeds(database.doc("addresses/address-1").set({ street: "Rua A" }));
    await assertSucceeds(database.doc("products/product-1").set({ name: "Produto" }));
    await assertSucceeds(database.doc("tags/tag-1").set({ label: "Etiqueta" }));
    await assertSucceeds(database.doc("tasks/task-1").set({ title: "Tarefa" }));
    await assertSucceeds(database.doc("printers/printer-1").set({ name: "Impressora" }));
    await assertSucceeds(database.doc("appSettings/theme").set({ accent: "#123456" }));
    await assertSucceeds(database.doc("appSettings/storeProfile").set({ displayName: "Loja" }));
    await assertSucceeds(database.doc("appSettings/pix").set({ keySource: "email" }));
    await assertSucceeds(database.doc("appSettings/printing").set({ defaultPrinterId: null }));
  });
});
