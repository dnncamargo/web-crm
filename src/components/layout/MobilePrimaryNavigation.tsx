import { useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
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

function isMoreRoute(pathname: string) {
  return moreItems.some(({ to }) => pathname === to || pathname.startsWith(`${to}/`));
}

export function MobilePrimaryNavigation() {
  const location = useLocation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocusRef = useRef(false);

  useEffect(() => {
    if (restoreTriggerFocusRef.current) {
      triggerRef.current?.focus();
      restoreTriggerFocusRef.current = false;
    }
  }, [location.key]);

  return (
    <MobilePrimaryNavigationAtLocation
      key={location.key}
      pathname={location.pathname}
      triggerRef={triggerRef}
      onDestinationSelected={() => {
        restoreTriggerFocusRef.current = true;
      }}
    />
  );
}

interface MobilePrimaryNavigationAtLocationProps {
  onDestinationSelected: () => void;
  pathname: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function MobilePrimaryNavigationAtLocation({ onDestinationSelected, pathname, triggerRef }: MobilePrimaryNavigationAtLocationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const moreActive = isMoreRoute(pathname);

  useEffect(() => {
    if (!moreOpen) {
      return undefined;
    }

    firstLinkRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen, pathname, triggerRef]);

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
          aria-current={moreActive && !moreOpen ? "page" : undefined}
          onClick={() => setMoreOpen((currentOpen) => !currentOpen)}
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
                  setMoreOpen(false);
                  onDestinationSelected();
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
