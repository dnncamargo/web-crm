import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import {
  configureAuthPersistence,
  loginWithGoogle,
  logout,
  subscribeToAuthState,
} from "./authService";
import { AuthContext, type AuthContextValue, type AuthProviderProps } from "./authContext";

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;

    void configureAuthPersistence()
      .catch(() => undefined)
      .then(() => {
        if (!active) {
          return;
        }

        unsubscribe = subscribeToAuthState((nextUser) => {
          if (!active) {
            return;
          }

          setUser(nextUser);
          setResolving(false);
        });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    resolving,
    loading: resolving,
    login: loginWithGoogle,
    logout,
  }), [resolving, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
