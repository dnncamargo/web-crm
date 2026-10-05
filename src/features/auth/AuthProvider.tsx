import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";

import {
  configureAuthPersistence,
  loginWithGoogle,
  logout,
  subscribeToAuthState,
} from "./authService";
import {
  AuthContext,
  type AuthContextValue,
  type AuthProviderProps,
  type CrmAccessStatus,
} from "./authContext";
import { isFirestorePermissionDenied, verifyCrmAccess } from "./crmAccessService";

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [resolving, setResolving] = useState(true);
  const [crmAccess, setCrmAccess] = useState<CrmAccessStatus>("checking");

  useEffect(() => {
    let active = true;
    let accessRequestId = 0;
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

          const requestId = ++accessRequestId;
          setUser(nextUser);

          if (!nextUser) {
            setCrmAccess("checking");
            setResolving(false);
            return;
          }

          setCrmAccess("checking");
          setResolving(true);

          void verifyCrmAccess()
            .then(() => {
              if (!active || requestId !== accessRequestId) {
                return;
              }

              setCrmAccess("allowed");
              setResolving(false);
            })
            .catch((error: unknown) => {
              if (!active || requestId !== accessRequestId) {
                return;
              }

              setCrmAccess(isFirestorePermissionDenied(error) ? "denied" : "unavailable");
              setResolving(false);
            });
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
    crmAccess,
    loading: resolving,
    login: loginWithGoogle,
    logout,
  }), [crmAccess, resolving, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
