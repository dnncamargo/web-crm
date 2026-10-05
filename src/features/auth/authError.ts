export function getAuthenticationErrorMessage(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : "";

  switch (code) {
    case "auth/user-disabled":
      return "Esta conta está desativada.";
    case "auth/popup-closed-by-user":
      return "Login cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google. Permita pop-ups e tente novamente.";
    case "auth/unauthorized-domain":
      return "Este endereço ainda não está autorizado para autenticação.";
    case "auth/operation-not-allowed":
      return "O login com Google ainda não está habilitado no Firebase.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}
