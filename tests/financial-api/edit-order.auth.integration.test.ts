import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, OAuthProvider, signInWithCredential } from "firebase/auth";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { handleEditOrderRequest } from "../../api/financial/edit-order";
import { getFinancialAdminDb } from "../../api/_financial/admin";

const projectId = "demo-web-crm-financial";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authEmulatorHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração financeira.");

const clientApp: FirebaseApp = initializeApp({ apiKey: "financial-api-test-key", authDomain: `${projectId}.firebaseapp.com`, projectId }, `financial-edit-auth-${randomUUID()}`);
const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${authEmulatorHost}`, { disableWarnings: true });

function request(token: string | null, orderId: string, clientId: string): Request {
  return new Request("http://localhost/api/financial/edit-order", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ kind: "operational", orderId, clientId, expected: { updatedAt: null }, changes: { notes: "Nota" } }),
  });
}

async function googleToken(email: string, provider = "google.com"): Promise<string> {
  const idToken = JSON.stringify({ sub: `auth-${randomUUID()}`, email, email_verified: true });
  const credential = provider === "google.com"
    ? GoogleAuthProvider.credential(idToken)
    : new OAuthProvider(provider).credential({ idToken });
  return (await signInWithCredential(clientAuth, credential)).user.getIdToken();
}

afterAll(async () => deleteApp(clientApp));
afterEach(() => vi.unstubAllEnvs());

describe("edit order HTTP boundary", () => {
  it.each(["preview", "production"]) ("blocks %s before auth or Firestore access", async (vercelEnvironment) => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", vercelEnvironment);
    const response = await handleEditOrderRequest(request(null, `order-${randomUUID()}`, `client-${randomUUID()}`));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { code: "FINANCIAL_OPERATION_DISABLED" } });
  });

  it("requires an admitted verified Google identity", async () => {
    const allowed = `allowed-${randomUUID()}@example.test`;
    await getFinancialAdminDb().doc("config/authAdmission").set({ allowedGoogleEmails: [allowed] });
    const clientId = `client-${randomUUID()}`;
    const orderId = `order-${randomUUID()}`;
    await getFinancialAdminDb().doc(`orders/${orderId}`).set({
      clientId, clientName: "Cliente", orderStatus: "active", deliveryDateTime: "2026-11-01T12:00:00Z",
      items: [{ id: "item-1", productId: "product-1", productName: "Produto", quantity: 1, unitPrice: 100, total: 100 }],
      subtotal: 100, deliveryFee: 0, total: 100, amountPaid: 0, payments: [], tagIds: [],
    });
    const validToken = await googleToken(allowed);
    expect((await handleEditOrderRequest(request(validToken, orderId, clientId))).status).toBe(200);
    const outsider = await googleToken(`outsider-${randomUUID()}@example.test`);
    expect((await handleEditOrderRequest(request(outsider, orderId, clientId))).status).toBe(403);
    const otherProvider = await googleToken(allowed, "github.com");
    expect((await handleEditOrderRequest(request(otherProvider, orderId, clientId))).status).toBe(403);
  });
});
