import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getProjectId(): string | undefined {
  return process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID;
}

function getAdminApp() {
  return getApps()[0] ?? initializeApp({ projectId: getProjectId() });
}

export function getFinancialAdminAuth() {
  return getAuth(getAdminApp());
}

export function getFinancialAdminDb() {
  return getFirestore(getAdminApp());
}
