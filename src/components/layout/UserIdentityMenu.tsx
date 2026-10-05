import { useEffect, useRef, useState } from "react";
import { LogOut, Settings2, UserRound } from "lucide-react";
import type { User } from "firebase/auth";
import { Link } from "react-router-dom";

import { APP_ROUTES } from "../../appRoutes";
import { Button } from "../ui/Button";
import { getUserIdentityLabel } from "./userIdentityMenuUtils";

interface UserIdentityMenuProps {
  defaultOpen?: boolean;
  user: User;
  logout: () => Promise<void>;
}

function IdentityAvatar({ user }: { user: User }) {
  if (user.photoURL) {
    return <img className="auth-identity-avatar" src={user.photoURL} alt="" aria-hidden="true" />;
  }

  return (
    <span className="auth-identity-avatar auth-identity-avatar-fallback" aria-hidden="true">
      <UserRound size={17} />
    </span>
  );
}

export function UserIdentityMenu({ defaultOpen = false, user, logout }: UserIdentityMenuProps) {
  const [open, setOpen] = useState(defaultOpen);
  const menuRef = useRef<HTMLDivElement>(null);
  const identityLabel = getUserIdentityLabel(user);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    void logout();
  }

  return (
    <div className="auth-identity-menu" ref={menuRef}>
      <button
        className="auth-identity-trigger"
        type="button"
        aria-label="Abrir menu do usuário"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="auth-identity-menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <IdentityAvatar user={user} />
        <span className="auth-identity-name">{identityLabel}</span>
      </button>

      {open && (
        <div className="auth-identity-dropdown" id="auth-identity-menu" role="menu">
          <div className="auth-identity-menu-header">
            <IdentityAvatar user={user} />
            <span>{identityLabel}</span>
          </div>

          <Link
            className="auth-identity-menu-action"
            to={APP_ROUTES.settings}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings2 size={17} aria-hidden="true" />
            Configurações
          </Link>

          <Button
            className="auth-identity-menu-action"
            variant="ghost"
            type="button"
            role="menuitem"
            onClick={handleLogout}
          >
            <LogOut size={17} aria-hidden="true" />
            Sair
          </Button>
        </div>
      )}
    </div>
  );
}
