import { createContext, type ReactNode } from "react";
import type { User } from "firebase/auth";

export interface AuthContextValue {
  user: User | null;
  resolving: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}
