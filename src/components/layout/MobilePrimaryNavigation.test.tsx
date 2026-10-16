import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { MobilePrimaryNavigation } from "./MobilePrimaryNavigation";

function renderNavigation(path: string, defaultMoreOpen = false) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <MobilePrimaryNavigation defaultMoreOpen={defaultMoreOpen} />
    </MemoryRouter>,
  );
}

describe("MobilePrimaryNavigation", () => {
  it("renders the primary destinations in the required order", () => {
    const markup = renderNavigation("/");
    const labels = [...markup.matchAll(/<span>(Hoje|Pedidos|Financeiro|Mais)<\/span>/g)].map((match) => match[1]);
    const destinations = [...markup.matchAll(/<a[^>]+href="([^"]+)"[^>]*>/g)].map((match) => match[1]);

    expect(labels).toEqual(["Hoje", "Pedidos", "Financeiro", "Mais"]);
    expect(destinations).toEqual(["/", "/pedidos", APP_ROUTES.financialControl]);
    expect(markup).toContain('aria-controls=');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("exposes all secondary destinations and marks Mais active on those routes", () => {
    const markup = renderNavigation("/tarefas", true);
    const menu = markup.match(/<div class="mobile-nav-more-menu"[^>]*>(.*?)<\/div>/)?.[1] ?? "";
    const destinations = [...menu.matchAll(/<a[^>]+href="([^"]+)"[^>]*>/g)].map((match) => match[1]);

    expect(destinations).toEqual(["/clientes", "/produtos", "/tarefas", "/etiquetas"]);
    expect(markup).toContain('aria-current="page"');
    expect(menu).toMatch(/aria-current="page"[^>]*href="\/tarefas"/);
  });

  it("marks the canonical financial destination active", () => {
    const markup = renderNavigation(APP_ROUTES.financialControl);

    expect(markup).toMatch(/aria-current="page"[^>]*href="\/financeiro"/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
