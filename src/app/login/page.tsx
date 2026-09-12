"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Activity, Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, HeartPulse } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/localdb";

export default function LoginPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  useEffect(() => {
    getCurrentUser()
      .then(({ hasUsers }) => {
        if (!hasUsers) router.replace("/register");
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-800 text-white shadow-xs mb-3">
            <HeartPulse size={28} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Pront<span className="text-teal-700 dark:text-teal-400">Enf</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs">
            Sistema de Prontuário Eletrônico de Enfermagem
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-7 shadow-xs border border-slate-200/90 dark:border-slate-800">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Acessar Plantão</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Entre com suas credenciais de enfermeiro(a)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs px-4 py-3 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail Profissional
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enfermeiro@hospital.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600/30 text-slate-900 dark:text-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                "Entrando..."
              ) : (
                <>
                  <LogIn size={17} /> Entrar no Sistema
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Primeiro acesso ao sistema?{" "}
              <Link
                href="/register"
                className="text-teal-700 dark:text-teal-400 hover:underline font-bold"
              >
                Cadastrar agora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
