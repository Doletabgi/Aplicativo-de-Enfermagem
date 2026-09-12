"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { NursingAIChat } from "@/components/NursingAIChat";

export default function AIChatPage() {
  const router = useRouter();

  return (
    <div className="space-y-4 pb-20 animate-fade-in max-w-4xl mx-auto">
      {/* Header com botão Voltar */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#111927] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Voltar para a Dashboard"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-800 dark:bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Pergunte para a IA
                </h1>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/40 inline-flex items-center gap-1">
                  <ShieldCheck size={11} /> Especialista
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40 inline-flex items-center gap-1">
                  <Zap size={11} /> Simplificado
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Suporte clínico em tempo real para enfermagem
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Componente de Chat em Altura Total */}
      <NursingAIChat className="h-[calc(100vh-230px)] min-h-[500px]" />
    </div>
  );
}
