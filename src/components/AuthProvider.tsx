"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import * as localdb from "@/lib/localdb";

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: { name?: string; email?: string; password?: string }) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PUBLIC_ROUTES = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const checkAuth = useCallback(async () => {
    try {
      const { user, hasUsers } = await localdb.getCurrentUser();
      if (user) {
        setUser(user);
      } else {
        setUser(null);
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.replace(hasUsers ? "/login" : "/register");
        }
      }
    } catch (err) {
      console.warn("Primeira tentativa de checkAuth falhou, tentando novamente...", err);
      try {
        await new Promise((r) => setTimeout(r, 400));
        const retry = await localdb.getCurrentUser();
        if (retry.user) {
          setUser(retry.user);
          return;
        }
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.replace(retry.hasUsers ? "/login" : "/register");
        }
      } catch (retryErr) {
        console.error("Erro crítico em checkAuth:", retryErr);
        setUser(null);
        if (!PUBLIC_ROUTES.includes(pathname)) {
          router.replace("/login");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    try {
      const user = await localdb.login(email, password);
      setUser(user);
      router.push("/");
      return {};
    } catch (e: any) {
      return { error: e.message || "Erro ao fazer login" };
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const user = await localdb.register(name, email, password);
      setUser(user);
      router.push("/");
      return {};
    } catch (e: any) {
      return { error: e.message || "Erro ao cadastrar" };
    }
  };

  const logout = async () => {
    await localdb.logout();
    setUser(null);
    router.push("/login");
  };

  const updateUser = async (data: { name?: string; email?: string; password?: string }) => {
    try {
      await localdb.updateProfile(data);
      if (data.name) setUser((u) => u ? { ...u, name: data.name! } : null);
      return {};
    } catch (e: any) {
      return { error: e.message || "Erro ao atualizar" };
    }
  };

  if (loading || (!user && !PUBLIC_ROUTES.includes(pathname))) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-800 animate-pulse" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? "Carregando..." : "Redirecionando..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
