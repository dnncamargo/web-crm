import { createContext, type ReactNode } from "react";
import type { User } from "firebase/auth";

export type CrmAccessStatus = "checking" | "allowed" | "denied" | "unavailable";

export interface AuthContextValue {
  user: User | null;
  resolving: boolean;
  crmAccess: CrmAccessStatus;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}
