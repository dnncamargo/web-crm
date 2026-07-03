import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "Hoje", end: true },
  { to: "/clientes", label: "Clientes" },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/tarefas", label: "Tarefas" },
  { to: "/produtos", label: "Produtos" },
  { to: "/etiquetas", label: "Etiquetas" },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">DDP</span>
          <div>
            <strong>Delícias do Porto</strong>
            <small>CRM de encomendas</small>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <input
            className="global-search"
            type="search"
            placeholder="Buscar cliente, pedido, produto ou #etiqueta..."
          />

          {/* <button className="quick-action" type="button">
            + Novo pedido
          </button> */}
        </header>

        <section className="content-area">
          <Outlet />
        </section>
      </main>

      <nav className="mobile-nav" aria-label="Navegação mobile">
        {navItems.slice(0, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? "mobile-nav-link active" : "mobile-nav-link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}