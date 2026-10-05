import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { getAuthenticatedDestination, getReturnToFromSearch } from "./authReturnTo";
import { useAuth } from "./useAuth";

function getAuthenticationErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  switch (code) {
    case "auth/invalid-email":
      return "Informe um e-mail válido.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha inválidos.";
    case "auth/user-disabled":
      return "Esta conta está desativada.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde e tente novamente.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}
export function LoginPage() {
  const { user, resolving, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const returnTo = getReturnToFromSearch(location.search);

  if (resolving) {
    return <main className="auth-state" aria-live="polite"><p>Verificando sessão…</p></main>;
  }

  if (user) {
    return <Navigate to={getAuthenticatedDestination(returnTo)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    try {
      await login(email.trim(), password);
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

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="auth-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
