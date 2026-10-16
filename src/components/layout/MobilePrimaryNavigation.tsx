import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, CheckSquare, CircleDollarSign, Ellipsis, Package, ShoppingBag, Tags, UsersRound } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";

const primaryItems = [
  { to: "/", label: "Hoje", Icon: CalendarDays, end: true },
  { to: "/pedidos", label: "Pedidos", Icon: ShoppingBag },
  { to: APP_ROUTES.financialControl, label: "Financeiro", Icon: CircleDollarSign },
];

const moreItems = [
  { to: "/clientes", label: "Clientes", Icon: UsersRound },
  { to: "/produtos", label: "Produtos", Icon: Package },
  { to: "/tarefas", label: "Tarefas", Icon: CheckSquare },
  { to: "/etiquetas", label: "Etiquetas", Icon: Tags },
];

interface MobilePrimaryNavigationProps {
  defaultMoreOpen?: boolean;
}

function isMoreRoute(pathname: string) {
  return moreItems.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
}

export function MobilePrimaryNavigation({ defaultMoreOpen = false }: MobilePrimaryNavigationProps) {
  const [openState, setOpenState] = useState<{ pathname: string | null; open: boolean }>({ pathname: null, open: defaultMoreOpen });
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const { pathname } = useLocation();
  const moreOpen = (openState.pathname === null || openState.pathname === pathname) && openState.open;
  const moreActive = isMoreRoute(pathname);

  useEffect(() => {
    if (!moreOpen) {
      return undefined;
    }

    firstLinkRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpenState({ pathname, open: false });
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenState({ pathname, open: false });
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen, pathname]);

  return (
    <nav className="mobile-nav" aria-label="Navegação mobile">
      {primaryItems.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "mobile-nav-link active" : "mobile-nav-link")}>
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}

      <div className="mobile-nav-more" ref={menuRef}>
        <button
          ref={triggerRef}
          className={`mobile-nav-link mobile-nav-more-trigger${moreActive ? " active" : ""}`}
          type="button"
          aria-label="Mais opções de navegação"
          aria-expanded={moreOpen}
          aria-controls={menuId}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setOpenState({ pathname, open: !moreOpen })}
        >
          <Ellipsis size={17} aria-hidden="true" />
          <span>Mais</span>
        </button>
        {moreOpen && (
          <div className="mobile-nav-more-menu" id={menuId}>
            {moreItems.map(({ to, label, Icon }, index) => (
              <NavLink
                key={to}
                ref={index === 0 ? firstLinkRef : undefined}
                to={to}
                className={({ isActive }) => (isActive ? "mobile-nav-more-link active" : "mobile-nav-more-link")}
                onClick={() => {
                  setOpenState({ pathname, open: false });
                  triggerRef.current?.focus();
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
