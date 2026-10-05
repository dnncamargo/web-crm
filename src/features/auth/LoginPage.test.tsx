import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { MemoryRouter } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "./authContext";
import { AuthResolving } from "./RequireAuth";
import { LoginPage } from "./LoginPage";
import { getAuthenticationErrorMessage } from "./authError";

function createAuthValue(user: User | null, resolving = false): AuthContextValue {
  return {
    user,
    resolving,
    loading: resolving,
    login: async () => undefined,
    logout: async () => undefined,
  };
}

function renderLogin(value: AuthContextValue) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={["/login?returnTo=%2Fpedidos"]}>
      <AuthContext.Provider value={value}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("Google authentication UI", () => {
  it("shows only the Google login action", () => {
    const markup = renderLogin(createAuthValue(null));

    expect(markup).toContain("Continuar com Google");
    expect(markup).not.toContain("login-email");
    expect(markup).not.toContain("login-password");
    expect(markup).not.toContain("Entrar</button>");
  });

  it("bypasses the login action for a persisted authenticated user", () => {
    const user = { displayName: "Store user", email: "store@example.com", photoURL: null } as User;

    expect(renderLogin(createAuthValue(user))).not.toContain("Continuar com Google");
  });

  it("keeps protected content unresolved while Firebase restores the session", () => {
    const markup = renderToStaticMarkup(
      <AuthContext.Provider value={createAuthValue(null, true)}>
        <AuthResolving />
      </AuthContext.Provider>,
    );

    expect(markup).toContain("Verificando sessão");
  });

  it("maps Google flow failures to actionable messages", () => {
    expect(getAuthenticationErrorMessage({ code: "auth/popup-blocked" })).toContain("Permita pop-ups");
    expect(getAuthenticationErrorMessage({ code: "auth/popup-closed-by-user" })).toBe("Login cancelado.");
    expect(getAuthenticationErrorMessage({ code: "auth/operation-not-allowed" })).toContain("habilitado");
  });
});
