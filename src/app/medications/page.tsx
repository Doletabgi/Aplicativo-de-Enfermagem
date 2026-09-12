"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Pill, Clock, Check, ChevronRight, RefreshCw, User, AlertCircle,
  Search, X, CheckCircle2, AlertTriangle, Bell, Plus, FileText, CheckCircle,
  Calendar, BedDouble, Filter, MessageSquare, Sparkles, Mic, MicOff, ShieldAlert, History, Trash2
} from "lucide-react";
import {
  listMedicationsToday,
  updateMedication,
  createMedication,
  deleteMedication,
  listPatients,
  administerMedication,
  unadministerMedication,
  listMedicationAdministrations,
  checkDuplicateAdministration,
  type Patient,
  type TodayMedication,
  type MedicationAdministrationRecord
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
  testMedicationNotification,
} from "@/lib/notifications";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import {
  normalizeSpokenMedication,
  parseSpokenTime,
  parseMedicationVoiceInput,
} from "@/lib/clinical-voice-parser";
import { checkMedicationAllergyConflict } from "@/lib/clinical-allergy-checker";
import {
  getMedStatus,
  minutesUntil,
  minutesLate,
  formatMinutes,
  formatScheduleTime,
  calculateNextSchedule,
  parseScheduleDate,
  type MedStatus
} from "@/lib/medication-status";

export default function MedicationsPage() {
  const [meds, setMeds] = useState<TodayMedication[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [filter, setFilter] = useState<"total" | "pendentes" | "atrasadas" | "administradas">("total");
  const [testingNotice, setTestingNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Modais de Validação de Administração (Antecipada e Duplicada)
  const [earlyAdminPrompt, setEarlyAdminPrompt] = useState<EarlyAdminPromptData | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptData | null>(null);

  // Modal de Exclusão de Medicação
  const [medToDelete, setMedToDelete] = useState<TodayMedication | null>(null);
  const [deletingMed, setDeletingMed] = useState(false);

  // Modal de Histórico de Administrações
  const [historyModalMed, setHistoryModalMed] = useState<TodayMedication | null>(null);
  const [adminHistory, setAdminHistory] = useState<MedicationAdministrationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Modal "+ Nova Medicação"
  const [newMedModalOpen, setNewMedModalOpen] = useState(false);
  const [formPatientId, setFormPatientId] = useState("");
  const [formName, setFormName] = useState("");
  const [formDose, setFormDose] = useState("");
  const [formSchedule, setFormSchedule] = useState("08:00");
  const [formFrequency, setFormFrequency] = useState("8");
  const [formObservation, setFormObservation] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  // Bloqueio de Medicação por Alergia / Quadro Clínico
  const [allergyBlockModal, setAllergyBlockModal] = useState<{
    open: boolean;
    medName: string;
    matchedTerm: string;
    rawAllergy: string;
    patientName: string;
    source: "allergies" | "diagnosis";
  } | null>(null);

  const formSelectedPatient = patients.find((p) => p.id === formPatientId);
  const formAllergyConflict = checkMedicationAllergyConflict(formName, formSelectedPatient);

  // Voz / Microfone para cadastro de medicação
  const [activeVoiceField, setActiveVoiceField] = useState<"name" | "dose" | "schedule" | "observation" | null>(null);
  const [isFullVoiceActive, setIsFullVoiceActive] = useState(false);
  const [voiceSuccessCount, setVoiceSuccessCount] = useState<number | null>(null);

  const fullMedSpeech = useSpeechRecognition({ continuous: true, interimResults: true });
  const fieldMedSpeech = useSpeechRecognition({ continuous: false, interimResults: true });

  const liveTranscript = (fullMedSpeech.transcript + " " + fullMedSpeech.interimTranscript).trim();
  const liveParsed = parseMedicationVoiceInput(liveTranscript);

  const handleApplyFullVoice = () => {
    fullMedSpeech.stopListening();
    let count = 0;
    if (liveParsed.name) {
      setFormName(liveParsed.name);
      count++;
    }
    if (liveParsed.dose) {
      setFormDose(liveParsed.dose);
      count++;
    }
    if (liveParsed.schedule) {
      setFormSchedule(liveParsed.schedule);
      count++;
    }
    if (liveParsed.frequency !== undefined && liveParsed.frequency !== null) {
      setFormFrequency(liveParsed.frequency);
      count++;
    }
    if (liveParsed.observation) {
      setFormObservation(liveParsed.observation);
      count++;
    }
    setIsFullVoiceActive(false);
    setVoiceSuccessCount(count);
    setTimeout(() => setVoiceSuccessCount(null), 4000);
  };

  const toggleFieldVoice = (field: "name" | "dose" | "schedule" | "observation") => {
    if (activeVoiceField === field) {
      fieldMedSpeech.stopListening();
      setActiveVoiceField(null);
      return;
    }
    setActiveVoiceField(field);
    fieldMedSpeech.resetTranscript();
    fieldMedSpeech.startListening({
      onFinalText: (spokenText) => {
        const text = spokenText.trim();
        if (field === "name") {
          setFormName(normalizeSpokenMedication(text));
        } else if (field === "dose") {
          setFormDose(normalizeSpokenMedication(text));
        } else if (field === "schedule") {
          const parsedTime = parseSpokenTime(text);
          if (parsedTime) setFormSchedule(parsedTime);
        } else if (field === "observation") {
          setFormObservation(normalizeSpokenMedication(text));
        }
        setActiveVoiceField(null);
      },
    });
  };

  useEffect(() => {
    if (!newMedModalOpen) {
      fullMedSpeech.stopListening();
      fieldMedSpeech.stopListening();
      setIsFullVoiceActive(false);
      setActiveVoiceField(null);
    }
  }, [newMedModalOpen]);

  // Modal Checagem / Observação da Dose
  const [obsModalMed, setObsModalMed] = useState<TodayMedication | null>(null);
  const [obsText, setObsText] = useState("");
  const [obsAdministered, setObsAdministered] = useState(false);
  const [savingObs, setSavingObs] = useState(false);

  const showFeedbackToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3500);
  };

  const handleTestAlert = async () => {
    setTestingNotice(true);
    await testMedicationNotification();
    setTimeout(() => setTestingNotice(false), 3000);
  };

  const load = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [medsData, patientsData] = await Promise.all([
        listMedicationsToday(),
        listPatients({ status: "active" }),
      ]);
      setMeds(medsData);
      setPatients(patientsData);
      if (patientsData.length > 0 && !formPatientId) {
        setFormPatientId(patientsData[0].id);
      }
    } catch (e) {
      console.error("Erro ao carregar medicações:", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getStatus = (m: TodayMedication) => {
    const status = getMedStatus(m);
    if (status === "administrado") {
      return {
        label: "Administrado",
        color: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800",
        icon: CheckCircle2,
      };
    }
    if (status === "atrasado") {
      return {
        label: "Atrasado",
        color: "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-300 dark:border-rose-800",
        icon: AlertTriangle,
      };
    }
    const until = minutesUntil(m);
    if (until > 0) {
      return {
        label: "Pendente",
        color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
        icon: Clock,
      };
    }
    return {
      label: "No horário",
      color: "bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-300 dark:border-teal-800",
      icon: Clock,
    };
  };

  const handleOpenHistory = async (m: TodayMedication) => {
    setHistoryModalMed(m);
    setHistoryLoading(true);
    try {
      const list = await listMedicationAdministrations({ medicationId: m.id });
      setAdminHistory(list);
    } catch (err) {
      console.error("Erro ao carregar histórico de administrações:", err);
      setAdminHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const executeAdminister = async (
    m: TodayMedication,
    options?: {
      observation?: string;
      earlyAdministration?: boolean;
      duplicateOverride?: boolean;
    }
  ) => {
    setToggling(m.id);
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

    // Otimista
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
      showFeedbackToast(result.toastMessage);
    } catch (err) {
      console.error("Erro ao registrar administração:", err);
      setMeds(previousMeds);
      showFeedbackToast("Erro ao gravar alteração no banco de dados.");
    } finally {
      setToggling(null);
    }
  };

  const executeUnadminister = async (m: TodayMedication) => {
    setToggling(m.id);
    const previousMeds = meds;
    setMeds((prev) =>
      prev.map((item) =>
        item.id === m.id
          ? { ...item, administered: false, administeredAt: null }
          : item
      )
    );

    try {
      const result = await unadministerMedication(m);
      await scheduleMedicationNotification(result.updatedMedication, {
        id: m.patientId,
        name: m.patientName,
        bed: m.patientBed,
      });
      showFeedbackToast(result.toastMessage);
    } catch (err) {
      console.error("Erro ao desmarcar administração:", err);
      setMeds(previousMeds);
      showFeedbackToast("Erro ao desmarcar administração.");
    } finally {
      setToggling(null);
    }
  };

  // Exclusão de medicação direto no card
  const handleDeleteMedication = async () => {
    if (!medToDelete) return;
    setDeletingMed(true);
    try {
      await cancelMedicationNotification(medToDelete.id);
      await deleteMedication(medToDelete.id);
      showFeedbackToast(`Medicação ${medToDelete.name} excluída com sucesso.`);
      setMedToDelete(null);
      await load(true);
    } catch (err) {
      console.error("Erro ao excluir medicação:", err);
      showFeedbackToast("Erro ao excluir medicação.");
    } finally {
      setDeletingMed(false);
    }
  };

  // 1-Tap Toggle Administration directly on the screen (with optimistic updates, duplicate & early validation, auto-renewal)
  const toggle = async (m: TodayMedication) => {
    if (m.administered) {
      await executeUnadminister(m);
      return;
    }

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

    // 2. Validação de administração antecipada (> 30 minutos antes do horário programado)
    const remaining = minutesUntil(m, now);
    if (remaining > 30) {
      setEarlyAdminPrompt({
        medication: m,
        scheduledTime: m.schedule,
        minutesRemaining: remaining,
      });
      return;
    }

    // 3. Administração regular (dentro da janela de 30min antes ou após)
    await executeAdminister(m);
  };

  const handleOpenObsModal = (m: TodayMedication) => {
    setObsModalMed(m);
    setObsText(m.observation || "");
    setObsAdministered(m.administered);
  };

  const handleSaveObs = async () => {
    if (!obsModalMed) return;
    setSavingObs(true);
    try {
      const now = new Date();
      if (obsAdministered && !obsModalMed.administered) {
        const result = await administerMedication(obsModalMed, {
          observation: obsText.trim(),
        });
        if (obsModalMed.frequencyHours && obsModalMed.frequencyHours > 0) {
          await scheduleMedicationNotification(result.updatedMedication, {
            id: obsModalMed.patientId,
            name: obsModalMed.patientName,
            bed: obsModalMed.patientBed,
          });
        } else {
          await cancelMedicationNotification(obsModalMed.id);
        }
        showFeedbackToast(result.toastMessage);
      } else {
        const updated = await updateMedication(obsModalMed.id, {
          observation: obsText.trim(),
          administered: obsAdministered,
          administeredAt: obsAdministered
            ? (obsModalMed.administeredAt || now.toISOString())
            : null,
        });

        if (obsAdministered) {
          await cancelMedicationNotification(obsModalMed.id);
        } else {
          await scheduleMedicationNotification(
            updated,
            { id: obsModalMed.patientId, name: obsModalMed.patientName, bed: obsModalMed.patientBed }
          );
        }
        showFeedbackToast("Observações e checagem atualizadas com sucesso.");
      }
      await load(true);
      setObsModalMed(null);
    } catch (err) {
      console.error("Erro ao salvar observação da dose:", err);
      showFeedbackToast("Erro ao salvar checagem.");
    } finally {
      setSavingObs(false);
    }
  };

  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPatientId || !formName.trim() || !formDose.trim() || !formSchedule.trim()) {
      alert("Por favor selecione o paciente e preencha nome do medicamento, dose e horário.");
      return;
    }

    const targetPatient = patients.find((p) => p.id === formPatientId);

    // Verificação de Segurança Clínica: Bloqueio por Alergia no Quadro Clínico
    const conflict = checkMedicationAllergyConflict(formName, targetPatient);
    if (conflict.hasConflict) {
      setAllergyBlockModal({
        open: true,
        medName: formName.trim(),
        matchedTerm: conflict.matchedTerm || formName.trim(),
        rawAllergy: conflict.rawAllergyText || targetPatient?.allergies || "Alergia registrada",
        patientName: targetPatient?.name || "Paciente",
        source: conflict.source || "allergies",
      });
      return;
    }

    setFormSaving(true);
    try {
      const freqNum = formFrequency ? parseInt(formFrequency, 10) : null;
      const validFreq = freqNum && freqNum >= 1 ? freqNum : null;

      const created = await createMedication({
        patientId: formPatientId,
        name: formName.trim(),
        dose: formDose.trim(),
        schedule: formSchedule.trim(),
        frequencyHours: validFreq,
        observation: formObservation.trim(),
        administered: false,
      });

      if (targetPatient) {
        await scheduleMedicationNotification(created, {
          id: targetPatient.id,
          name: targetPatient.name,
          bed: targetPatient.bed,
          active: targetPatient.active,
        });
      }

      await load(true);
      setNewMedModalOpen(false);
      setFormName("");
      setFormDose("");
      setFormSchedule("08:00");
      setFormFrequency("8");
      setFormObservation("");
      showFeedbackToast(`Medicação ${created.name} cadastrada com sucesso!`);
    } catch (err) {
      console.error("Erro ao cadastrar medicação:", err);
      alert("Falha ao salvar nova medicação.");
    } finally {
      setFormSaving(false);
    }
  };

  const total = meds.length;
  const pendentes = meds.filter((m) => !m.administered).length;
  const atrasadas = meds.filter((m) => getMedStatus(m) === "atrasado").length;
  const administradas = total - pendentes;

  const filteredMeds = meds
    .filter((m) => {
      if (selectedPatientId !== "all" && m.patientId !== selectedPatientId) return false;
      if (filter === "pendentes") return !m.administered;
      if (filter === "atrasadas") return getMedStatus(m) === "atrasado";
      if (filter === "administradas") return m.administered;
      return true;
    })
    .filter((m) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.patientName.toLowerCase().includes(q) ||
        (m.patientBed && m.patientBed.toLowerCase().includes(q)) ||
        m.schedule.includes(q) ||
        (m.observation && m.observation.toLowerCase().includes(q))
      );
    });

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const chips = [
    {
      key: "total" as const,
      label: "Total de Doses",
      value: total,
      badge: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
      border: "border-slate-200 dark:border-slate-800",
    },
    {
      key: "pendentes" as const,
      label: "Pendentes",
      value: pendentes,
      badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200",
      border: "border-amber-200 dark:border-amber-800/60",
    },
    {
      key: "atrasadas" as const,
      label: "Atrasadas",
      value: atrasadas,
      badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200",
      border: "border-rose-200 dark:border-rose-800/60",
      isAlert: atrasadas > 0,
    },
    {
      key: "administradas" as const,
      label: "Administradas",
      value: administradas,
      badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200",
      border: "border-emerald-200 dark:border-emerald-800/60",
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-24">
      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xl border border-slate-700/60 dark:border-slate-300 flex items-center gap-2.5 text-xs font-semibold animate-fade-in backdrop-blur-md max-w-[92vw]"
          style={{
            bottom: "calc(5rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))",
          }}
        >
          <CheckCircle2 size={18} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Administração de Medicações
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
              100% Offline
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs sm:text-sm capitalize">
            Plantão: {dateLabel} · Checagem e registro direto na tela
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setNewMedModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs min-h-[42px]"
          >
            <Plus size={16} />
            + Nova Medicação
          </button>
          <button
            onClick={handleTestAlert}
            disabled={testingNotice}
            className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-[#111927] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs min-h-[42px] disabled:opacity-50"
            title="Testa alarme de notificação push em 3s"
          >
            <Bell size={14} className={testingNotice ? "animate-bounce text-teal-600" : "text-slate-500"} />
            {testingNotice ? "Enviando..." : "Testar Alerta"}
          </button>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-[#111927] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs min-h-[42px] disabled:opacity-50"
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Clinical Summary Filter Chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`text-left rounded-xl border p-3.5 sm:p-4 flex items-center justify-between transition-colors cursor-pointer bg-white dark:bg-[#111927] min-h-[68px] ${
              filter === c.key
                ? "border-teal-600 ring-2 ring-teal-600/30 dark:border-teal-500 dark:ring-teal-500/30 shadow-xs"
                : `${c.border} hover:border-slate-400 dark:hover:border-slate-700`
            }`}
          >
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
                {c.label}
              </p>
              <p className="text-xl sm:text-2xl font-bold mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                {c.value}
              </p>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${c.badge}`}>
              {c.value}
            </div>
          </button>
        ))}
      </div>

      {/* Search and Patient Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por medicamento, leito, paciente ou horário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white placeholder:text-slate-400 min-h-[44px]"
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

        <div>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full py-2.5 px-3 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white min-h-[44px]"
          >
            <option value="all">Todos os pacientes ({patients.length})</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.bed ? `[Leito ${p.bed}] ` : ""}{p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Medications Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      ) : filteredMeds.length === 0 ? (
        <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 text-center py-14 p-6 shadow-xs">
          <Pill size={36} className="mx-auto text-slate-400 mb-2.5" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {filter === "total"
              ? "Nenhuma medicação cadastrada para os pacientes internados"
              : filter === "atrasadas"
              ? "Nenhuma medicação em atraso no momento"
              : filter === "pendentes"
              ? "Todas as doses programadas foram administradas com sucesso!"
              : "Nenhum registro com o filtro selecionado"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md mx-auto">
            Você pode cadastrar e administrar doses diretamente aqui tocando em <strong>+ Nova Medicação</strong> acima.
          </p>
          <div className="mt-4">
            <button
              onClick={() => setNewMedModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold hover:bg-teal-600 transition-colors shadow-xs"
            >
              <Plus size={15} />
              Adicionar Medicação Agora
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Alert bar if overdue medications exist */}
          {atrasadas > 0 && filter !== "administradas" && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-800 dark:text-rose-200">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>Atenção: {atrasadas} dose(s) com horário vencido no plantão. Verifique os leitos e administre.</span>
            </div>
          )}

          {/* Mobile Card View (Optimized for Fast One-Handed Nurse Administration) */}
          <div className="block md:hidden space-y-3">
            {filteredMeds.map((m) => {
              const st = getStatus(m);
              const isDone = m.administered;
              const isBusy = toggling === m.id;
              const isOverdue = !isDone && st.label === "Atrasado";
              const isPending = !isDone && !isOverdue;

              return (
                <div
                  key={m.id}
                  className={`rounded-2xl p-4 transition-all shadow-xs ${
                    isDone
                      ? "border border-emerald-200/80 dark:border-emerald-900/60 bg-white dark:bg-[#111927]"
                      : isOverdue
                      ? "med-card-overdue shadow-md shadow-rose-500/20"
                      : "med-card-pending shadow-md shadow-amber-500/15"
                  }`}
                >
                  {/* Top Bar: Time, Status & Patient Bed */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                        isOverdue
                          ? "bg-rose-700 text-white shadow-xs"
                          : isPending
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-slate-900 dark:bg-slate-800 text-white"
                      }`}>
                        {m.schedule}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${st.color}`}>
                        {isOverdue && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                          </span>
                        )}
                        {isPending && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600"></span>
                          </span>
                        )}
                        {st.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 min-w-0">
                      {m.patientBed && (
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-mono font-bold text-[11px] border border-teal-200 dark:border-teal-800 shrink-0">
                          Leito {m.patientBed}
                        </span>
                      )}
                      <Link
                        href={`/patient?id=${m.patientId}`}
                        className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-teal-600 truncate max-w-[130px]"
                      >
                        {m.patientName}
                      </Link>
                    </div>
                  </div>

                  {/* Body: Drug Name, Dose, Frequency, Observation */}
                  <div className="mt-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {m.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded">
                            Dose: {m.dose}
                          </span>
                          {m.frequencyHours && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              (A cada {m.frequencyHours}h)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {m.observation && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg mt-2 border border-slate-100 dark:border-slate-800">
                        <strong>Obs:</strong> {m.observation}
                      </p>
                    )}
                  </div>

                  {/* Action Bar: Timestamp, Notes Modal Trigger, Direct Administration Toggle */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => handleOpenObsModal(m)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 min-h-[38px]"
                        title="Adicionar observação clínica / checagem"
                      >
                        <MessageSquare size={13} className="text-slate-500" />
                        Obs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(m)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-teal-700 dark:hover:text-teal-400 flex items-center gap-1 min-h-[38px]"
                        title="Ver histórico de doses"
                      >
                        <History size={13} className="text-slate-500" />
                        Histórico
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedToDelete(m)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1 min-h-[38px] transition-colors"
                        title="Excluir esta medicação do paciente"
                      >
                        <Trash2 size={13} />
                        <span className="hidden xs:inline">Excluir</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDone && m.administeredAt && (
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hidden xs:inline">
                          {new Date(m.administeredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => toggle(m)}
                        disabled={isBusy}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all min-h-[44px] min-w-[125px] justify-center cursor-pointer shadow-xs active:scale-95 ${
                          isDone
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-2 border-emerald-500 dark:border-emerald-600 hover:bg-emerald-200"
                            : "bg-teal-700 hover:bg-teal-600 text-white shadow-teal-900/20 active:bg-teal-800"
                        }`}
                      >
                        {isBusy ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : isDone ? (
                          <CheckCircle2 size={16} className="text-emerald-700 dark:text-emerald-300" />
                        ) : (
                          <Check size={16} strokeWidth={2.5} />
                        )}
                        {isDone ? "Administrado" : "Dar Dose"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Table View */}
          <div className="hidden md:block bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Horário</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Leito / Paciente</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Medicamento & Dose</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Observações / Checagem</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Administrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredMeds.map((m) => {
                    const st = getStatus(m);
                    const StatusIcon = st.icon;
                    const isBusy = toggling === m.id;
                    const isDone = m.administered;
                    const isOverdue = !isDone && st.label === "Atrasado";
                    const isPending = !isDone && !isOverdue;

                    return (
                      <tr
                        key={m.id}
                        className={`transition-all ${
                          isDone
                            ? "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                            : isOverdue
                            ? "bg-rose-50/70 dark:bg-rose-950/50 animate-pulse border-l-4 border-l-rose-600 shadow-xs"
                            : "bg-amber-50/60 dark:bg-amber-950/40 animate-pulse border-l-4 border-l-amber-500 shadow-xs"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {m.schedule}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {m.patientBed && (
                              <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-mono font-bold text-[10px] border border-teal-200 dark:border-teal-800 shrink-0">
                                L.{m.patientBed}
                              </span>
                            )}
                            <Link
                              href={`/patient?id=${m.patientId}`}
                              className="font-bold text-slate-800 dark:text-slate-200 hover:text-teal-600 hover:underline"
                            >
                              {m.patientName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-white">{m.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-teal-700 dark:text-teal-400 font-semibold">{m.dose}</span>
                            {m.frequencyHours && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">· {m.frequencyHours}h</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {m.observation ? (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={m.observation}>
                              {m.observation}
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Sem observações</span>
                          )}
                          {m.administered && m.administeredAt && (
                            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                              Dado às {new Date(m.administeredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.color}`}>
                            <StatusIcon size={12} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(m)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-teal-700 dark:hover:text-teal-400"
                              title="Ver histórico de doses"
                            >
                              <History size={14} />
                            </button>
                            <button
                              onClick={() => handleOpenObsModal(m)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar observação da checagem"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setMedToDelete(m)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Excluir medicação"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              onClick={() => toggle(m)}
                              disabled={isBusy}
                              className={`px-3 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-all disabled:opacity-50 min-h-[38px] cursor-pointer ${
                                m.administered
                                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-500 dark:border-emerald-600"
                                  : "bg-teal-700 hover:bg-teal-600 text-white shadow-xs"
                              }`}
                              title={m.administered ? "Clique para desmarcar" : "Marcar como administrado"}
                            >
                              {isBusy ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={14} />
                              )}
                              {m.administered ? "Administrado" : "Dar Dose"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Medicação */}
      {newMedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                  <Pill size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cadastrar Nova Medicação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Prescrição direta no plantão atual
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isFullVoiceActive) {
                      fullMedSpeech.stopListening();
                      setIsFullVoiceActive(false);
                    } else {
                      setIsFullVoiceActive(true);
                      fullMedSpeech.resetTranscript();
                      fullMedSpeech.startListening();
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                    isFullVoiceActive
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                  }`}
                  title="Ditar prescrição completa por voz"
                >
                  <Mic size={14} className={isFullVoiceActive ? "animate-bounce" : ""} />
                  {isFullVoiceActive ? "Ouvindo..." : "Ditar Prescrição"}
                </button>
                <button
                  onClick={() => setNewMedModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Fechar modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Banner de Sucesso ao Aplicar Voz */}
            {voiceSuccessCount !== null && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-xs">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    {voiceSuccessCount > 0
                      ? `✓ ${voiceSuccessCount} campos preenchidos por voz! Revise antes de salvar.`
                      : "Nenhum campo específico identificado. Você pode tocar no microfone de cada campo."}
                  </span>
                </div>
                <button
                  onClick={() => setVoiceSuccessCount(null)}
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Painel de Ditar Prescrição Completa */}
            {isFullVoiceActive && (
              <div className="mb-4 p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>{fullMedSpeech.isListening ? "Ouvindo prescrição médica..." : "Microfone pausado"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fullMedSpeech.stopListening();
                      setIsFullVoiceActive(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                  Ex: &quot;Dipirona quinhentos miligramas, uma ampola endovenosa às 08 horas de 8 em 8 horas diluir em 100ml de soro&quot;
                </p>

                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs min-h-[48px] max-h-[75px] overflow-y-auto">
                  {liveTranscript ? (
                    <span className="text-slate-900 dark:text-white font-medium">{liveTranscript}</span>
                  ) : (
                    <span className="text-slate-400 italic">Sua fala aparecerá aqui em tempo real...</span>
                  )}
                </div>

                {/* Prévia dos Campos Identificados */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className={`p-1.5 rounded-lg border ${liveParsed.name ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Medicamento:</span>
                    <span className="truncate block">{liveParsed.name || "—"}</span>
                  </div>

                  <div className={`p-1.5 rounded-lg border ${liveParsed.dose ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Dose / Via:</span>
                    <span className="truncate block">{liveParsed.dose || "—"}</span>
                  </div>

                  <div className={`p-1.5 rounded-lg border ${liveParsed.schedule ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Horário:</span>
                    <span className="font-mono block">{liveParsed.schedule || "—"}</span>
                  </div>

                  <div className={`p-1.5 rounded-lg border ${liveParsed.frequency !== undefined ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Intervalo:</span>
                    <span className="block">
                      {liveParsed.frequency ? `A cada ${liveParsed.frequency}h` : liveParsed.frequency === "" ? "Se Necessário" : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {liveTranscript ? (
                    <button
                      type="button"
                      onClick={() => fullMedSpeech.resetTranscript()}
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                    >
                      Limpar fala
                    </button>
                  ) : <span />}
                  <button
                    type="button"
                    onClick={handleApplyFullVoice}
                    disabled={!liveTranscript}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    <Check size={14} /> Aplicar na Prescrição
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateMedication} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Paciente Internado *
                </label>
                <select
                  value={formPatientId}
                  onChange={(e) => setFormPatientId(e.target.value)}
                  required
                  className="w-full py-2 px-3 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white min-h-[42px]"
                >
                  <option value="" disabled>Selecione o paciente...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.bed ? `[Leito ${p.bed}] ` : ""}{p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nome do Medicamento *
                    </label>
                    {activeVoiceField === "name" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Ouvindo nome...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ex: Dipirona 500mg/ml"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className={`w-full py-2 pl-3 pr-10 bg-white dark:bg-[#162032] border rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white min-h-[42px] ${
                        formAllergyConflict.hasConflict
                          ? "border-rose-500 ring-2 ring-rose-500/30"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleFieldVoice("name")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeVoiceField === "name"
                          ? "bg-rose-500 text-white animate-pulse shadow-xs"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar nome do medicamento"
                    >
                      <Mic size={15} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Dose / Posologia *
                    </label>
                    {activeVoiceField === "dose" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Ouvindo dose...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ex: 2 mL EV ou 1 comp VO"
                      value={formDose}
                      onChange={(e) => setFormDose(e.target.value)}
                      className="w-full py-2 pl-3 pr-10 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFieldVoice("dose")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeVoiceField === "dose"
                          ? "bg-rose-500 text-white animate-pulse shadow-xs"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar dose e via"
                    >
                      <Mic size={15} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Horário Inicial *
                    </label>
                    {activeVoiceField === "schedule" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Diga ex: 14 horas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      required
                      value={formSchedule}
                      onChange={(e) => setFormSchedule(e.target.value)}
                      className="flex-1 py-2 px-3 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFieldVoice("schedule")}
                      className={`p-2 rounded-xl border min-h-[42px] min-w-[42px] flex items-center justify-center transition-colors ${
                        activeVoiceField === "schedule"
                          ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-xs"
                          : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar horário"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                  {/* Quick time buttons */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {["06:00", "08:00", "12:00", "14:00", "18:00", "20:00", "22:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormSchedule(t)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Frequência / Intervalo (horas)
                    </label>
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                      {formFrequency && Number(formFrequency) >= 1
                        ? `A cada ${formFrequency}h (${Math.floor(24 / Number(formFrequency))}x/dia)`
                        : "Dose única / Se necessário"}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={48}
                      step={1}
                      placeholder="Ex: 8 (para 8 em 8h) ou vazio"
                      value={formFrequency}
                      onChange={(e) => setFormFrequency(e.target.value)}
                      className="w-full py-2 px-3 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white min-h-[42px] focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono"
                    />
                    {formFrequency !== "" && (
                      <button
                        type="button"
                        onClick={() => setFormFrequency("")}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        title="Limpar (Dose única/SN)"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Aviso se digitado menor que 1 */}
                  {formFrequency !== "" && Number(formFrequency) < 1 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Intervalo mínimo de 1 hora
                    </p>
                  )}

                  {/* Chips de seleção rápida */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setFormFrequency("")}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors ${
                        formFrequency === ""
                          ? "bg-teal-600 text-white font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900"
                      }`}
                    >
                      Dose única/SN
                    </button>
                    {["2", "3", "4", "6", "8", "12", "24"].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setFormFrequency(h)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-colors ${
                          formFrequency === h
                            ? "bg-teal-600 text-white font-bold"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900"
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Observações / Recomendações
                  </label>
                  {activeVoiceField === "observation" && (
                    <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                      Ouvindo observações...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="Ex: Administrar diluído em 100ml de SF 0.9% correr em 30min"
                    value={formObservation}
                    onChange={(e) => setFormObservation(e.target.value)}
                    className="w-full py-2 pl-3 pr-10 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => toggleFieldVoice("observation")}
                    className={`absolute right-2 top-3 p-1.5 rounded-lg transition-colors ${
                      activeVoiceField === "observation"
                        ? "bg-rose-500 text-white animate-pulse shadow-xs"
                        : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title="Ditar observações"
                  >
                    <Mic size={15} />
                  </button>
                </div>
              </div>

              {/* Banner de Bloqueio por Alergia */}
              {formAllergyConflict.hasConflict && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-500 text-rose-800 dark:text-rose-200 space-y-1.5 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="font-bold text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">
                      Bloqueio de Segurança: Alergia Conhecida!
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed pl-6">
                    O paciente <strong>{formSelectedPatient?.name}</strong> possui registro de alergia a <strong>&quot;{formAllergyConflict.matchedTerm}&quot;</strong> no Quadro Clínico ({formAllergyConflict.source === "allergies" ? "Alergias" : "Diagnóstico"}).
                    O cadastro desta medicação está <strong>bloqueado pelo sistema</strong>.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewMedModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[42px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formSaving || formAllergyConflict.hasConflict}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs min-h-[42px] disabled:opacity-50 inline-flex items-center gap-2 ${
                    formAllergyConflict.hasConflict
                      ? "bg-rose-700 text-white cursor-not-allowed opacity-90 shadow-none"
                      : "bg-teal-700 hover:bg-teal-600 text-white"
                  }`}
                >
                  {formAllergyConflict.hasConflict ? (
                    <>
                      <ShieldAlert size={14} />
                      Bloqueado por Alergia
                    </>
                  ) : (
                    <>
                      {formSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      Salvar Medicação
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Checagem / Observações da Dose */}
      {obsModalMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Checagem & Observação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {obsModalMed.name} ({obsModalMed.dose})
                </p>
              </div>
              <button
                onClick={() => setObsModalMed(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl mb-3 text-xs space-y-1">
              <p>
                <strong>Paciente:</strong> {obsModalMed.patientName}
                {obsModalMed.patientBed ? ` (Leito ${obsModalMed.patientBed})` : ""}
              </p>
              <p>
                <strong>Horário:</strong> {obsModalMed.schedule}
              </p>
            </div>

            {/* Toggle Administered Status */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 mb-3">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Status de Administração:
              </span>
              <button
                type="button"
                onClick={() => setObsAdministered(!obsAdministered)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  obsAdministered
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-400"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
                }`}
              >
                <CheckCircle2 size={14} />
                {obsAdministered ? "Administrado" : "Pendente"}
              </button>
            </div>

            {/* Clinical Notes */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observação Clínica / Ocorrência
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Administrado por via oral sem queixas. Paciente consciente e orientado."
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                className="w-full py-2 px-3 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />

              {/* Quick tags */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  "VO sem intercorrências",
                  "EV em BIC",
                  "Via SNE/SNG",
                  "Aceitou bem",
                  "Recusado pelo paciente",
                  "Paciente em jejum",
                  "Dose suspensa pelo médico",
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setObsText((prev) => (prev ? `${prev} - ${tag}` : tag))}
                    className="px-2 py-1 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setObsModalMed(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveObs}
                disabled={savingObs}
                className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-colors shadow-xs min-h-[40px] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {savingObs ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar Checagem
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Bloqueio por Alergia / Quadro Clínico */}
      {allergyBlockModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-3xl border-2 border-rose-500 max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert size={32} />
            </div>
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                Bloqueio de Segurança do Paciente
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Medicação Bloqueada por Alergia
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                O cadastro da medicação <strong>&quot;{allergyBlockModal.medName}&quot;</strong> foi bloqueado pelo sistema porque colide diretamente com o histórico de alergia do paciente:
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-1">
              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                Paciente: {allergyBlockModal.patientName}
              </div>
              <div className="text-xs text-rose-700 dark:text-rose-200">
                ⚠️ Alergia Registrada: <strong>{allergyBlockModal.matchedTerm}</strong>
              </div>
              {allergyBlockModal.rawAllergy && (
                <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 italic">
                  Quadro Clínico / Alergias: {allergyBlockModal.rawAllergy}
                </div>
              )}
            </div>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              Administrar este fármaco pode causar choque anafilático ou reações adversas graves.
            </p>

            <button
              type="button"
              onClick={() => setAllergyBlockModal(null)}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-98"
            >
              Entendido, fechar aviso
            </button>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Administrações */}
      {historyModalMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Histórico de Administrações
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {historyModalMed.name} ({historyModalMed.dose}) — {historyModalMed.patientBed ? `Leito ${historyModalMed.patientBed} · ` : ""}{historyModalMed.patientName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalMed(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5">
              {historyLoading ? (
                <div className="space-y-2 py-4">
                  <div className="h-12 rounded-xl skeleton-shimmer" />
                  <div className="h-12 rounded-xl skeleton-shimmer" />
                </div>
              ) : adminHistory.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <Clock size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Nenhum registro de administração encontrado para esta medicação.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    As doses administradas serão registradas aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminHistory.map((item) => (
                    <div key={item.id} className="py-2.5 px-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 my-1 space-y-1">
                      <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                            <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                            Previsto: {item.scheduledTime || "Horário da prescrição"}
                          </span>
                          {item.earlyAdministration && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-800">
                              <Clock size={10} /> Antecipada
                            </span>
                          )}
                          {item.duplicateOverride && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 text-[10px] font-bold border border-rose-300 dark:border-rose-800">
                              <AlertTriangle size={10} /> Dose Duplicada / Extra
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {new Date(item.administeredAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {item.observation && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 italic pt-0.5">
                          <strong>Obs:</strong> {item.observation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalMed(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 min-h-[38px]"
              >
                Fechar
              </button>
            </div>
          </div>
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
                <span className="text-slate-500 dark:text-slate-400 font-medium">Horário / Intervalo:</span>
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
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[42px] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMedication}
                disabled={deletingMed}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-xs min-h-[42px] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
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
