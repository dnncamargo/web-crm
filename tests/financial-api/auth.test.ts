import { describe, expect, it } from "vitest";

import { authorizeFinancialIdentity, authorizeFinancialRequest } from "../../api/_financial/auth";
import { isFinancialApiError } from "../../api/_financial/errors";

const admission = ["Allowed@Example.Test"];

describe("financial authorization identity checks", () => {
  it("retorna 401 para token ausente ou inválido", async () => {
    await expect(authorizeFinancialRequest(new Request("http://localhost/api"))).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 401
    ));

    await expect(authorizeFinancialRequest(new Request("http://localhost/api", {
      headers: { authorization: "Bearer invalid-token" },
    }), {
      auth: { verifyIdToken: async () => { throw new Error("invalid token"); } },
    })).rejects.toSatisfy((error: unknown) => (
      isFinancialApiError(error) && error.status === 401
    ));
  });

  it("aceita somente um usuário Google verificado presente na allowlist normalizada", () => {
    expect(authorizeFinancialIdentity({
      uid: "user-1",
      email: " allowed@example.test ",
      email_verified: true,
      firebase: { sign_in_provider: "google.com" },
    }, admission)).toEqual({ uid: "user-1", email: "allowed@example.test" });
  });

  it.each([
    { email_verified: false, provider: "google.com", email: "allowed@example.test" },
    { email_verified: true, provider: "password", email: "allowed@example.test" },
    { email_verified: true, provider: "google.com", email: "outside@example.test" },
  ])("recusa identidade não admitida", ({ email_verified, provider, email }) => {
    try {
      authorizeFinancialIdentity({
        uid: "user-1",
        email,
        email_verified,
        firebase: { sign_in_provider: provider },
      }, admission);
      throw new Error("A autorização deveria falhar.");
    } catch (error) {
      expect(isFinancialApiError(error) && error.status).toBe(403);
    }
  });
});
