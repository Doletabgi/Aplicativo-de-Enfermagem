"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Pill,
  Clock,
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  listMedicationsToday,
  administerMedication,
  deleteMedication,
  checkDuplicateAdministration,
  type TodayMedication,
} from "@/lib/localdb";
import {
  EarlyAdminModal,
  DuplicateModal,
  type EarlyAdminPromptData,
  type DuplicatePromptData,
} from "@/components/medications/MedicationValidationModals";
import {
  cancelMedicationNotification,
  scheduleMedicationNotification,
} from "@/lib/notifications";
import {
  getMedStatus,
  minutesLate,
  minutesUntil,
  formatMinutes,
  formatScheduleTime,
  calculateNextSchedule,
  parseScheduleDate,
  type MedStatus,
} from "@/lib/medication-status";

interface MedicationsHomeCardProps {
  className?: string;
  onDataChanged?: () => void;
}

export default function MedicationsHomeCard({ className = "", onDataChanged }: MedicationsHomeCardProps) {
  const [meds, setMeds] = useState<TodayMedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modais de Validação de Horário (Antecipada e Duplicada)
  const [earlyAdminPrompt, setEarlyAdminPrompt] = useState<EarlyAdminPromptData | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptData | null>(null);

  // Modal de Exclusão de Medicação
  const [medToDelete, setMedToDelete] = useState<TodayMedication | null>(null);
  const [deletingMed, setDeletingMed] = useState(false);

  const loadMeds = useCallback(async () => {
    try {
      const data = await listMedicationsToday();
      setMeds(data);
    } catch (err) {
      console.error("Erro ao buscar medicações do dia:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeds();
  }, [loadMeds]);

  const executeAdminister = async (
    m: TodayMedication,
    options?: {
      observation?: string;
      earlyAdministration?: boolean;
      duplicateOverride?: boolean;
    }
  ) => {
    setTogglingId(m.id);
    const now = new Date();
    const previousMeds = meds;

    const isRecurring = !!(m.frequencyHours && m.frequencyHours > 0);
    let expectedNextSched = "";
    if (isRecurring) {
      expectedNextSched = calculateNextSchedule(m.schedule, m.frequencyHours!, now);
    }

    const nextSchedDate = expectedNextSched ? parseScheduleDate(expectedNextSched, now) : null;
    const isTomorrow = nextSchedDate
      ? nextSchedDate.getDate() !== now.getDate() ||
        nextSchedDate.getMonth() !== now.getMonth() ||
        nextSchedDate.getFullYear() !== now.getFullYear()
      : false;

    // Atualização otimista imediata
    if (isRecurring && isTomorrow) {
      setMeds((prev) => prev.filter((item) => item.id !== m.id));
    } else if (isRecurring) {
      setMeds((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? {
                ...item,
                schedule: formatScheduleTime(expectedNextSched),
                administered: false,
                administeredAt: null,
              }
            : item
        )
      );
    } else {
      setMeds((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, administered: true, administeredAt: now.toISOString() }
            : item
        )
      );
    }

    try {
      const result = await administerMedication(m, options);
      if (isRecurring) {
        await scheduleMedicationNotification(result.updatedMedication, {
          id: m.patientId,
          name: m.patientName,
          bed: m.patientBed,
        });
      } else {
        await cancelMedicationNotification(m.id);
      }

      setToastMessage(result.toastMessage);
      setTimeout(() => setToastMessage(null), 4000);

      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err) {
      console.error("Erro ao registrar administração da medicação:", err);
      // Rollback imediato caso falhe
      setMeds(previousMeds);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteMedication = async () => {
    if (!medToDelete) return;
    setDeletingMed(true);
    try {
      await cancelMedicationNotification(medToDelete.id);
      await deleteMedication(medToDelete.id);
      setToastMessage(`Medicação ${medToDelete.name} excluída.`);
      setTimeout(() => setToastMessage(null), 4000);
      setMedToDelete(null);
      await loadMeds();
      onDataChanged?.();
    } catch (err) {
      console.error("Erro ao excluir medicação:", err);
      setToastMessage("Erro ao excluir medicação.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDeletingMed(false);
    }
  };

  const handleToggle = async (m: TodayMedication) => {
    if (m.administered) return;

    const now = new Date();

    // 1. Validação de dose duplicada em sequência (últimos X minutos)
    try {
      const dupCheck = await checkDuplicateAdministration(m.id, m.frequencyHours, now);
      if (dupCheck && dupCheck.isDuplicate) {
        setDuplicatePrompt({
          medication: m,
          lastAdministeredAt: dupCheck.lastAdministeredAt,
          minutesAgo: dupCheck.minutesAgo,
        });
        return;
      }
    } catch (e) {
      console.warn("Erro ao checar dose duplicada:", e);
    }

    // 2. Validação de administração antecipada (> 30 minutos antes do horário)
    const remaining = minutesUntil(m, now);
    if (remaining > 30) {
      setEarlyAdminPrompt({
        medication: m,
        scheduledTime: m.schedule,
        minutesRemaining: remaining,
      });
      return;
    }

    // 3. Administração regular
    await executeAdminister(m);
  };

  const now = new Date();

  // Contadores globais de status do dia
  const feitasCount = meds.filter((m) => getMedStatus(m, now) === "administrado").length;
  const atrasadasCount = meds.filter((m) => getMedStatus(m, now) === "atrasado").length;
  const pendentesCount = meds.filter((m) => getMedStatus(m, now) === "pendente").length;

  // Comparador de urgência clínica: Atrasado (mais atrasado primeiro) > Pendente (mais próximo primeiro) > Administrado
  const compareMedUrgency = (a: TodayMedication, b: TodayMedication): number => {
    const statusA = getMedStatus(a, now);
    const statusB = getMedStatus(b, now);

    const rank: Record<MedStatus, number> = {
      atrasado: 0,
      pendente: 1,
      administrado: 2,
    };

    if (rank[statusA] !== rank[statusB]) {
      return rank[statusA] - rank[statusB];
    }

    if (statusA === "atrasado") {
      const lateA = minutesLate(a, now);
      const lateB = minutesLate(b, now);
      if (lateA !== lateB) return lateB - lateA;
    }

    if (statusA === "pendente") {
      const untilA = minutesUntil(a, now);
      const untilB = minutesUntil(b, now);
      if (untilA !== untilB) return untilA - untilB;
    }

    return (a.schedule || "00:00").localeCompare(b.schedule || "00:00");
  };

  // Regra: Máximo 1 item por paciente (o mais urgente)
  const patientMedMap = new Map<string, TodayMedication>();
  for (const m of meds) {
    const key = m.patientId || m.patientName;
    const existing = patientMedMap.get(key);
    if (!existing) {
      patientMedMap.set(key, m);
    } else {
      if (compareMedUrgency(m, existing) < 0) {
        patientMedMap.set(key, m);
      }
    }
  }

  // Ordena os pacientes por urgência
  const sortedPatientMeds = Array.from(patientMedMap.values()).sort(compareMedUrgency);
  const displayedMeds = sortedPatientMeds.slice(0, 4);
  const remainingCount = meds.length - displayedMeds.length;

  return (
    <div
      className={`bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between relative ${className}`}
    >
      <div>
        {/* Toast Notificação de Feedback */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-teal-900/90 text-white text-xs font-semibold shadow-lg backdrop-blur-xs flex items-center gap-1.5 animate-fade-in whitespace-nowrap max-w-[90%] truncate">
            <Check size={14} className="text-teal-300 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-2">
              <Pill size={17} className="text-teal-700 dark:text-teal-400 shrink-0" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm whitespace-nowrap">
                Medicações do Dia
              </h2>
            </div>
            {atrasadasCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1 shrink-0 animate-pulse">
                <AlertTriangle size={11} />
                {atrasadasCount} {atrasadasCount === 1 ? "atrasada" : "atrasadas"}
              </span>
            )}
          </div>

          <Link
            href="/medications"
            className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 font-semibold shrink-0 flex items-center gap-0.5 ml-auto"
          >
            Checklist completo
            <ChevronRight size={13} />
          </Link>
        </div>

        {/* Resumo */}
        {!loading && meds.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3.5 font-medium">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {feitasCount} feitas
            </span>
            <span>·</span>
            <span className="text-amber-700 dark:text-amber-400 font-semibold">
              {pendentesCount} pendentes
            </span>
            <span>·</span>
            <span
              className={
                atrasadasCount > 0
                  ? "text-rose-700 dark:text-rose-400 font-bold"
                  : "text-slate-500 dark:text-slate-400"
              }
            >
              {atrasadasCount} atrasadas
            </span>
          </div>
        )}

        {/* Conteúdo: Skeletons, Vazio ou Lista */}
        {loading ? (
          <div className="space-y-2.5 py-1">
            <div className="h-14 rounded-xl skeleton-shimmer" />
            <div className="h-14 rounded-xl skeleton-shimmer" />
            <div className="h-14 rounded-xl skeleton-shimmer" />
          </div>
        ) : meds.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Pill size={26} className="mx-auto mb-2 text-slate-400 dark:text-slate-600 opacity-60" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 max-w-xs mx-auto">
              Nenhuma medicação pendente para hoje.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {displayedMeds.map((m) => {
              const status = getMedStatus(m, now);
              const isOverdue = status === "atrasado";
              const isPending = status === "pendente";
              const isDone = status === "administrado";
              const isToggling = togglingId === m.id;

              const lateMins = minutesLate(m, now);
              const untilMins = minutesUntil(m, now);

              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-xl gap-3 transition-all ${
                    isDone
                      ? "bg-transparent opacity-65"
                      : isOverdue
                      ? "bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200/80 dark:border-rose-900/40 my-1 shadow-xs"
                      : "bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/30 my-1 shadow-xs"
                  }`}
                >
                  {/* Lado Esquerdo: Horário e Dados do Paciente */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`px-2 py-1 rounded-lg font-mono text-xs font-bold shrink-0 ${
                        isOverdue
                          ? "bg-rose-700 text-white shadow-xs"
                          : isPending
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {formatScheduleTime(m.schedule)}
                    </div>

                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                          isDone
                            ? "line-through text-slate-400 dark:text-slate-500"
                            : "text-slate-900 dark:text-white"
                        }`}
                      >
                        {isOverdue && (
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                          </span>
                        )}
                        {isPending && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600"></span>
                          </span>
                        )}
                        {m.name}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <p
                          className={`text-[11px] truncate ${
                            isDone
                              ? "text-slate-400 dark:text-slate-500"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {m.patientBed ? `Leito ${m.patientBed} · ` : ""}
                          {m.patientName}
                          {m.dose ? ` · ${m.dose}` : ""}
                        </p>

                        {isOverdue && (
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                            Atrasada · {formatMinutes(lateMins)}
                          </span>
                        )}

                        {isPending && (
                          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                            {untilMins > 0 ? `Próxima · em ${formatMinutes(untilMins)}` : "No horário"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lado Direito: Ação ou Check + Botão Excluir */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {isDone ? (
                      <div
                        className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-xs font-semibold px-2 py-1"
                        title="Administrado hoje"
                      >
                        <Check size={16} className="stroke-[2.5]" />
                        <span className="text-[11px]">Feito</span>
                      </div>
                    ) : isOverdue ? (
                      <button
                        type="button"
                        onClick={() => handleToggle(m)}
                        disabled={isToggling}
                        className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 min-h-[36px] transition-colors cursor-pointer disabled:opacity-50"
                        title="Marcar como administrado"
                      >
                        {isToggling ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>Marcar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggle(m)}
                        disabled={isToggling}
                        className="bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 min-h-[36px] transition-colors cursor-pointer disabled:opacity-50"
                        title="Marcar como administrado"
                      >
                        {isToggling ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        <span>Marcar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setMedToDelete(m)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={`Excluir medicação ${m.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link de "+N medicações — ver todas" se houver mais de 4 */}
      {!loading && remainingCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
          <Link
            href="/medications"
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-1"
          >
            +{remainingCount} {remainingCount === 1 ? "medicação" : "medicações"} — ver todas
            <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* Modais de Validação de Horário (Antecipação e Duplicidade) */}
      <EarlyAdminModal
        data={earlyAdminPrompt}
        onClose={() => setEarlyAdminPrompt(null)}
        onConfirm={(obs) => {
          if (!earlyAdminPrompt) return;
          const medToAdmin = earlyAdminPrompt.medication;
          setEarlyAdminPrompt(null);
          executeAdminister(medToAdmin, {
            observation: obs,
            earlyAdministration: true,
          });
        }}
      />

      <DuplicateModal
        data={duplicatePrompt}
        onClose={() => setDuplicatePrompt(null)}
        onConfirm={(obs) => {
          if (!duplicatePrompt) return;
          const medToAdmin = duplicatePrompt.medication;
          const isAlsoEarly = minutesUntil(medToAdmin, new Date()) > 30;
          setDuplicatePrompt(null);
          executeAdminister(medToAdmin, {
            observation: obs,
            duplicateOverride: true,
            earlyAdministration: isAlsoEarly,
          });
        }}
      />

      {/* Modal de Confirmação de Exclusão de Medicação */}
      {medToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir Medicação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Esta ação removerá a medicação da prescrição e cancelará os alertas agendados.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Paciente:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {medToDelete.patientName} {medToDelete.patientBed ? `(Leito ${medToDelete.patientBed})` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Medicação:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400">
                  {medToDelete.name} {medToDelete.dose ? `(${medToDelete.dose})` : ""}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Horário:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {medToDelete.schedule} {medToDelete.frequencyHours ? `(A cada ${medToDelete.frequencyHours}h)` : ""}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMedToDelete(null)}
                disabled={deletingMed}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMedication}
                disabled={deletingMed}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-xs min-h-[40px] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {deletingMed ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {deletingMed ? "Excluindo..." : "Confirmar Exclusão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
