import { Navigate, Outlet, useLocation } from "react-router-dom";

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
  const { user, resolving } = useAuth();
  const location = useLocation();

  if (resolving) {
    return <AuthResolving />;
  }

  if (!user) {
    return <Navigate to={getLoginPath(getInternalPath(location))} replace />;
  }

  return <Outlet />;
}
