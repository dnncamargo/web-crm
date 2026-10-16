import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { MemoryRouter } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { AppShell } from "./AppShell";

vi.mock("../../features/auth/useAuth", () => ({
  useAuth: () => ({
    user: { displayName: "Daniel", email: "daniel@example.test", photoURL: null } as User,
    logout: vi.fn(async () => undefined),
  }),
}));

vi.mock("../../features/clients/useClients", () => ({ useClients: () => ({ clients: [], loading: false }) }));
vi.mock("../../features/orders/useOrders", () => ({ useOrders: () => ({ orders: [], loading: false }) }));
vi.mock("../../features/products/useProducts", () => ({ useProducts: () => ({ products: [], loading: false }) }));
vi.mock("../../features/tags/useTags", () => ({ useTags: () => ({ tags: [], loading: false }) }));

const desktopRoutes = ["/", "/pedidos", "/clientes", "/produtos", "/tarefas", "/etiquetas", APP_ROUTES.financialControl];

function renderShell(path = "/") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  );
}

function getDesktopNavigation(markup: string) {
  return markup.match(/<nav class="sidebar-nav"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
}

describe("AppShell desktop navigation", () => {
  it("renders the required labels, icons, order, and financial divider", () => {
    const navigation = getDesktopNavigation(renderShell());
    const labels = [...navigation.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
    const destinations = [...navigation.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

    expect(labels).toEqual(["Hoje", "Pedidos", "Clientes", "Produtos", "Tarefas", "Etiquetas", "Financeiro"]);
    expect(destinations).toEqual(desktopRoutes);
    expect(new Set(destinations).size).toBe(destinations.length);
    expect((navigation.match(/<svg\b/g) ?? [])).toHaveLength(7);
    expect(navigation.indexOf("sidebar-nav-group-separated")).toBeGreaterThan(navigation.indexOf("Etiquetas"));
    expect(navigation).not.toContain("Configurações");
  });

  it.each(desktopRoutes)("keeps %s active in its existing route", (path) => {
    const navigation = getDesktopNavigation(renderShell(path));
    const link = navigation.match(new RegExp(`<a(?=[^>]*class="nav-link active")(?=[^>]*href="${path}")[^>]*>`));

    expect(link).not.toBeNull();
  });

  it("renders the four primary mobile destinations and user trigger", () => {
    const markup = renderShell();
    const navigation = markup.match(/<nav class="mobile-nav"[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
    const labels = [...navigation.matchAll(/<span>(Hoje|Pedidos|Financeiro)<\/span>/g)].map((match) => match[1]);

    expect(labels).toEqual(["Hoje", "Pedidos", "Financeiro"]);
    expect(navigation).toContain('aria-label="Mais opções de navegação"');
    expect(navigation).toContain(">Mais</span>");
    expect(navigation).not.toContain("Configurações");
    expect(markup).toContain("Abrir menu do usuário");
  });

  it("uses distinct accessible menu IDs for both user triggers and Mais", () => {
    const markup = renderShell();
    const controls = [...markup.matchAll(/aria-controls="([^"]+)"/g)].map((match) => match[1]);

    expect(controls).toHaveLength(3);
    expect(new Set(controls).size).toBe(3);
  });
});
