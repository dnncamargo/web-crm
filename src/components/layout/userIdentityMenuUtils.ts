import type { User } from "firebase/auth";

export function getUserIdentityLabel(user: Pick<User, "displayName" | "email">) {
  return user.displayName || user.email || "Usuário";
}
