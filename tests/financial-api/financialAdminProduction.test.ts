import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockAdminApp {
  name: string;
  options: { projectId?: string; credential?: unknown };
}

const adminMocks = vi.hoisted(() => {
  const apps: MockAdminApp[] = [];
  const initializeApp = vi.fn((options: MockAdminApp["options"], name?: string) => {
    const app = { name: name ?? "[DEFAULT]", options };
    apps.push(app);
    return app;
  });
  const cert = vi.fn((serviceAccount: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }) => ({ serviceAccount }));
  const getFirestore = vi.fn((app: MockAdminApp) => ({ app }));

  return { apps, initializeApp, cert, getFirestore };
});

vi.mock("firebase-admin/app", () => ({
  cert: adminMocks.cert,
  getApps: () => adminMocks.apps,
  initializeApp: adminMocks.initializeApp,
}));

vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn((app: MockAdminApp) => ({ app })) }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: adminMocks.getFirestore }));

import { getFinancialAdminDb } from "../../api/_financial/admin";

const serviceAccount = JSON.stringify({
  type: "service_account",
  project_id: "production-project",
  client_email: "financial-admin@example.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nTEST ONLY\n-----END PRIVATE KEY-----\n",
});

describe("Firebase Admin Production initialization", () => {
  beforeEach(() => {
    adminMocks.apps.length = 0;
    adminMocks.initializeApp.mockClear();
    adminMocks.cert.mockClear();
    adminMocks.getFirestore.mockClear();
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("GCLOUD_PROJECT", "production-project");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "production-project");
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", serviceAccount);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("initializes Firebase Admin with the validated server credential and matching project", () => {
    const db = getFinancialAdminDb();

    expect(adminMocks.cert).toHaveBeenCalledWith({
      projectId: "production-project",
      clientEmail: "financial-admin@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nTEST ONLY\n-----END PRIVATE KEY-----\n",
    });
    expect(adminMocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "production-project" }));
    expect(db).toMatchObject({ app: { name: "[DEFAULT]", options: { projectId: "production-project" } } });
  });

  it("reuses a valid existing app", () => {
    const existingApp: MockAdminApp = { name: "[DEFAULT]", options: { projectId: "production-project" } };
    adminMocks.apps.push(existingApp);

    expect(getFinancialAdminDb()).toMatchObject({ app: existingApp });
    expect(adminMocks.initializeApp).not.toHaveBeenCalled();
  });
});
