/**
 * Auth Context — JWT-based authentication with Supabase integration.
 * Provides login, logout, token refresh, and role-based access.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getApiClient, ApiError } from "../services/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: ["read:own_projects", "read:molecules", "read:reports"],
  analyst: [
    "read:own_projects", "write:own_projects", "read:molecules", "write:molecules",
    "read:reports", "write:reports", "execute:analysis", "execute:predictions",
  ],
  project_manager: [
    "read:org_projects", "write:own_projects", "read:molecules", "write:molecules",
    "read:reports", "write:reports", "execute:analysis", "execute:predictions",
    "manage:projects", "approve:reports",
  ],
  org_admin: [
    "read:org_projects", "write:org_projects", "read:molecules", "write:molecules",
    "read:reports", "write:reports", "execute:analysis", "execute:predictions",
    "manage:projects", "approve:reports", "manage:users", "manage:org_settings",
    "read:audit_log",
  ],
  super_admin: ["*"],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const api = getApiClient();
    try {
      const result = await api.login(email, password);
      localStorage.setItem("access_token", result.access_token);
      localStorage.setItem("refresh_token", result.refresh_token);

      // Decode JWT to get user info (simple base64 decode, no verification)
      const payload = JSON.parse(atob(result.access_token.split(".")[1]));
      const userData: User = {
        id: payload.sub,
        email: payload.email || email,
        full_name: payload.full_name || email,
        role: payload.role || "viewer",
        organization_id: payload.organization_id || "",
      };

      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, "Network error — please try again");
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      const perms = ROLE_PERMISSIONS[user.role] || [];
      return perms.includes("*") || perms.includes(permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export default AuthContext;
