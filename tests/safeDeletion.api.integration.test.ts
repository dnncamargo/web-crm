import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { Timestamp } from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../api/_financial/admin";
import { handleDeleteOrderRequest } from "../api/delete-order";
import { confirmedTestOrderDeletionFixtures, testOrderDeletionConfirmation } from "../src/features/orders/testOrderDeletion";

const projectId = "demo-web-crm-safe-deletion-api";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authEmulatorHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração da API de exclusão.");

const clientApp: FirebaseApp = initializeApp({
  apiKey: "safe-deletion-api-test-key",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
}, `safe-deletion-api-${randomUUID()}`);
const auth = getAuth(clientApp);
connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });

const orderIds = confirmedTestOrderDeletionFixtures.map((fixture) => fixture.id);
let clientId = "";
let admittedEmail = "";

async function cleanupFixtureSet() {
  const db = getFinancialAdminDb();
  for (const orderId of orderIds) {
    const orderRef = db.doc(`orders/${orderId}`);
    for (const collection of await orderRef.listCollections()) {
      const documents = await collection.get();
      for (const document of documents.docs) {
        for (const nested of await document.ref.listCollections()) {
          const nestedDocuments = await nested.get();
          await Promise.all(nestedDocuments.docs.map((entry) => entry.ref.delete()));
        }
        await document.ref.delete();
      }
    }
    await orderRef.delete().catch(() => undefined);
  }
  if (clientId) {
    const aggregatorRef = db.doc(`clientFinancial/${clientId}`);
    for (const collection of await aggregatorRef.listCollections()) {
      const documents = await collection.get();
      await Promise.all(documents.docs.map((document) => document.ref.delete()));
    }
    await aggregatorRef.delete().catch(() => undefined);
    await db.doc(`clients/${clientId}`).delete().catch(() => undefined);
    const extras = await db.collection("orders").where("clientId", "==", clientId).get();
    await Promise.all(extras.docs.map((document) => document.ref.delete()));
  }
}

async function googleToken(email: string): Promise<string> {
  const credential = GoogleAuthProvider.credential(JSON.stringify({
    sub: `safe-deletion-${randomUUID()}`,
    email,
    email_verified: true,
  }));
  return (await signInWithCredential(auth, credential)).user.getIdToken();
}

function request(orderId: string, token: string | null, confirmation = true): Request {
  return new Request("http://localhost/api/delete-order", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(confirmation ? { "x-test-data-confirmation": testOrderDeletionConfirmation } : {}),
    },
    body: JSON.stringify({ orderId }),
  });
}

async function seedFixtureSet(statusOverrides: Partial<Record<string, "active" | "completed" | "cancelled">> = {}) {
  const db = getFinancialAdminDb();
  clientId = `client-${randomUUID()}`;
  await db.doc(`clients/${clientId}`).set({ name: "Cliente Teste", active: true });
  for (const [index, fixture] of confirmedTestOrderDeletionFixtures.entries()) {
    const total = fixture.totalCents / 100;
    const cashPaid = fixture.cashPaidCents / 100;
    await db.doc(`orders/${fixture.id}`).set({
      clientId,
      clientName: "Cliente Teste",
      orderStatus: statusOverrides[fixture.id] ?? "cancelled",
      total,
      subtotal: total,
      deliveryFee: 0,
      items: [{ id: `item-${index}`, productId: "product-test", productName: "Produto fictício", quantity: 1, unitPrice: total, total }],
      amountPaid: cashPaid,
      payments: cashPaid > 0 ? [{ id: `payment-${index}`, amount: cashPaid, receivedAt: "2026-10-02T12:00:00Z" }] : [],
      creditApplied: 0,
      creditGenerated: Math.max(fixture.cashPaidCents - fixture.totalCents, 0) / 100,
      refunds: [],
    });
  }
}

async function expectApiError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error: { code, message: expect.any(String) } });
}

beforeEach(async () => {
  await cleanupFixtureSet();
  admittedEmail = `admitted-${randomUUID()}@example.test`;
  await getFinancialAdminDb().doc("config/authAdmission").set({ allowedGoogleEmails: [admittedEmail] });
});

afterAll(async () => {
  await cleanupFixtureSet();
  await getFinancialAdminDb().doc("config/authAdmission").delete().catch(() => undefined);
  await deleteApp(clientApp);
});

describe("safe order deletion HTTP API in Firebase Emulator", () => {
  it("reports actual HTTP status and typed code for missing authentication", async () => {
    await seedFixtureSet();
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, null)), 401, "UNAUTHENTICATED");
    expect((await getFinancialAdminDb().doc(`orders/${orderIds[0]}`).get()).exists).toBe(true);
  });

  it.each(["active", "completed"] as const)("blocks a %s member and preserves the entire set", async (status) => {
    await seedFixtureSet({ [orderIds[1]!]: status });
    const token = await googleToken(admittedEmail);
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, token)), 409, "TEST_DATA_NOT_CANCELLED");
    for (const orderId of orderIds) expect((await getFinancialAdminDb().doc(`orders/${orderId}`).get()).exists).toBe(true);
  });

  it("atomically removes exactly the three cancelled fixtures after authenticating", async () => {
    await seedFixtureSet();
    const token = await googleToken(admittedEmail);
    const response = await handleDeleteOrderRequest(request(orderIds[0]!, token));
    expect(response.status).toBe(204);
    for (const orderId of orderIds) expect((await getFinancialAdminDb().doc(`orders/${orderId}`).get()).exists).toBe(false);
  });

  it("removes a nonzero aggregator only when its balance matches the exact fixture projection", async () => {
    await seedFixtureSet();
    const db = getFinancialAdminDb();
    const aggregatorRef = db.doc(`clientFinancial/${clientId}`);
    await aggregatorRef.set({ state: "ready", availableCreditCents: 4000, revision: 3, updatedAt: Timestamp.now() });
    const operationRef = aggregatorRef.collection("operations").doc("test-operation-123");
    await operationRef.set({
      fingerprint: "b".repeat(64),
      result: {
        operationId: "test-operation-123",
        clientId,
        orderId: orderIds[1],
        appliedCents: 0,
        availableCreditCents: 4000,
        revision: 3,
      },
      actorUid: "test-actor",
      createdAt: Timestamp.now(),
    });
    const token = await googleToken(admittedEmail);
    const response = await handleDeleteOrderRequest(request(orderIds[0]!, token));
    expect(response.status).toBe(204);
    expect((await aggregatorRef.get()).exists).toBe(false);
    expect((await operationRef.get()).exists).toBe(false);
    for (const orderId of orderIds) expect((await db.doc(`orders/${orderId}`).get()).exists).toBe(false);
  });

  it("blocks an unattributable aggregator without partially deleting any record", async () => {
    await seedFixtureSet();
    const db = getFinancialAdminDb();
    const aggregatorRef = db.doc(`clientFinancial/${clientId}`);
    await aggregatorRef.set({ state: "ready", availableCreditCents: 4500, revision: 3 });
    const token = await googleToken(admittedEmail);
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, token)), 409, "TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE");
    expect((await aggregatorRef.get()).exists).toBe(true);
    for (const orderId of orderIds) expect((await db.doc(`orders/${orderId}`).get()).exists).toBe(true);
  });

  it("blocks extra Orders and unknown subcollections without partial deletion", async () => {
    await seedFixtureSet();
    const db = getFinancialAdminDb();
    const token = await googleToken(admittedEmail);
    await db.collection("orders").doc("external-test-order").set({ clientId, orderStatus: "active" });
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, token)), 409, "TEST_CLIENT_HAS_OTHER_ORDERS");
    await db.doc("orders/external-test-order").delete();
    await db.doc(`orders/${orderIds[0]}/auditEvents/event-1`).set({ value: "unknown dependency" });
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, token)), 409, "TEST_DATA_DEPENDENCY_UNATTRIBUTABLE");
    for (const orderId of orderIds) expect((await db.doc(`orders/${orderId}`).get()).exists).toBe(true);
  });

  it("blocks aggregator operations associated with an external Order and preserves all data", async () => {
    await seedFixtureSet();
    const db = getFinancialAdminDb();
    const aggregatorRef = db.doc(`clientFinancial/${clientId}`);
    await aggregatorRef.set({ state: "ready", availableCreditCents: 4000, revision: 3 });
    await aggregatorRef.collection("operations").doc("external-operation-123").set({
      fingerprint: "c".repeat(64),
      result: { operationId: "external-operation-123", clientId, orderId: "old-order-outside-set", appliedCents: 0, availableCreditCents: 4000, revision: 3 },
      actorUid: "test-actor",
      createdAt: Timestamp.now(),
    });
    const token = await googleToken(admittedEmail);
    await expectApiError(await handleDeleteOrderRequest(request(orderIds[0]!, token)), 409, "TEST_DATA_FINANCIAL_STATE_UNATTRIBUTABLE");
    expect((await aggregatorRef.get()).exists).toBe(true);
    for (const orderId of orderIds) expect((await db.doc(`orders/${orderId}`).get()).exists).toBe(true);
  });
});
