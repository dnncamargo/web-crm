import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { User } from "firebase/auth";
import { MemoryRouter } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { UserIdentityMenu } from "./UserIdentityMenu";
import { getUserIdentityLabel } from "./userIdentityMenuUtils";

function createUser(values: Partial<Pick<User, "displayName" | "email" | "photoURL">>): User {
  return values as User;
}

describe("UserIdentityMenu", () => {
  it("uses the existing identity fallback order", () => {
    expect(getUserIdentityLabel(createUser({ displayName: "Daniel", email: "daniel@example.test" }))).toBe("Daniel");
    expect(getUserIdentityLabel(createUser({ displayName: null, email: "daniel@example.test" }))).toBe("daniel@example.test");
    expect(getUserIdentityLabel(createUser({ displayName: null, email: null }))).toBe("Usuário");
  });

  it("renders settings and logout as one menu", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <UserIdentityMenu
          defaultOpen
          user={createUser({ displayName: "Daniel", email: "daniel@example.test", photoURL: null })}
          logout={async () => undefined}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain(`href="${APP_ROUTES.settings}"`);
    expect(markup).toContain("Configurações");
    expect(markup).toContain("Sair");
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="true"');
  });
});
