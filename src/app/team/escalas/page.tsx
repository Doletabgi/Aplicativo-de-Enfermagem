"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Wand2, Clock, CalendarDays, Edit3, Calendar } from "lucide-react";

export default function EscalasDashboard() {
  const router = useRouter();

  const scales = [
    {
      title: "Escala 6x1 (Gerador com Folguista)",
      description: "Distribuição mensal 6x1 para equipe fixa com folguista volante. Rodízio de folgas semanais e domingos com verificação de cobertura.",
      href: "/team/fixa",
      icon: Wand2,
      badge: "Gerador Automático",
    },
    {
      title: "Escala 12x36 (Plantão Alternado)",
      description: "Divisão da equipe em Grupo A e Grupo B, alternando dia sim / dia não (12h de trabalho e 36h de descanso) ao longo de todo o mês.",
      href: "/team/12x36",
      icon: Clock,
      badge: "Plantão 12x36",
    },
    {
      title: "Escala 5x2 (Folgas Fixas Semanais)",
      description: "Jornada de 5 dias trabalhados com 2 dias de folga semanal, definidas individualmente para cada profissional da equipe.",
      href: "/team/5x2",
      icon: CalendarDays,
      badge: "Jornada 5x2",
    },
    {
      title: "Escala Personalizada (Grade Manual)",
      description: "Grade mensal interativa e flexível. Defina livremente dia a dia a escala de cada colaborador alternando entre Trabalho e Folga.",
      href: "/team/personalizada",
      icon: Edit3,
      badge: "Grade Manual",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header com Voltar */}
      <div>
        <button
          onClick={() => router.push("/team")}
          className="flex items-center gap-1 text-xs text-stone-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-2 transition-all duration-200"
        >
          <ChevronLeft size={14} /> Voltar para Gestão de Equipe
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-600 dark:text-teal-400">
              Planejamento Assistencial
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Escalas de Plantão
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Selecione o modelo de escala desejado para planejar os plantões ou acessar os meses salvos
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-teal-800 dark:bg-teal-700 text-white text-xs font-mono px-3.5 py-2 rounded-full whitespace-nowrap self-start sm:self-auto">
            4 Modelos Disponíveis
          </span>
        </div>
      </div>

      {/* Grid com as 4 escalas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {scales.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className="group text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs hover:border-teal-600/50 dark:hover:border-teal-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-teal-800 dark:bg-teal-700 flex items-center justify-center text-white shadow-xs">
                  <s.icon size={22} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  {s.badge}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                {s.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {s.description}
              </p>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-teal-700 dark:text-teal-400">Abrir Escala</span>
              <span className="text-stone-400 group-hover:translate-x-1 transition-transform font-bold text-sm">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
