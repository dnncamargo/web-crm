import { doc, getDoc } from "firebase/firestore";

import { db } from "../../services/firebase";

const crmAccessProbe = doc(db, "appSettings", "theme");

export async function verifyCrmAccess() {
  await getDoc(crmAccessProbe);
}

export function isFirestorePermissionDenied(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "permission-denied";
}
