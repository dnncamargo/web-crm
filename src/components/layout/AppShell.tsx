import { useMemo, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { useClients } from "../../features/clients/useClients";
import { useOrders } from "../../features/orders/useOrders";
import { formatDateTimeBR } from "../../features/orders/orderUtils";
import { useProducts } from "../../features/products/useProducts";
import { useTags } from "../../features/tags/useTags";
import { formatCurrencyBR } from "../../utils/money";

const navItems = [
  { to: "/", label: "Hoje", end: true },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/clientes", label: "Clientes" },
  { to: "/produtos", label: "Produtos" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/etiquetas", label: "Etiquetas" },
];

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^#/, "");
}

function includesSearch(searchableValue: string, query: string) {
  return normalizeSearchValue(searchableValue).includes(query);
}

export function AppShell() {
  const [globalSearch, setGlobalSearch] = useState("");
  const { clients, loading: loadingClients } = useClients();
  const { orders, loadingOrders } = useOrders();
  const { products, loadingProducts } = useProducts();
  const { tags, loadingTags } = useTags();

  const normalizedGlobalSearch = normalizeSearchValue(globalSearch);
  const globalSearchOpen = normalizedGlobalSearch.length >= 2;
  const loadingGlobalSearch = loadingClients || loadingOrders || loadingProducts || loadingTags;

  const globalSearchSections = useMemo(() => {
    if (!globalSearchOpen) {
      return [];
    }

    const clientResults = clients
      .filter((client) => {
        const primaryContact = client.contacts?.find((contact) => contact.isPrimary);
        return [client.name, primaryContact?.value, client.notes, ...(client.tagIds ?? [])].some((value) => value && includesSearch(value, normalizedGlobalSearch));
      })
      .slice(0, 6)
      .map((client) => ({
        id: client.id,
        title: client.name,
        meta: client.contacts?.find((contact) => contact.isPrimary)?.value || "Sem contato principal",
      }));

    const productResults = products
      .filter((product) => [product.name, product.categoryLabel, product.unit, product.notes, ...(product.tagIds ?? [])].some((value) => value && includesSearch(value, normalizedGlobalSearch)))
      .slice(0, 6)
      .map((product) => ({
        id: product.id,
        title: product.name,
        meta: [product.categoryLabel, product.suggestedPrice ? formatCurrencyBR(product.suggestedPrice) : null].filter(Boolean).join(" · ") || "Produto sem categoria",
      }));

    const orderResults = orders
      .filter((order) =>
        [
          order.clientName,
          order.addressSnapshot?.street,
          order.addressSnapshot?.neighborhood,
          order.addressSnapshot?.city,
          order.notes,
          ...order.items.map((item) => item.productName),
          ...(order.tagIds ?? []),
        ].some((value) => value && includesSearch(value, normalizedGlobalSearch)),
      )
      .slice(0, 6)
      .map((order) => ({
        id: order.id,
        title: order.clientName,
        meta: `${formatDateTimeBR(order.deliveryDateTime)} · ${formatCurrencyBR(order.total)}`,
      }));

    const tagResults = tags
      .filter((tag) => [tag.label, tag.slug, tag.entity, tag.group].some((value) => value && includesSearch(value, normalizedGlobalSearch)))
      .slice(0, 6)
      .map((tag) => ({
        id: tag.id,
        title: tag.label,
        meta: [tag.entity, tag.group, `#${tag.slug}`].filter(Boolean).join(" · "),
      }));

    return [
      { title: "Clientes", to: "/clientes", results: clientResults },
      { title: "Produtos", to: "/produtos", results: productResults },
      { title: "Pedidos", to: "/pedidos", results: orderResults },
      { title: "Etiquetas", to: "/etiquetas", results: tagResults },
    ];
  }, [clients, globalSearchOpen, normalizedGlobalSearch, orders, products, tags]);

  const hasGlobalSearchResults = globalSearchSections.some((section) => section.results.length > 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/brand/brand-mark.png" alt="Delícias do Porto" />
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="global-search-wrap">
            <input
              className="global-search"
              type="search"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Buscar cliente, pedido, produto ou #etiqueta..."
            />

            {globalSearchOpen && (
              <div className="global-search-panel">
                {loadingGlobalSearch && <p className="global-search-status">Carregando resultados...</p>}

                {!loadingGlobalSearch && !hasGlobalSearchResults && <p className="global-search-status">Nenhum resultado encontrado.</p>}

                {!loadingGlobalSearch &&
                  globalSearchSections.map((section) => (
                    <section className="global-search-section" key={section.title}>
                      <header>
                        <strong>{section.title}</strong>
                        <span>{section.results.length}</span>
                      </header>

                      {section.results.length === 0 ? (
                        <p>Nenhum resultado nesta seção.</p>
                      ) : (
                        <div className="global-search-results">
                          {section.results.map((result) => (
                            <Link className="global-search-result" key={result.id} to={section.to} onClick={() => setGlobalSearch("")}>
                              <strong>{result.title}</strong>
                              <span>{result.meta}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
              </div>
            )}
          </div>
        </header>

        <section className="content-area">
          <Outlet />
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Navegação mobile">
        {navItems.slice(0, 4).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "mobile-nav-link active" : "mobile-nav-link")}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
