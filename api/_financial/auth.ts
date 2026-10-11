import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

import { getFinancialAdminAuth, getFinancialAdminDb } from "./admin.js";
import { FinancialApiError } from "./errors.js";

export interface FinancialActor {
  uid: string;
  email: string;
}

interface TokenVerifier {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}

export interface FinancialIdentity {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase: { sign_in_provider?: string };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new FinancialApiError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new FinancialApiError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  }

  return token;
}

export async function authorizeFinancialRequest(
  request: Request,
  dependencies: { auth?: TokenVerifier; db?: Firestore } = {},
): Promise<FinancialActor> {
  const token = getBearerToken(request);
  const auth = dependencies.auth ?? getFinancialAdminAuth();

  let decoded: DecodedIdToken;
  try {
    decoded = await auth.verifyIdToken(token, true);
  } catch {
    throw new FinancialApiError(401, "UNAUTHENTICATED", "Autenticação necessária.");
  }

  const db = dependencies.db ?? getFinancialAdminDb();
  let admission: unknown;
  try {
    admission = (await db.doc("config/authAdmission").get()).data()?.allowedGoogleEmails;
  } catch {
    throw new FinancialApiError(403, "FORBIDDEN", "Acesso não autorizado.");
  }

  return authorizeFinancialIdentity(decoded, admission);
}

export function authorizeFinancialIdentity(identity: FinancialIdentity, admission: unknown): FinancialActor {
  const email = typeof identity.email === "string" ? normalizeEmail(identity.email) : "";
  const provider = identity.firebase.sign_in_provider;

  const admitted = Array.isArray(admission)
    && admission.some((candidate) => typeof candidate === "string" && normalizeEmail(candidate) === email);

  if (!identity.email_verified || provider !== "google.com" || !isEmail(email) || !admitted) {
    throw new FinancialApiError(403, "FORBIDDEN", "Acesso não autorizado.");
  }

  return { uid: identity.uid, email };
}
