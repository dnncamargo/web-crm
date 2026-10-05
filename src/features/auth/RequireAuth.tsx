import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { getInternalPath, getLoginPath } from "./authReturnTo";
import { useAuth } from "./useAuth";

export function AuthResolving() {
  return (
    <main className="auth-state" aria-live="polite">
      <p>Verificando sessão…</p>
    </main>
  );
}
export function RequireAuth() {
  const { user, resolving, crmAccess, logout } = useAuth();
  const location = useLocation();

  if (resolving || (user && crmAccess === "checking")) {
    return <AuthResolving />;
  }

  if (!user) {
    return <Navigate to={getLoginPath(getInternalPath(location))} replace />;
  }

  if (crmAccess === "denied") {
    return <CrmAccessMessage onLogout={() => void logout()} message="Esta conta não tem acesso ao sistema." />;
  }

  if (crmAccess === "unavailable") {
    return <CrmAccessMessage onLogout={() => void logout()} message="Não foi possível verificar o acesso ao sistema." />;
  }

  return <Outlet />;
}

function CrmAccessMessage({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <main className="auth-state" aria-live="polite">
      <p>{message}</p>
      <Button type="button" onClick={onLogout}>Sair / trocar conta</Button>
    </main>
  );
}
