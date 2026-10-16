// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { LegacyFinancialControlRedirect } from "../../LegacyFinancialControlRedirect";
import { MobilePrimaryNavigation } from "./MobilePrimaryNavigation";

afterEach(cleanup);

function NavigationHarness() {
  const { pathname } = useLocation();

  return (
    <>
      <MobilePrimaryNavigation />
      <button type="button">Fora do menu</button>
      <output aria-label="Rota atual">{pathname}</output>
      <Outlet />
    </>
  );
}

function renderNavigation(initialEntries = ["/tarefas"]) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <NavigationHarness />,
        children: [{ path: "*", element: null }],
      },
    ],
    { initialEntries },
  );

  render(<RouterProvider router={router} />);
  return router;
}

describe("MobilePrimaryNavigation interactions", () => {
  it("opens Mais, focuses its first destination, and toggles closed", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    await user.click(trigger);

    const clientsLink = screen.getByRole("link", { name: "Clientes" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(document.activeElement).toBe(clientsLink));

    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Clientes" })).toBeNull();
  });

  it("closes on Escape and returns focus to the Mais trigger", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    await user.click(trigger);
    await user.keyboard("{Escape}");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when the user clicks outside the menu", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Fora do menu" }));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes after selecting a destination, navigates, and restores focus to Mais", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    await user.click(trigger);
    await user.click(screen.getByRole("link", { name: "Etiquetas" }));

    expect(screen.getByLabelText("Rota atual").textContent).toBe("/etiquetas");
    expect(screen.queryByRole("link", { name: "Etiquetas" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mais opções de navegação" })));
  });

  it("stays closed while browser history moves away from and back to an active Mais route", async () => {
    const user = userEvent.setup();
    const router = renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    await user.click(trigger);
    await act(() => router.navigate("/pedidos"));
    expect(screen.getByRole("button", { name: "Mais opções de navegação" }).getAttribute("aria-expanded")).toBe("false");

    await act(() => router.navigate(-1));
    expect(screen.getByLabelText("Rota atual").textContent).toBe("/tarefas");
    expect(screen.getByRole("button", { name: "Mais opções de navegação" }).getAttribute("aria-expanded")).toBe("false");

    await act(() => router.navigate(1));
    expect(screen.getByLabelText("Rota atual").textContent).toBe("/pedidos");
    expect(screen.getByRole("button", { name: "Mais opções de navegação" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("marks only the matching destination current while the Mais panel is open", async () => {
    const user = userEvent.setup();
    renderNavigation();
    const trigger = screen.getByRole("button", { name: "Mais opções de navegação" });

    expect(trigger.getAttribute("aria-current")).toBe("page");
    await user.click(trigger);

    expect(trigger.getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Tarefas", current: "page" })).not.toBeNull();
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("redirects the legacy financial URL at runtime and replaces its history entry", async () => {
    const router = createMemoryRouter(
      [
        { path: "/pedidos", element: <p>Pedidos</p> },
        { path: APP_ROUTES.legacyFinancialControl, element: <LegacyFinancialControlRedirect /> },
        { path: APP_ROUTES.financialControl, element: <p>Financeiro canônico</p> },
      ],
      { initialEntries: ["/pedidos", APP_ROUTES.legacyFinancialControl], initialIndex: 1 },
    );

    render(<RouterProvider router={router} />);
    await waitFor(() => expect(router.state.location.pathname).toBe(APP_ROUTES.financialControl));
    expect(screen.getByText("Financeiro canônico")).not.toBeNull();

    await act(() => router.navigate(-1));

    expect(router.state.location.pathname).toBe("/pedidos");
    expect(screen.getByText("Pedidos")).not.toBeNull();
  });
});
