import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getAuthenticatedDestination, getReturnToFromSearch } from "./authReturnTo";
import { getAuthenticationErrorMessage } from "./authError";
import { useAuth } from "./useAuth";

export function LoginPage() {
  const { user, resolving, login } = useAuth();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const returnTo = getReturnToFromSearch(location.search);

  if (resolving) {
    return <main className="auth-state" aria-live="polite"><p>Verificando sessão…</p></main>;
  }

  if (user) {
    return <Navigate to={getAuthenticatedDestination(returnTo)} replace />;
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await login();
    } catch (error) {
      setErrorMessage(getAuthenticationErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <header className="auth-header">
          <img src="/brand/brand-mark.png" alt="Delícias do Porto" />
          <div>
            <h1>Entrar</h1>
            <p>Acesse o CRM para continuar.</p>
          </div>
        </header>

        <div className="auth-form">
          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

          <Button type="button" disabled={submitting} onClick={() => void handleGoogleLogin()}>
            {submitting ? "Abrindo Google…" : "Continuar com Google"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
