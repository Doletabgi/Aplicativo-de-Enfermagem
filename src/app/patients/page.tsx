"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, Plus, Users, Star, Bed, Calendar,
  Filter, X, LayoutGrid, List, AlertTriangle,
  Trash2, RefreshCw, Check, ChevronRight
} from "lucide-react";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { listPatients, getPatientStatus, setPatientPriority, deletePatient, listMedications } from "@/lib/localdb";
import { cancelMedicationNotification } from "@/lib/notifications";

interface PatientWithStatus {
  id: string;
  name: string;
  bed: string;
  active: boolean;
  priority: boolean;
  condition: string;
  admissionDate: string;
  dischargeDate: string | null;
  gender: string;
  photo: string;
  status: string;
  diagnosis?: string;
  birthDate?: string;
}

function PatientsList() {
  const searchParams = useSearchParams();
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") === "discharged" ? "discharged" : searchParams.get("status") === "all" ? "all" : "active"
  );
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [clinicalFilter, setClinicalFilter] = useState<string>(
    searchParams.get("filter") === "critico" || searchParams.get("filter") === "atencao" ? searchParams.get("filter")! : ""
  );

  // Modal de Exclusão de Paciente
  const [patientToDelete, setPatientToDelete] = useState<PatientWithStatus | null>(null);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPatients({
        status: statusFilter === "active" ? "active" : statusFilter === "discharged" ? "discharged" : null,
        priority: priorityFilter || null,
        search: search || null,
      });

      const withStatus = await Promise.all(
        data.map(async (p: any) => {
          const s = await getPatientStatus(p.id);
          const effective = p.condition === "CRITICO" ? "critico" : p.condition === "ATENCAO" ? "atencao" : s;
          return { ...p, status: effective };
        })
      );

      setPatients(withStatus);
    } catch (e) {
      console.error("Erro ao carregar pacientes:", e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    const timer = setTimeout(loadPatients, 300);
    return () => clearTimeout(timer);
  }, [loadPatients]);

  const togglePriority = async (id: string, current: boolean) => {
    await setPatientPriority(id, !current);
    loadPatients();
  };

  const handleDeletePatient = async () => {
    if (!patientToDelete) return;
    setDeletingPatient(true);
    try {
      // Cancela notificações das medicações ativas do paciente
      const patientMeds = await listMedications({ patientId: patientToDelete.id });
      for (const m of patientMeds) {
        await cancelMedicationNotification(m.id);
      }

      await deletePatient(patientToDelete.id);
      setToastMessage(`Paciente ${patientToDelete.name} excluído com sucesso.`);
      setTimeout(() => setToastMessage(null), 4000);
      setPatientToDelete(null);
      await loadPatients();
    } catch (err) {
      console.error("Erro ao excluir paciente:", err);
      setToastMessage("Erro ao excluir paciente.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDeletingPatient(false);
    }
  };

  const filteredByClinical = clinicalFilter ? patients.filter((p) => p.status === clinicalFilter) : patients;
  const activePatients = filteredByClinical.filter((p) => p.active);
  const dischargedPatients = filteredByClinical.filter((p) => !p.active);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Controle de Pacientes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs sm:text-sm">
            {activePatients.length} paciente(s) internado(s) no momento · {patients.length} total
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-700 text-teal-800 dark:text-teal-200 shadow-xs"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              title="Visualização em Tabela"
            >
              <List size={16} />
            </button>
          </div>

          <Link
            href="/patients/new"
            className="inline-flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs min-h-[44px]"
          >
            <Plus size={17} strokeWidth={2.5} />
            Adicionar Paciente
          </Link>
        </div>
      </div>

      {/* Search and Clinical Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, leito ou diagnóstico..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[44px]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filters Scrollable on Mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { value: "active", label: "Internados" },
            { value: "all", label: "Todos" },
            { value: "discharged", label: "Altas" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[42px] ${
                statusFilter === f.value
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}

          <button
            onClick={() => setPriorityFilter(!priorityFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[42px] ${
              priorityFilter
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Star size={13} className={priorityFilter ? "fill-white" : "text-amber-500 fill-amber-500"} />
            Prioritários
          </button>

          <button
            onClick={() => setClinicalFilter(clinicalFilter === "critico" ? "" : "critico")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[42px] ${
              clinicalFilter === "critico"
                ? "bg-rose-700 text-white border border-rose-700"
                : "bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${clinicalFilter === "critico" ? "bg-white" : "bg-rose-600 animate-pulse"}`} />
            Críticos
          </button>

          <button
            onClick={() => setClinicalFilter(clinicalFilter === "atencao" ? "" : "atencao")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[42px] ${
              clinicalFilter === "atencao"
                ? "bg-amber-600 text-white border border-amber-600"
                : "bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${clinicalFilter === "atencao" ? "bg-white" : "bg-amber-500"}`} />
            Atenção
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-14 bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
            <Users size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Nenhum paciente encontrado</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {search ? "Tente alterar os termos da busca ou desativar os filtros." : "Cadastre os pacientes para gerenciar prontuários e medicações."}
          </p>
          {!search && (
            <Link
              href="/patients/new"
              className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-xs font-semibold"
            >
              <Plus size={16} /> Adicionar Paciente
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Patients Section */}
          {activePatients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-600" />
                  Pacientes Internados ({activePatients.length})
                </h2>
              </div>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {activePatients.map((p) => (
                    <PatientCard
                      key={p.id}
                      p={p}
                      onTogglePriority={togglePriority}
                      onDelete={setPatientToDelete}
                    />
                  ))}
                </div>
              ) : (
                <PatientTableView
                  patients={activePatients}
                  onTogglePriority={togglePriority}
                  onDelete={setPatientToDelete}
                />
              )}
            </div>
          )}

          {/* Discharged Patients Section */}
          {dischargedPatients.length > 0 && (statusFilter === "all" || statusFilter === "discharged") && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Histórico de Altas ({dischargedPatients.length})
                </h2>
              </div>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {dischargedPatients.map((p) => (
                    <PatientCard
                      key={p.id}
                      p={p}
                      onTogglePriority={togglePriority}
                      onDelete={setPatientToDelete}
                    />
                  ))}
                </div>
              ) : (
                <PatientTableView
                  patients={dischargedPatients}
                  onTogglePriority={togglePriority}
                  onDelete={setPatientToDelete}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Toast Notificação de Feedback */}
      {toastMessage && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-teal-900/90 text-white text-xs font-semibold shadow-xl backdrop-blur-xs flex items-center gap-2 animate-fade-in max-w-[90%] truncate"
          style={{
            top: "calc(1.25rem + max(var(--safe-area-inset-top, 0px), env(safe-area-inset-top, 0px)))",
          }}
        >
          <Check size={14} className="text-teal-300 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Paciente */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir Paciente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação removerá permanentemente o cadastro e todos os registros associados (sinais vitais, prescrições e anotações).
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Paciente:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {patientToDelete.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Leito:</span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {patientToDelete.bed ? `Leito ${patientToDelete.bed}` : "Sem leito"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Situação:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {patientToDelete.active ? "Internado" : "Alta registrada"}
                </span>
              </div>
              {patientToDelete.diagnosis && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Hipótese Diagnóstica:</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                    {patientToDelete.diagnosis}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                disabled={deletingPatient}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[42px] disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeletePatient}
                disabled={deletingPatient}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-xs min-h-[42px] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {deletingPatient ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deletingPatient ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientCard({
  p,
  onTogglePriority,
  onDelete
}: {
  p: PatientWithStatus;
  onTogglePriority: (id: string, current: boolean) => void;
  onDelete: (p: PatientWithStatus) => void;
}) {
  const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados;
  const isCritical = p.status === "critico";

  return (
    <Link
      href={`/patient?id=${p.id}`}
      className={`block bg-white dark:bg-[#111927] rounded-xl border p-4 transition-colors hover:border-slate-400 dark:hover:border-slate-600 relative group/pcard ${
        isCritical
          ? "border-rose-300 dark:border-rose-900/80 bg-rose-50/15 dark:bg-rose-950/10"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Bed + Name Block */}
        <div className="flex items-start gap-3 min-w-0">
          {/* Bed Badge */}
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0 min-w-[50px]">
            <span className="block text-[9px] font-semibold text-slate-500 uppercase tracking-tight">Leito</span>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-white">
              {p.bed || "—"}
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {p.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
              <span>{p.gender}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar size={11} /> {new Date(p.admissionDate).toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>

        {/* Priority Star Toggle & Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePriority(p.id, p.priority);
            }}
            className={`p-1.5 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer ${
              p.priority
                ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                : "text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
            title={p.priority ? "Remover prioridade" : "Marcar como prioritário"}
          >
            <Star size={17} className={p.priority ? "fill-amber-500" : ""} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(p);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
            title={`Excluir paciente ${p.name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Diagnosis snippet */}
      {p.diagnosis && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 line-clamp-1 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded border border-slate-100 dark:border-slate-750">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Hipótese:</span> {p.diagnosis}
        </p>
      )}

      {/* Card Footer: Clinical Status & Actions */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isCritical ? "animate-pulse" : ""}`} />
          {cfg.label}
        </span>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(p);
            }}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1 transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30"
            title={`Excluir ${p.name}`}
          >
            <Trash2 size={13} />
            <span>Excluir</span>
          </button>

          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-0.5">
            Prontuário
            <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function PatientTableView({
  patients,
  onTogglePriority,
  onDelete
}: {
  patients: PatientWithStatus[];
  onTogglePriority: (id: string, current: boolean) => void;
  onDelete: (p: PatientWithStatus) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Paciente</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Leito</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Classificação</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Admissão</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {patients.map((p) => {
              const cfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados;
              return (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onTogglePriority(p.id, p.priority)}
                        className={`p-1 rounded transition-colors ${p.priority ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
                      >
                        <Star size={14} className={p.priority ? "fill-amber-500" : ""} />
                      </button>
                      <Link
                        href={`/patient?id=${p.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                      >
                        {p.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                    {p.bed || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {new Date(p.admissionDate).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={`Excluir paciente ${p.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                      <Link
                        href={`/patient?id=${p.id}`}
                        className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-0.5"
                      >
                        Acessar
                        <ChevronRight size={13} />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5 animate-pulse">
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-48" />
          <div className="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <PatientsList />
    </Suspense>
  );
}
