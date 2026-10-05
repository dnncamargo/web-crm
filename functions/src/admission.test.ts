import { describe, expect, it } from "vitest";

import {
  evaluateGoogleAdmission,
  parseAllowedIdentityEmails,
} from "./admission.js";

const allowedEmails = parseAllowedIdentityEmails(
  "store-user@example.test\ndeveloper@example.test",
);

describe("Google authentication admission", () => {
  it("accepts an allowed, verified Google identity", () => {
    expect(evaluateGoogleAdmission({
      providerId: "google.com",
      email: " Store-User@Example.Test ",
      emailVerified: true,
    }, allowedEmails)).toEqual({ allowed: true });
  });

  it("rejects a different Google account", () => {
    expect(evaluateGoogleAdmission({
      providerId: "google.com",
      email: "other@example.test",
      emailVerified: true,
    }, allowedEmails)).toEqual({ allowed: false, reason: "identity-not-allowed" });
  });

  it("rejects an allowed email authenticated by another provider", () => {
    expect(evaluateGoogleAdmission({
      providerId: "password",
      email: "store-user@example.test",
      emailVerified: true,
    }, allowedEmails)).toEqual({ allowed: false, reason: "unexpected-provider" });
  });

  it("rejects a missing email and an unverified identity", () => {
    expect(evaluateGoogleAdmission({
      providerId: "google.com",
      email: undefined,
      emailVerified: true,
    }, allowedEmails)).toEqual({ allowed: false, reason: "missing-email" });

    expect(evaluateGoogleAdmission({
      providerId: "google.com",
      email: "store-user@example.test",
      emailVerified: false,
    }, allowedEmails)).toEqual({ allowed: false, reason: "unverified-email" });
  });

  it("fails closed for malformed allowlist configuration", () => {
    expect(() => parseAllowedIdentityEmails("store-user@example.test\n")).toThrow();
    expect(() => parseAllowedIdentityEmails("store-user@example.test,,developer@example.test")).toThrow();
    expect(() => parseAllowedIdentityEmails("not-an-email")).toThrow();
  });
});
