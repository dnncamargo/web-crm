import {
  beforeUserSignedIn as registerBeforeUserSignedIn,
  HttpsError,
  type AuthBlockingEvent,
} from "firebase-functions/v2/identity";
import { defineSecret } from "firebase-functions/params";

import {
  evaluateGoogleAdmission,
  parseAllowedIdentityEmails,
} from "./admission.js";

const allowedGoogleIdentityEmails = defineSecret("CRM_AUTH_ALLOWED_GOOGLE_EMAILS");

function enforceGoogleAdmission(event: AuthBlockingEvent) {
  if (!event.data) {
    throw new HttpsError("permission-denied", "Authentication event is incomplete.");
  }

  const allowedEmails = parseAllowedIdentityEmails(allowedGoogleIdentityEmails.value());
  const decision = evaluateGoogleAdmission({
    providerId: event.credential?.providerId,
    email: event.data.email,
    emailVerified: event.data.emailVerified,
  }, allowedEmails);

  if (!decision.allowed) {
    throw new HttpsError("permission-denied", "Authentication identity is not allowed.");
  }
}

export const admitGoogleUserSignedIn = registerBeforeUserSignedIn(
  { secrets: [allowedGoogleIdentityEmails] },
  enforceGoogleAdmission,
);
