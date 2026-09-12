"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bot,
  FileText,
  ClipboardList,
  Sparkles,
  Search,
  X,
  ChevronRight,
  User,
  Bed,
  ArrowRight,
} from "lucide-react";
import { listPatients, getPatientStatus, Patient } from "@/lib/localdb";
import { CarePlanModal } from "@/components/CarePlanModal";
import { ShiftReportModal } from "@/components/ShiftReportModal";

interface PatientWithStatus extends Patient {
  status?: string;
}

const STATUS_CONFIG = {
  critico: {
    label: "Crítico",
    badge: "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40",
    dot: "bg-rose-500 animate-pulse",
  },
  atencao: {
    label: "Atenção",
    badge: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40",
    dot: "bg-amber-500",
  },
  estavel: {
    label: "Estável",
    badge: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40",
    dot: "bg-emerald-500",
  },
  sem_dados: {
    label: "Sem dados",
    badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export default function ReportsDashboard() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal para seleção de paciente (Evoluções)
  const [selectedTarget, setSelectedTarget] = useState<"cuidados" | "evolucoes" | "relatorio" | null>(null);
  const [search, setSearch] = useState("");

  // Modal de geração imediata de Cuidados IA nesta tela
  const [carePlanModalOpen, setCarePlanModalOpen] = useState(false);
  const [carePlanPatientId, setCarePlanPatientId] = useState<string | null>(null);

  // Modal de geração imediata de Relatório por IA nesta tela
  const [shiftReportModalOpen, setShiftReportModalOpen] = useState(false);
  const [shiftReportPatientId, setShiftReportPatientId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const rawPatients = await listPatients();
        const withStatus = await Promise.all(
          rawPatients.map(async (p) => {
            const status = await getPatientStatus(p.id);
            return { ...p, status };
          })
        );
        setPatients(withStatus);
      } catch (err) {
        console.error("Erro ao carregar pacientes para relatórios:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const reportModules = [
    {
      id: "cuidados" as const,
      title: "Cuidados por IA",
      badge: "Inteligência Clínica",
      badgeColor: "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/40",
      icon: Bot,
      iconBg: "bg-teal-700 dark:bg-teal-600 text-white",
      description:
        "Sugestões automatizadas de prescrições e cuidados de enfermagem baseados no diagnóstico médico, perfil do leito e quadro clínico.",
      actionText: "Gerar Cuidados por IA",
    },
    {
      id: "evolucoes" as const,
      title: "Evoluções",
      badge: "Prontuário / SOAP",
      badgeColor: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/60 dark:border-slate-700/50",
      icon: FileText,
      iconBg: "bg-slate-800 dark:bg-slate-700 text-white",
      description:
        "Registro de evolução diária de enfermagem, acompanhamento cronológico da assistência, histórico de turnos e intercorrências.",
      actionText: "Acessar Evoluções",
    },
    {
      id: "relatorio" as const,
      title: "Relatório por IA",
      badge: "Passagem de Plantão",
      badgeColor: "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/40",
      icon: ClipboardList,
      iconBg: "bg-teal-800 dark:bg-teal-700 text-white",
      description:
        "Consolidação completa e estruturada do turno: sinais vitais recentes, medicações administradas e sumário clínico para passagem de plantão.",
      actionText: "Compilar Relatório por IA",
    },
  ];

  const activePatients = patients.filter((p) => p.active);
  const filteredPatients = activePatients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.bed && p.bed.toLowerCase().includes(search.toLowerCase())) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(search.toLowerCase()))
  );

  const handleOpenModule = (target: "cuidados" | "evolucoes" | "relatorio") => {
    if (target === "cuidados") {
      setCarePlanPatientId(null);
      setCarePlanModalOpen(true);
      return;
    }
    if (target === "relatorio") {
      setShiftReportPatientId(null);
      setShiftReportModalOpen(true);
      return;
    }
    setSelectedTarget(target);
    setSearch("");
  };

  const handleSelectPatient = (patientId: string) => {
    if (!selectedTarget) return;
    router.push(`/patient?id=${patientId}&tab=${selectedTarget}`);
    setSelectedTarget(null);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Relatórios & Inteligência Clínica
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
              <Sparkles size={12} />
              Grupo Assistencial
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Selecione uma das funções abaixo para documentar a assistência ou gerar relatórios inteligentes
          </p>
        </div>
      </div>

      {/* Grid of Options (Cuidados IA, Evoluções, Relatório IA) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportModules.map((m) => (
          <button
            key={m.id}
            onClick={() => handleOpenModule(m.id)}
            className="group text-left bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs hover:border-teal-600/50 dark:hover:border-teal-500/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-xl ${m.iconBg} flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform`}
                >
                  <m.icon size={22} />
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${m.badgeColor}`}
                >
                  {m.badge}
                </span>
              </div>

              <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                {m.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                {m.description}
              </p>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-400">
              <span>{m.actionText}</span>
              <ChevronRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </div>
          </button>
        ))}
      </div>

      {/* Acesso Rápido por Paciente */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Pacientes Ativos no Plantão
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Acesse diretamente os cuidados, evoluções ou relatório de qualquer leito
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {activePatients.length} leito(s) em atendimento
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Carregando leitos ativos...
          </div>
        ) : activePatients.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Nenhum paciente internado no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activePatients.map((p) => {
              const cfg =
                STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ||
                STATUS_CONFIG.sem_dados;

              return (
                <div
                  key={p.id}
                  className="py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold">
                        Leito
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                        {p.bed || "—"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {p.diagnosis || "Sem diagnóstico informado"}
                      </p>
                    </div>
                  </div>

                  {/* 3 Action Buttons per patient */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setCarePlanPatientId(p.id);
                        setCarePlanModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors"
                      title="Gerar plano de cuidados com IA nesta tela"
                    >
                      <Bot size={14} />
                      <span>Cuidados IA</span>
                    </button>

                    <Link
                      href={`/patient?id=${p.id}&tab=evolucoes`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <FileText size={14} />
                      <span>Evoluções</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setShiftReportPatientId(p.id);
                        setShiftReportModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-800 hover:bg-teal-700 text-white shadow-xs transition-colors"
                      title="Gerar relatório de plantão com IA nesta tela"
                    >
                      <ClipboardList size={14} />
                      <span>Relatório IA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Informative Banner */}
      <div className="glass-panel rounded-2xl p-4 sm:p-5 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
        <Sparkles size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
        <span>
          O grupo de Relatórios centraliza a assistência clínica. Todos os dados são processados e salvos 100% offline no dispositivo com suporte a exportação e compartilhamento.
        </span>
      </div>

      {/* Modal Selecionar Paciente quando clicado em um dos cards */}
      {selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  {selectedTarget === "cuidados" && <Bot size={18} />}
                  {selectedTarget === "evolucoes" && <FileText size={18} />}
                  {selectedTarget === "relatorio" && <ClipboardList size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {selectedTarget === "cuidados" && "Cuidados IA — Selecionar Paciente"}
                    {selectedTarget === "evolucoes" && "Evoluções — Selecionar Paciente"}
                    {selectedTarget === "relatorio" && "Relatório IA — Selecionar Paciente"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedTarget === "cuidados" && "Selecione o leito para gerar as prescrições de cuidados da IA"}
                    {selectedTarget === "evolucoes" && "Selecione o leito para consultar ou redigir a evolução de enfermagem"}
                    {selectedTarget === "relatorio" && "Selecione o leito para consolidar o relatório de passagem de plantão"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative mt-4 shrink-0">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por paciente, leito ou diagnóstico..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Patient List */}
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-y-auto flex-1 max-h-80 pr-1">
              {filteredPatients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Nenhum paciente internado encontrado
                  </p>
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const cfg =
                    STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] ||
                    STATUS_CONFIG.sem_dados;

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPatient(p.id)}
                      className="w-full text-left flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0">
                          <span className="block text-[9px] text-slate-500 uppercase tracking-tight">
                            Leito
                          </span>
                          <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                            {p.bed || "—"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {p.diagnosis || "Sem diagnóstico informado"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        <ChevronRight
                          size={15}
                          className="text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                {activePatients.length} leito(s) ativo(s)
              </span>
              <button
                onClick={() => setSelectedTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interativo de Cuidados por IA - Geração Imediata nesta tela */}
      <CarePlanModal
        isOpen={carePlanModalOpen}
        onClose={() => setCarePlanModalOpen(false)}
        initialPatientId={carePlanPatientId}
      />

      {/* Modal Interativo de Relatório por IA - Geração Imediata nesta tela */}
      <ShiftReportModal
        isOpen={shiftReportModalOpen}
        onClose={() => setShiftReportModalOpen(false)}
        initialPatientId={shiftReportPatientId}
      />
    </div>
  );
}
