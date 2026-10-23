"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, UserRole } from "./types";

interface AuthState {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: "ADMIN",
    isAuthenticated: false,
    isLoading: true,
  });

  // Rehydrate auth from localStorage / cookie on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem("tkd_token");
      const storedUser = localStorage.getItem("tkd_user");
      if (token && storedUser) {
        const user: User = JSON.parse(storedUser);
        document.cookie = `tkd_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        setState({
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState({
          user: null,
          role: "ADMIN",
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback(
    async (identifier: string, password: string): Promise<boolean> => {
      try {
        const payload = {
          email: identifier,
          username: identifier,
          password,
        };

        const res = await fetch("/api/v1/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem("tkd_token", data.token);
          localStorage.setItem("tkd_user", JSON.stringify(data.user));
          document.cookie = `tkd_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
          setState({
            user: data.user,
            role: data.user.role,
            isAuthenticated: true,
            isLoading: false,
          });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("tkd_token");
    localStorage.removeItem("tkd_user");
    document.cookie = "tkd_token=; path=/; max-age=0; SameSite=Lax";
    setState({
      user: null,
      role: "ADMIN",
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    setState((prev) => {
      if (!prev.user) return { ...prev, role };
      const updatedUser: User = {
        ...prev.user,
        role,
      };
      try {
        localStorage.setItem("tkd_user", JSON.stringify(updatedUser));
      } catch {}
      return {
        ...prev,
        role,
        user: updatedUser,
      };
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
