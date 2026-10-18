import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

interface FirebaseServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

interface FirebaseServiceAccountJson {
  type?: unknown;
  project_id?: unknown;
  client_email?: unknown;
  private_key?: unknown;
}

class FirebaseAdminConfigurationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super("Firebase Admin server configuration is invalid.");
    this.name = "FirebaseAdminConfigurationError";
    this.code = code;
  }
}

function getProjectId(): string | undefined {
  return process.env.GCLOUD_PROJECT
    ?? process.env.FIREBASE_PROJECT_ID
    ?? process.env.VITE_FIREBASE_PROJECT_ID;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFirebaseServiceAccountJson(
  value: string,
  expectedProjectId?: string,
): FirebaseServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_CREDENTIALS_INVALID");
  }

  if (!isRecord(parsed)) {
    throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_CREDENTIALS_INVALID");
  }

  const serviceAccount = parsed as FirebaseServiceAccountJson;
  const projectId = typeof serviceAccount.project_id === "string" ? serviceAccount.project_id.trim() : "";
  const clientEmail = typeof serviceAccount.client_email === "string" ? serviceAccount.client_email.trim() : "";
  const privateKey = typeof serviceAccount.private_key === "string" ? serviceAccount.private_key : "";
  const hasPrivateKeyPem = privateKey.includes("-----BEGIN PRIVATE KEY-----")
    && privateKey.includes("-----END PRIVATE KEY-----");

  if (serviceAccount.type !== "service_account"
    || !projectId
    || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(clientEmail)
    || !hasPrivateKeyPem) {
    throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_CREDENTIALS_INVALID");
  }

  if (expectedProjectId && projectId !== expectedProjectId) {
    throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_PROJECT_MISMATCH");
  }

  return { projectId, clientEmail, privateKey };
}

function isLocalFirestoreEmulator(): boolean {
  const host = process.env.FIRESTORE_EMULATOR_HOST?.toLowerCase();
  return process.env.VERCEL !== "1"
    && typeof host === "string"
    && /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(host);
}

function getAdminApp() {
  const projectId = getProjectId();
  const existingApp = getApps().find((app) => app.name === "[DEFAULT]");
  if (existingApp) {
    if (projectId && existingApp.options.projectId !== projectId) {
      throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_PROJECT_MISMATCH");
    }
    return existingApp;
  }

  if (isLocalFirestoreEmulator()) {
    return initializeApp({ projectId });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const isVercelProduction = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

  if (!serviceAccountJson && isVercelProduction) {
    throw new FirebaseAdminConfigurationError("FIREBASE_ADMIN_CREDENTIALS_MISSING");
  }

  if (serviceAccountJson) {
    if (!projectId && isVercelProduction) {
      throw new FirebaseAdminConfigurationError("FIREBASE_PROJECT_ID_MISSING");
    }
    const serviceAccount = parseFirebaseServiceAccountJson(serviceAccountJson, projectId);
    return initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      projectId: serviceAccount.projectId,
    });
  }

  return initializeApp({ projectId });
}

export function getFinancialAdminAuth() {
  return getAuth(getAdminApp());
}

export function getFinancialAdminDb() {
  return getFirestore(getAdminApp());
}
