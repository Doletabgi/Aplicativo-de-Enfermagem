"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, UserPlus, Activity, Clock,
  Bed, LogOut, Pill,
  CheckCircle2, AlertTriangle, ChevronRight,
  ClipboardList, Share2, Bot, Sparkles, HeartPulse,
  Eye, EyeOff
} from "lucide-react";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { useAuth } from "@/components/AuthProvider";
import { CarePlanModal } from "@/components/CarePlanModal";
import { SharePatientsModal } from "@/components/SharePatientsModal";
import {
  listPatients,
  getPatientStatus,
  listMedicationsToday,
  updateMedication,
  listTeamMembers,
  listTasks,
  listVitalSigns
} from "@/lib/localdb";
import MedicationsHomeCard from "@/components/dashboard/MedicationsHomeCard";

interface DashboardData {
  total: number;
  internados: number;
  altas: number;
  criticos: number;
  atencao: number;
  estaveis: number;
  semDados: number;
  equipe: number;
  vitalsCount: number;
  pendingTasksCount: number;
  pacientes: any[];
  todayMeds: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal para geração imediata de Cuidados IA na tela inicial
  const [carePlanModalOpen, setCarePlanModalOpen] = useState(false);
  const [carePlanPatientId, setCarePlanPatientId] = useState<string | null>(null);

  // Modal para seleção e compartilhamento de pacientes em lote
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Ocultar / Desocultar lista de pacientes internados no card
  const [showPatientsList, setShowPatientsList] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dashboard_show_patients_list");
      if (saved !== null) {
        setShowPatientsList(saved === "true");
      }
    } catch (e) {}
  }, []);

  const toggleShowPatientsList = () => {
    setShowPatientsList((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dashboard_show_patients_list", String(next));
      } catch (e) {}
      return next;
    });
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const patients = await listPatients();

      const statusPromises = patients.map(async (p: any) => {
        const status = await getPatientStatus(p.id);
        return { ...p, status };
      });

      const withStatus = await Promise.all(statusPromises);

      const effectiveStatus = (p: any) => {
        if (p.condition === "CRITICO") return "critico";
        if (p.condition === "ATENCAO") return "atencao";
        return p.status;
      };
      withStatus.forEach((p: any) => (p.status = effectiveStatus(p)));

      const total = withStatus.length;
      const internados = withStatus.filter((p: any) => p.active).length;
      const altas = withStatus.filter((p: any) => !p.active).length;
      const criticos = withStatus.filter((p: any) => p.active && p.status === "critico").length;
      const atencao = withStatus.filter((p: any) => p.active && p.status === "atencao").length;
      const estaveis = withStatus.filter((p: any) => p.active && p.status === "estavel").length;
      const semDados = withStatus.filter((p: any) => p.active && p.status === "sem_dados").length;

      const todayMeds = await listMedicationsToday();

      const teamMembers = await listTeamMembers();
      const equipe = teamMembers.filter((m: any) => m.active).length;

      const pendingTasks = await listTasks({ onlyPending: true });
      const pendingTasksCount = pendingTasks.length;

      const allVitals = await listVitalSigns();
      const vitalsCount = allVitals.length;

      setData({
        total, internados, altas, criticos, atencao, estaveis, semDados,
        equipe, vitalsCount, pendingTasksCount, pacientes: withStatus, todayMeds
      });
    } catch (e) {
      console.error("Erro ao carregar dashboard:", e);
    } finally {
      setLoading(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pendingMedsCount = data?.todayMeds?.filter((m) => !m.administered).length ?? 0;

  // Filtra e ordena estritamente os 5 cadastros mais recentes de pacientes internados
  const recentPatients = useMemo(() => {
    if (!data?.pacientes) return [];
    return [...data.pacientes]
      .filter((p: any) => p.active)
      .sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.admissionDate ? new Date(a.admissionDate).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.admissionDate ? new Date(b.admissionDate).getTime() : 0);
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || "").localeCompare(a.id || "");
      })
      .slice(0, 5);
  }, [data?.pacientes]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Shift Overview Header */}
      <div className="bg-slate-900 dark:bg-[#0f172a] text-white rounded-2xl p-5 sm:p-7 border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-teal-900/60 text-teal-300 border border-teal-700/60">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Plantão Ativo
              </span>
              <span className="text-xs text-slate-400 capitalize">
                {todayFormatted}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {user?.name ? `Enfermeiro(a) ${user.name}` : "Posto de Enfermagem"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Painel de controle clínico da unidade. Acompanhe a estratificação de risco, checklist de administração de medicamentos e prontuários.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs border border-slate-700 min-h-[44px] cursor-pointer"
              title="Compartilhamento e importação offline de pacientes"
            >
              <Share2 size={16} />
              Compartilhamento de Pacientes
            </button>

            <Link
              href="/patients/new"
              className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs min-h-[44px]"
            >
              <UserPlus size={17} />
              Adicionar Paciente
            </Link>
          </div>
        </div>
      </div>

      {/* Clinical Triage Overview Strip (Manchester / MEWS) */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-teal-700 dark:text-teal-400" />
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Triagem e Estratificação Clínica dos Leitos
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {data?.internados ?? 0} leito(s) ativo(s)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Crítico */}
          <Link
            href="/patients?filter=critico"
            className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:border-rose-400 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Crítico</p>
              </div>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">Alerta prioritário</p>
            </div>
            <span className="text-2xl font-extrabold font-mono text-rose-800 dark:text-rose-200 tabular-nums">
              {data?.criticos ?? 0}
            </span>
          </Link>

          {/* Atenção */}
          <Link
            href="/patients?filter=atencao"
            className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 hover:border-amber-400 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Atenção</p>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Sinais alterados</p>
            </div>
            <span className="text-2xl font-extrabold font-mono text-amber-800 dark:text-amber-200 tabular-nums">
              {data?.atencao ?? 0}
            </span>
          </Link>

          {/* Estável */}
          <Link
            href="/patients?status=active"
            className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">Estável</p>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">Parâmetros estáveis</p>
            </div>
            <span className="text-2xl font-extrabold font-mono text-emerald-800 dark:text-emerald-200 tabular-nums">
              {data?.estaveis ?? 0}
            </span>
          </Link>

          {/* Sem Dados */}
          <Link
            href="/patients?status=active"
            className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 hover:border-slate-400 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Sem dados</p>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Aguardando aferição</p>
            </div>
            <span className="text-2xl font-extrabold font-mono text-slate-800 dark:text-slate-200 tabular-nums">
              {data?.semDados ?? 0}
            </span>
          </Link>
        </div>
      </div>

      {/* Clinical Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Pergunte para a IA (Estilo Relatórios / Acesso ao Chat) */}
        <Link
          href="/ai-chat"
          className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between active:scale-[0.99] group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors font-bold">
              Pergunte para a IA
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Bot size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                IA
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40">
                Especialista
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Dúvidas e condutas</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400">
              <Sparkles size={13} />
              <span>Chat Clínico</span>
            </span>
            <span className="text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 font-medium">
              Acessar →
            </span>
          </div>
        </Link>

        {/* Medicações Pendentes */}
        <Link
          href="/medications?filter=pendentes"
          className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Medicações</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              pendingMedsCount > 0
                ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
            }`}>
              <Pill size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${
              pendingMedsCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-white"
            }`}>
              {pendingMedsCount}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">De {data?.todayMeds?.length ?? 0} prescrições</p>
          </div>
        </Link>

        {/* Sinais Vitais */}
        <Link
          href="/vitals"
          className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sinais Vitais</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
              <HeartPulse size={17} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
              {data?.vitalsCount ?? 0}
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Aferições registradas</p>
          </div>
        </Link>

        {/* Relatórios */}
        <Link
          href="/reports"
          className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between active:scale-[0.99] group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors font-bold">
              Relatórios
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ClipboardList size={17} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                3
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40">
                IA & Clínico
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Cuidados e IA</p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-400">
              <Bot size={13} />
              <span>Central</span>
            </span>
            <span className="text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200 font-medium">
              Acessar →
            </span>
          </div>
        </Link>
      </div>

      {/* Main Clinical Sections: Recent Patients & Today's Medications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pacientes Internados */}
        <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-teal-700 dark:text-teal-400" />
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-slate-900 dark:text-white text-sm">Pacientes Internados</h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/50 dark:border-teal-800/40">
                    5 mais recentes
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleShowPatientsList}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title={showPatientsList ? "Ocultar lista de pacientes" : "Desocultar lista de pacientes"}
                >
                  {showPatientsList ? (
                    <>
                      <EyeOff size={13} className="text-slate-500" />
                      <span>Ocultar</span>
                    </>
                  ) : (
                    <>
                      <Eye size={13} className="text-teal-600 dark:text-teal-400" />
                      <span className="text-teal-700 dark:text-teal-400">Desocultar</span>
                    </>
                  )}
                </button>
                <Link
                  href="/patients"
                  className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 font-semibold"
                >
                  Ver todos ({data?.internados ?? 0})
                </Link>
              </div>
            </div>

            {showPatientsList ? (
              <>
                {recentPatients.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {recentPatients.map((p: any) => {
                      const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados;
                      return (
                        <Link
                          key={p.id}
                          href={`/patient?id=${p.id}`}
                          className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Bed Tag */}
                            <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0">
                              <span className="block text-[10px] text-slate-500 uppercase tracking-tight">Leito</span>
                              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                                {p.bed || "—"}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {p.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                <span className="truncate">{p.diagnosis || "Sem diagnóstico informado"}</span>
                                {p.createdAt && (
                                  <>
                                    <span>•</span>
                                    <span className="shrink-0 text-[10px] text-slate-400">
                                      Cadastrado em {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCarePlanPatientId(p.id);
                                setCarePlanModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/60 transition-colors border border-teal-200/50 dark:border-teal-800/40"
                              title="Gerar plano de cuidados por IA para este paciente nesta tela"
                            >
                              <Bot size={13} />
                            </button>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${p.status === "critico" ? "animate-pulse" : ""}`} />
                              {cfg.label}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Nenhum paciente internado no momento</p>
                    <Link
                      href="/patients/new"
                      className="inline-flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 font-bold mt-2"
                    >
                      <UserPlus size={14} /> Cadastrar primeiro paciente
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2 animate-fade-in">
                <Users size={26} className="text-slate-400 dark:text-slate-600 opacity-60" />
                <p className="font-medium">Lista de pacientes oculta ({data?.internados ?? 0} internados)</p>
                <button
                  type="button"
                  onClick={toggleShowPatientsList}
                  className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <Eye size={13} />
                  Clique para desocultar
                </button>
              </div>
            )}
          </div>

          {showPatientsList && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Mostrando os {recentPatients.length} mais recentes ({data?.internados ?? 0} internados)
              </span>
              <Link
                href="/patients"
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
              >
                Acessar lista completa →
              </Link>
            </div>
          )}
        </div>

        {/* Today's Medications */}
        <MedicationsHomeCard onDataChanged={loadDashboard} />
      </div>

      {/* Modal Interativo de Cuidados por IA na tela inicial */}
      <CarePlanModal
        isOpen={carePlanModalOpen}
        onClose={() => setCarePlanModalOpen(false)}
        initialPatientId={carePlanPatientId}
      />

      {/* Modal de Compartilhamento de Pacientes */}
      <SharePatientsModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
