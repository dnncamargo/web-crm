import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../_financial/admin";
import { handleApplyCreditRequest } from "./apply-credit";

const projectId = "demo-web-crm-financial";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

if (!authEmulatorHost) {
  throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração financeira.");
}

const clientApp: FirebaseApp = initializeApp({
  apiKey: "financial-api-test-key",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
}, `financial-api-auth-${randomUUID()}`);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${authEmulatorHost}`, { disableWarnings: true });

interface EmulatorIdentity {
  email: string;
  emailVerified: boolean;
  providerId: string;
}

interface FinancialFixture {
  clientId: string;
  orderId: string;
}

function identityToken({ email, emailVerified }: EmulatorIdentity): string {
  return JSON.stringify({
    sub: `auth-${randomUUID()}`,
    email,
    email_verified: emailVerified,
  });
}

async function createFirebaseIdToken(identity: EmulatorIdentity): Promise<string> {
  const idToken = identityToken(identity);
  const credential = identity.providerId === "google.com"
    ? GoogleAuthProvider.credential(idToken)
    : new OAuthProvider(identity.providerId).credential({ idToken });
  const userCredential = await signInWithCredential(clientAuth, credential);
  return userCredential.user.getIdToken();
}

async function createFixture(allowedGoogleEmails: string[]): Promise<FinancialFixture> {
  const db = getFinancialAdminDb();
  const suffix = randomUUID();
  const clientId = `client-${suffix}`;
  const orderId = `order-${suffix}`;

  await db.doc("config/authAdmission").set({ allowedGoogleEmails });
  await db.doc(`orders/${orderId}`).set({
    clientId,
    clientName: "Cliente de teste",
    total: 80,
    amountPaid: 0,
    payments: [],
    orderStatus: "active",
    tagIds: [],
  });
  await db.doc(`clientFinancial/${clientId}`).set({
    availableCreditCents: 5000,
    revision: 1,
    state: "ready",
  });

  return { clientId, orderId };
}

function validCommand({ clientId, orderId }: FinancialFixture): Record<string, unknown> {
  return {
    operationId: `operation-${randomUUID()}`,
    clientId,
    orderId,
    applyCreditCents: 3000,
    presentedAvailableCreditCents: 5000,
    presentedRevision: 1,
    confirmed: true,
  };
}

function requestWithToken(token: string, fixture: FinancialFixture): Request {
  return new Request("http://localhost/api/financial/apply-credit", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(validCommand(fixture)),
  });
}

async function expectErrorCode(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error: { code } });
}

afterAll(async () => {
  await deleteApp(clientApp);
});

describe("apply credit HTTP authentication with Firebase Auth Emulator", () => {
  it("percorre token Google admitido, allowlist no servidor e transação Firestore", async () => {
    const email = `allowed-${randomUUID()}@example.test`;
    const fixture = await createFixture([email]);
    const token = await createFirebaseIdToken({ email, emailVerified: true, providerId: "google.com" });

    const response = await handleApplyCreditRequest(requestWithToken(token, fixture));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      clientId: fixture.clientId,
      orderId: fixture.orderId,
      appliedCreditCents: 3000,
      availableCreditCents: 2000,
    });
    expect((await getFinancialAdminDb().doc(`orders/${fixture.orderId}`).get()).data()?.creditApplied).toBe(30);
  });

  it("recusa usuário Google fora da allowlist", async () => {
    const fixture = await createFixture([`allowed-${randomUUID()}@example.test`]);
    const token = await createFirebaseIdToken({
      email: `outside-${randomUUID()}@example.test`,
      emailVerified: true,
      providerId: "google.com",
    });

    await expectErrorCode(await handleApplyCreditRequest(requestWithToken(token, fixture)), 403, "FORBIDDEN");
  });

  it("recusa provider diferente de Google", async () => {
    const email = `provider-${randomUUID()}@example.test`;
    const fixture = await createFixture([email]);
    const token = await createFirebaseIdToken({ email, emailVerified: true, providerId: "github.com" });

    await expectErrorCode(await handleApplyCreditRequest(requestWithToken(token, fixture)), 403, "FORBIDDEN");
  });

  it("recusa e-mail não verificado", async () => {
    const email = `unverified-${randomUUID()}@example.test`;
    const fixture = await createFixture([email]);
    const token = await createFirebaseIdToken({ email, emailVerified: false, providerId: "google.com" });

    await expectErrorCode(await handleApplyCreditRequest(requestWithToken(token, fixture)), 403, "FORBIDDEN");
  });

  it("recusa token inválido e token ausente", async () => {
    const fixture = await createFixture([`allowed-${randomUUID()}@example.test`]);
    const invalidTokenResponse = await handleApplyCreditRequest(requestWithToken("invalid-token", fixture));
    await expectErrorCode(invalidTokenResponse, 401, "UNAUTHENTICATED");

    const missingTokenResponse = await handleApplyCreditRequest(new Request("http://localhost/api/financial/apply-credit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validCommand(fixture)),
    }));
    await expectErrorCode(missingTokenResponse, 401, "UNAUTHENTICATED");
  });
});
