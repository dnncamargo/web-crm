export const GOOGLE_PROVIDER_ID = "google.com" as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdmissionRejectionReason =
  | "unexpected-provider"
  | "missing-email"
  | "unverified-email"
  | "identity-not-allowed";

export type AdmissionDecision =
  | { allowed: true }
  | { allowed: false; reason: AdmissionRejectionReason };

export interface AdmissionIdentity {
  providerId: string | undefined;
  email: string | undefined;
  emailVerified: boolean | undefined;
}

export function normalizeIdentityEmail(value: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function parseAllowedIdentityEmails(rawValue: string): readonly string[] {
  const entries = rawValue.split(/[\r\n,]/);
  const normalizedEntries = entries.map((entry) => normalizeIdentityEmail(entry));

  if (
    normalizedEntries.length === 0 ||
    normalizedEntries.some((entry) => entry === null)
  ) {
    throw new Error("A allowlist de identidades está malformada.");
  }

  return [...new Set(normalizedEntries.filter((entry): entry is string => entry !== null))];
}

export function evaluateGoogleAdmission(
  identity: AdmissionIdentity,
  allowedEmails: readonly string[],
): AdmissionDecision {
  if (identity.providerId !== GOOGLE_PROVIDER_ID) {
    return { allowed: false, reason: "unexpected-provider" };
  }

  if (!identity.email) {
    return { allowed: false, reason: "missing-email" };
  }

  if (identity.emailVerified !== true) {
    return { allowed: false, reason: "unverified-email" };
  }

  const normalizedEmail = normalizeIdentityEmail(identity.email);
  if (!normalizedEmail || !allowedEmails.includes(normalizedEmail)) {
    return { allowed: false, reason: "identity-not-allowed" };
  }

  return { allowed: true };
}
