import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, OAuthProvider, signInWithCredential } from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { handleCreateOrderRequest } from "../../api/financial/create-order";

const projectId = "demo-web-crm-financial";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authEmulatorHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração financeira.");

const clientApp: FirebaseApp = initializeApp({ apiKey: "financial-api-test-key", authDomain: `${projectId}.firebaseapp.com`, projectId }, `financial-create-auth-${randomUUID()}`);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${authEmulatorHost}`, { disableWarnings: true });

interface Identity {
  email: string;
  verified: boolean;
  provider: string;
}

function request(token: string | null, body: unknown): Request {
  return new Request("http://localhost/api/financial/create-order", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

async function firebaseToken(identity: Identity): Promise<string> {
  const idToken = JSON.stringify({ sub: `auth-${randomUUID()}`, email: identity.email, email_verified: identity.verified });
  const credential = identity.provider === "google.com"
    ? GoogleAuthProvider.credential(idToken)
    : new OAuthProvider(identity.provider).credential({ idToken });
  return (await signInWithCredential(clientAuth, credential)).user.getIdToken();
}

function validCommand() {
  const suffix = randomUUID();
  return {
    orderId: `order-${suffix}`,
    clientId: `client-${suffix}`,
    clientName: "Cliente sintético",
    deliveryDateTime: "2026-11-01T12:00:00-03:00",
    items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPriceCents: 1000, totalCents: 1000 }],
    subtotalCents: 1000,
    deliveryFeeCents: 0,
    totalCents: 1000,
    orderStatus: "active",
    tagIds: [],
  };
}

afterAll(async () => deleteApp(clientApp));

describe("create order HTTP authentication with Firebase Auth Emulator", () => {
  it("autoriza Google admitido e persiste pelo comando transacional", async () => {
    const email = `allowed-${randomUUID()}@example.test`;
    await getFinancialAdminDb().doc("config/authAdmission").set({ allowedGoogleEmails: [email] });
    const token = await firebaseToken({ email, verified: true, provider: "google.com" });
    const body = validCommand();
    const response = await handleCreateOrderRequest(request(token, body));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ orderId: body.orderId, replayed: false });
    expect((await getFinancialAdminDb().doc(`orders/${body.orderId}`).get()).exists).toBe(true);
  });

  it("recusa identidade Google fora da allowlist e provider diferente", async () => {
    const allowed = `allowed-${randomUUID()}@example.test`;
    await getFinancialAdminDb().doc("config/authAdmission").set({ allowedGoogleEmails: [allowed] });
    const outsideToken = await firebaseToken({ email: `outside-${randomUUID()}@example.test`, verified: true, provider: "google.com" });
    expect((await handleCreateOrderRequest(request(outsideToken, validCommand()))).status).toBe(403);
    const otherProvider = await firebaseToken({ email: allowed, verified: true, provider: "github.com" });
    expect((await handleCreateOrderRequest(request(otherProvider, validCommand()))).status).toBe(403);
  });
});
