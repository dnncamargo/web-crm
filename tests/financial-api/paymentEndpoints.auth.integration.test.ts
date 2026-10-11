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

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { handleCorrectPaymentRequest } from "../../api/financial/correct-payment";
import { handleRecordPaymentRequest } from "../../api/financial/record-payment";

const projectId = "demo-web-crm-financial";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authEmulatorHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração financeira.");

const clientApp: FirebaseApp = initializeApp({
  apiKey: "financial-api-test-key",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
}, `financial-payment-api-auth-${randomUUID()}`);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${authEmulatorHost}`, { disableWarnings: true });

type Handler = (request: Request) => Promise<Response>;
type EndpointKind = "record" | "correct";

interface Identity {
  email: string;
  emailVerified: boolean;
  providerId: string;
}

interface Fixture {
  clientId: string;
  orderId: string;
}

const endpoints: readonly [EndpointKind, Handler][] = [
  ["record", handleRecordPaymentRequest],
  ["correct", handleCorrectPaymentRequest],
];

function identityToken(identity: Identity): string {
  return JSON.stringify({
    sub: `auth-${randomUUID()}`,
    email: identity.email,
    email_verified: identity.emailVerified,
  });
}

async function firebaseToken(identity: Identity): Promise<string> {
  const idToken = identityToken(identity);
  const credential = identity.providerId === "google.com"
    ? GoogleAuthProvider.credential(idToken)
    : new OAuthProvider(identity.providerId).credential({ idToken });
  return (await signInWithCredential(clientAuth, credential)).user.getIdToken();
}

async function fixture(allowedGoogleEmails: string[]): Promise<Fixture> {
  const db = getFinancialAdminDb();
  const suffix = randomUUID();
  const clientId = `client-${suffix}`;
  const orderId = `order-${suffix}`;
  await db.doc("config/authAdmission").set({ allowedGoogleEmails });
  await db.doc(`orders/${orderId}`).set({
    clientId,
    clientName: "Cliente de teste",
    total: 100,
    amountPaid: 0,
    payments: [],
    orderStatus: "active",
    tagIds: [],
  });
  await db.doc(`clientFinancial/${clientId}`).set({ availableCreditCents: 0, revision: 1, state: "ready" });
  return { clientId, orderId };
}

function command(kind: EndpointKind, value: Fixture): Record<string, unknown> {
  const paymentId = `payment-${randomUUID()}`;
  const base = {
    orderId: value.orderId,
    clientId: value.clientId,
    paymentId,
    amountCents: 1000,
    receivedAt: "2026-01-01T12:00:00.000Z",
    presentedAvailableCreditCents: 0,
    presentedRevision: 1,
  };
  return kind === "record"
    ? base
    : { ...base, expectedAmountCents: 1000, expectedReceivedAt: "2026-01-01T12:00:00.000Z" };
}

function request(token: string | null, kind: EndpointKind, body: unknown): Request {
  return new Request(`http://localhost/api/financial/${kind}-payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function expectCode(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({ error: { code } });
}

afterAll(async () => {
  await deleteApp(clientApp);
});

describe("payment endpoint authorization with Firebase Auth Emulator", () => {
  it.each(endpoints)("%s retorna 401 para token ausente ou inválido", async (kind, handler) => {
    const value = await fixture([]);
    await expectCode(await handler(request(null, kind, command(kind, value))), 401, "UNAUTHENTICATED");
    await expectCode(await handler(request("invalid-token", kind, command(kind, value))), 401, "UNAUTHENTICATED");
  });

  it.each(endpoints)("%s retorna 403 para identidade não admitida ou e-mail não verificado", async (kind, handler) => {
    const allowed = `allowed-${randomUUID()}@example.test`;
    const value = await fixture([allowed]);
    const outside = await firebaseToken({ email: `outside-${randomUUID()}@example.test`, emailVerified: true, providerId: "google.com" });
    await expectCode(await handler(request(outside, kind, command(kind, value))), 403, "FORBIDDEN");
    const unverified = await firebaseToken({ email: allowed, emailVerified: false, providerId: "google.com" });
    await expectCode(await handler(request(unverified, kind, command(kind, value))), 403, "FORBIDDEN");
  });

  it("autoriza recebimento Google admitido e retorna 400/409 para os limites do contrato", async () => {
    const email = `allowed-${randomUUID()}@example.test`;
    const value = await fixture([email]);
    const token = await firebaseToken({ email, emailVerified: true, providerId: "google.com" });
    await expectCode(await handleRecordPaymentRequest(request(token, "record", { ...command("record", value), amountCents: 0 })), 400, "INVALID_PAYLOAD");
    await expect(handleRecordPaymentRequest(request(token, "record", command("record", value))).then((response) => response.status)).resolves.toBe(200);
    await expectCode(await handleRecordPaymentRequest(request(token, "record", {
      ...command("record", value),
      presentedRevision: 0,
    })), 409, "AGGREGATOR_REVISION_CHANGED");
  });

  it("autoriza correção Google admitida", async () => {
    const email = `allowed-${randomUUID()}@example.test`;
    const value = await fixture([email]);
    const token = await firebaseToken({ email, emailVerified: true, providerId: "google.com" });
    const record = command("record", value);
    await expect(handleRecordPaymentRequest(request(token, "record", record)).then((response) => response.status)).resolves.toBe(200);
    await expect(handleCorrectPaymentRequest(request(token, "correct", {
      ...command("correct", value),
      paymentId: record.paymentId,
      expectedAmountCents: record.amountCents,
      expectedReceivedAt: record.receivedAt,
      amountCents: 1200,
      receivedAt: "2026-01-02T12:00:00.000Z",
      presentedRevision: 2,
    })).then((response) => response.status)).resolves.toBe(200);
  });
});
