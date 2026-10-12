import { randomUUID } from "node:crypto";

import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";

import { getFinancialAdminDb } from "../../api/_financial/admin";
import { handleCancelOrderRequest } from "../../api/financial/cancel-order";

const projectId = "demo-web-crm-financial";
const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!authEmulatorHost) throw new Error("FIREBASE_AUTH_EMULATOR_HOST é obrigatório para a integração financeira.");
const clientApp: FirebaseApp = initializeApp({
  apiKey: "financial-api-test-key",
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
}, `financial-cancel-auth-${randomUUID()}`);
const auth = getAuth(clientApp);
connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });

async function googleToken(email: string): Promise<string> {
  const idToken = JSON.stringify({ sub: `auth-${randomUUID()}`, email, email_verified: true });
  return (await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))).user.getIdToken();
}

function request(token: string | null, orderId: string, clientId: string): Request {
  return new Request("http://localhost/api/financial/cancel-order", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      orderId, clientId, operationId: `operation-${randomUUID()}`, expected: { updatedAt: null },
      agreement: "Acordo de teste.", movement: { kind: "none", amountCents: 0, occurredAt: null },
    }),
  });
}

afterAll(async () => deleteApp(clientApp));

describe("cancel-order HTTP authorization", () => {
  it("requer token Google verificado e e-mail na allowlist", async () => {
    const db = getFinancialAdminDb();
    const suffix = randomUUID();
    const clientId = `client-${suffix}`;
    const orderId = `order-${suffix}`;
    const allowedEmail = `allowed-${suffix}@example.test`;
    await db.doc("config/authAdmission").set({ allowedGoogleEmails: [allowedEmail] });
    await db.doc(`orders/${orderId}`).set({
      clientId, clientName: "Cliente sintético", orderStatus: "active", total: 100, amountPaid: 0,
      payments: [], creditApplied: 0, creditGenerated: 0,
    });
    expect((await handleCancelOrderRequest(request(null, orderId, clientId))).status).toBe(401);
    const outsider = await googleToken(`outside-${suffix}@example.test`);
    expect((await handleCancelOrderRequest(request(outsider, orderId, clientId))).status).toBe(403);
    const admitted = await googleToken(allowedEmail);
    expect((await handleCancelOrderRequest(request(admitted, orderId, clientId))).status).toBe(200);
  });
});
