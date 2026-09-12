"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HeartPulse, Plus, Search, AlertTriangle, CheckCircle2,
  Activity, ArrowLeft, Bed, Clock, ChevronRight, X,
  RefreshCw, AlertCircle, Mic, Check,
  ChevronDown, ChevronUp, Eye, EyeOff
} from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { parseVitalSignsVoiceInput, parseSingleVitalValue } from "@/lib/clinical-voice-parser";
import {
  listPatients,
  listVitalSigns,
  createVitalSign,
  type Patient,
  type VitalSign,
} from "@/lib/localdb";
import { VITAL_SIGN_TYPES, type VitalSignType } from "@/types";
import { getValueStatus, getBpStatus, VITAL_RANGES, type VitalStatus } from "@/lib/vital-ranges";

interface PatientWithVitals extends Patient {
  latestVitals: Map<string, VitalSign>;
  overallVitalStatus: VitalStatus | "sem_dados";
  criticalCount: number;
  attentionCount: number;
}

interface VitalWithPatient extends VitalSign {
  patientName: string;
  patientBed: string;
  status: VitalStatus;
}

export default function VitalsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientWithVitals[]>([]);
  const [recentVitals, setRecentVitals] = useState<VitalWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "critico" | "atencao" | "normal" | "sem_dados">("all");
  // Controle de expansão dos quadros de aferição (por padrão todos ficam ocultados)
  const [expandedPatientIds, setExpandedPatientIds] = useState<Set<string>>(new Set());

  // Visualizar aferição selecionada da timeline
  const [viewingVital, setViewingVital] = useState<VitalWithPatient | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [vitalType, setVitalType] = useState<VitalSignType>("PRESSAO_ARTERIAL");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalSystolic, setVitalSystolic] = useState("");
  const [vitalDiastolic, setVitalDiastolic] = useState("");
  const [vitalDate, setVitalDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [vitalError, setVitalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Voz / Microfone para Sinais Vitais no Modal
  const [isModalVoiceActive, setIsModalVoiceActive] = useState(false);
  const [activeModalFieldVoice, setActiveModalFieldVoice] = useState<"value" | "pressure" | null>(null);
  const [modalVoiceMessage, setModalVoiceMessage] = useState<string | null>(null);

  const modalFullSpeech = useSpeechRecognition({ continuous: true, interimResults: true });
  const modalFieldSpeech = useSpeechRecognition({ continuous: false, interimResults: true });

  const liveModalTranscript = (modalFullSpeech.transcript + " " + modalFullSpeech.interimTranscript).trim();
  const liveModalParsed = parseVitalSignsVoiceInput(liveModalTranscript, vitalType);

  const toggleModalFullVoice = () => {
    if (isModalVoiceActive) {
      modalFullSpeech.stopListening();
      setIsModalVoiceActive(false);
    } else {
      setIsModalVoiceActive(true);
      modalFullSpeech.resetTranscript();
      modalFullSpeech.startListening();
    }
  };

  const handleApplyModalVoice = (item: {
    type: VitalSignType;
    label: string;
    value?: number;
    systolic?: number;
    diastolic?: number;
    unit: string;
  }) => {
    modalFullSpeech.stopListening();
    setVitalType(item.type);
    if (item.type === "PRESSAO_ARTERIAL" && item.systolic != null && item.diastolic != null) {
      setVitalSystolic(String(item.systolic));
      setVitalDiastolic(String(item.diastolic));
      setVitalValue("");
    } else if (item.value != null) {
      setVitalValue(String(item.value));
      setVitalSystolic("");
      setVitalDiastolic("");
    }
    setIsModalVoiceActive(false);
    setModalVoiceMessage(
      item.type === "PRESSAO_ARTERIAL"
        ? `PA ${item.systolic}/${item.diastolic} mmHg preenchida!`
        : `${item.label} ${item.value} ${item.unit} preenchido!`
    );
    setTimeout(() => setModalVoiceMessage(null), 3000);
  };

  const toggleModalFieldVoice = (field: "value" | "pressure") => {
    if (activeModalFieldVoice === field) {
      modalFieldSpeech.stopListening();
      setActiveModalFieldVoice(null);
      return;
    }
    setActiveModalFieldVoice(field);
    modalFieldSpeech.resetTranscript();
    modalFieldSpeech.startListening({
      onFinalText: (spokenText) => {
        const text = spokenText.trim();
        if (field === "pressure") {
          const parsed = parseSingleVitalValue("PRESSAO_ARTERIAL", text);
          if (parsed && parsed.systolic && parsed.diastolic) {
            setVitalSystolic(String(parsed.systolic));
            setVitalDiastolic(String(parsed.diastolic));
            setModalVoiceMessage(`PA ${parsed.systolic}/${parsed.diastolic} mmHg preenchida!`);
            setTimeout(() => setModalVoiceMessage(null), 3000);
          }
        } else if (field === "value") {
          const parsed = parseSingleVitalValue(vitalType, text);
          if (parsed && parsed.value !== undefined) {
            setVitalValue(String(parsed.value));
            const vt = VITAL_SIGN_TYPES.find((v) => v.value === vitalType);
            setModalVoiceMessage(`${vt?.label || "Valor"} ${parsed.value} ${vt?.unit || ""} preenchido!`);
            setTimeout(() => setModalVoiceMessage(null), 3000);
          }
        }
        setActiveModalFieldVoice(null);
      },
    });
  };

  useEffect(() => {
    if (!modalOpen) {
      modalFullSpeech.stopListening();
      modalFieldSpeech.stopListening();
      setIsModalVoiceActive(false);
      setActiveModalFieldVoice(null);
    }
  }, [modalOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Carregar pacientes internados
      const rawPatients = await listPatients({ status: "active" });
      // 2. Carregar todos os sinais vitais
      const allVitals = await listVitalSigns();

      // Mapear sinais vitais mais recentes por paciente
      const vitalsByPatient = new Map<string, VitalSign[]>();
      allVitals.forEach((v) => {
        const list = vitalsByPatient.get(v.patientId) || [];
        list.push(v);
        vitalsByPatient.set(v.patientId, list);
      });

      const patientMap = new Map<string, Patient>();
      rawPatients.forEach((p) => patientMap.set(p.id, p));

      const processedPatients: PatientWithVitals[] = rawPatients.map((p) => {
        const pVitals = vitalsByPatient.get(p.id) || [];
        const latestMap = new Map<string, VitalSign>();

        pVitals.forEach((v) => {
          if (!latestMap.has(v.type)) {
            latestMap.set(v.type, v);
          }
        });

        let criticalCount = 0;
        let attentionCount = 0;
        let normalCount = 0;

        VITAL_SIGN_TYPES.forEach((vt) => {
          const v = latestMap.get(vt.value);
          if (v) {
            let s: VitalStatus = "normal";
            if (vt.value === "PRESSAO_ARTERIAL" && v.systolic != null) {
              s = getBpStatus(v.systolic, v.diastolic ?? 0);
            } else {
              s = getValueStatus(vt.value, v.value);
            }
            if (s === "critico") criticalCount++;
            else if (s === "atencao") attentionCount++;
            else normalCount++;
          }
        });

        let overall: VitalStatus | "sem_dados" = "sem_dados";
        if (latestMap.size === 0) {
          overall = "sem_dados";
        } else if (criticalCount > 0) {
          overall = "critico";
        } else if (attentionCount > 0) {
          overall = "atencao";
        } else if (normalCount > 0) {
          overall = "normal";
        }

        return {
          ...p,
          latestVitals: latestMap,
          overallVitalStatus: overall,
          criticalCount,
          attentionCount,
        };
      });

      // Últimos 5 registros mais recentes de sinais vitais com dados do paciente
      const processedRecent: VitalWithPatient[] = allVitals.slice(0, 5).map((v) => {
        const p = patientMap.get(v.patientId);
        let s: VitalStatus = "normal";
        if (v.type === "PRESSAO_ARTERIAL" && v.systolic != null) {
          s = getBpStatus(v.systolic, v.diastolic ?? 0);
        } else {
          s = getValueStatus(v.type, v.value);
        }
        return {
          ...v,
          patientName: p?.name || "Paciente",
          patientBed: p?.bed || "—",
          status: s,
        };
      });

      setPatients(processedPatients);
      setRecentVitals(processedRecent);
    } catch (err) {
      console.error("Erro ao carregar dados de sinais vitais:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Abrir modal para paciente específico
  const openAddModal = (patientId?: string, initialType?: VitalSignType) => {
    setSelectedPatientId(patientId || (patients.length > 0 ? patients[0].id : ""));
    setVitalType(initialType || "PRESSAO_ARTERIAL");
    setVitalValue("");
    setVitalSystolic("");
    setVitalDiastolic("");
    setVitalDate(new Date().toISOString().slice(0, 16));
    setVitalError("");
    setModalOpen(true);
  };

  // Preview de classificação do valor digitado
  const liveStatusPreview = useMemo(() => {
    if (vitalType === "PRESSAO_ARTERIAL") {
      const sys = parseInt(vitalSystolic);
      const dia = parseInt(vitalDiastolic);
      if (!isNaN(sys) && !isNaN(dia) && sys > 0 && dia > 0) {
        return getBpStatus(sys, dia);
      }
      return null;
    } else {
      const val = parseFloat(vitalValue);
      if (!isNaN(val)) {
        return getValueStatus(vitalType, val);
      }
      return null;
    }
  }, [vitalType, vitalValue, vitalSystolic, vitalDiastolic]);

  const handleSaveVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setVitalError("Selecione um paciente");
      return;
    }

    if (vitalType === "PRESSAO_ARTERIAL") {
      if (!vitalSystolic || !vitalDiastolic) {
        setVitalError("Informe a pressão sistólica e diastólica");
        return;
      }
    } else if (!vitalValue) {
      setVitalError("Informe o valor do sinal vital");
      return;
    }

    setSubmitting(true);
    setVitalError("");

    try {
      const vt = VITAL_SIGN_TYPES.find((v) => v.value === vitalType);
      const val =
        vitalType === "PRESSAO_ARTERIAL"
          ? (parseInt(vitalSystolic) + parseInt(vitalDiastolic)) / 2
          : parseFloat(vitalValue);

      await createVitalSign({
        patientId: selectedPatientId,
        type: vitalType,
        value: val,
        systolic: vitalType === "PRESSAO_ARTERIAL" ? parseInt(vitalSystolic) : null,
        diastolic: vitalType === "PRESSAO_ARTERIAL" ? parseInt(vitalDiastolic) : null,
        unit: vt?.unit || "",
        recordedAt: vitalDate,
      });

      setModalOpen(false);
      await loadData();
    } catch (err) {
      console.error("Erro ao salvar sinal vital:", err);
      setVitalError("Falha ao registrar sinal vital");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtros
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.bed && p.bed.toLowerCase().includes(search.toLowerCase())) ||
        (p.diagnosis && p.diagnosis.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      if (filter === "critico") return p.overallVitalStatus === "critico";
      if (filter === "atencao") return p.overallVitalStatus === "atencao";
      if (filter === "normal") return p.overallVitalStatus === "normal";
      if (filter === "sem_dados") return p.overallVitalStatus === "sem_dados";

      return true;
    });
  }, [patients, search, filter]);

  // Contadores
  const countTotal = patients.length;
  const countCriticos = patients.filter((p) => p.overallVitalStatus === "critico").length;
  const countAtencao = patients.filter((p) => p.overallVitalStatus === "atencao").length;
  const countNormais = patients.filter((p) => p.overallVitalStatus === "normal").length;
  const countSemDados = patients.filter((p) => p.overallVitalStatus === "sem_dados").length;

  // Lógica de Ocultar / Desocultar Todos os Quadros de Aferição
  const areAllExpanded = useMemo(() => {
    if (filteredPatients.length === 0) return false;
    return filteredPatients.every((p) => expandedPatientIds.has(p.id));
  }, [filteredPatients, expandedPatientIds]);

  const toggleAllVitals = () => {
    if (areAllExpanded) {
      setExpandedPatientIds(new Set());
    } else {
      setExpandedPatientIds(new Set(patients.map((p) => p.id)));
    }
  };

  const togglePatientVitals = (patientId: string) => {
    setExpandedPatientIds((prev) => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center shadow-xs">
                <HeartPulse size={18} />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Sinais Vitais
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Monitoramento multiparamétrico da enfermaria • Toque em qualquer sinal vital para aferir
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Atualizar dados"
            aria-label="Atualizar dados"
          >
            <RefreshCw size={17} className={loading ? "animate-spin text-teal-600" : ""} />
          </button>
          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs min-h-[42px]"
          >
            <Plus size={17} />
            Aferir Sinal Vital
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Leitos Monitorados */}
        <div className="bg-white dark:bg-[#111927] rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Leitos Ativos</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Bed size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{countTotal}</span>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Em observação direta</p>
          </div>
        </div>

        {/* Em Alerta / Críticos */}
        <div
          onClick={() => setFilter(filter === "critico" ? "all" : "critico")}
          className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
            countCriticos > 0
              ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60"
              : "bg-white dark:bg-[#111927] border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 dark:text-rose-300">Alerta Crítico</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${countCriticos > 0 ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300">{countCriticos}</span>
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">Requer intervenção</p>
          </div>
        </div>

        {/* Atenção */}
        <div
          onClick={() => setFilter(filter === "atencao" ? "all" : "atencao")}
          className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
            countAtencao > 0
              ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60"
              : "bg-white dark:bg-[#111927] border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Sob Atenção</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${countAtencao > 0 ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
              <Activity size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">{countAtencao}</span>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Parâmetro alterado</p>
          </div>
        </div>

        {/* Estáveis */}
        <div
          onClick={() => setFilter(filter === "normal" ? "all" : "normal")}
          className={`cursor-pointer rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
            filter === "normal"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              : "bg-white dark:bg-[#111927] border-slate-200 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Estáveis</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">{countNormais}</span>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Sinais dentro da meta</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente ou leito..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "all"
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Todos ({countTotal})
          </button>
          <button
            onClick={() => setFilter("critico")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
              filter === "critico"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Críticos ({countCriticos})
          </button>
          <button
            onClick={() => setFilter("atencao")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
              filter === "atencao"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Atenção ({countAtencao})
          </button>
          <button
            onClick={() => setFilter("normal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
              filter === "normal"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Estáveis ({countNormais})
          </button>
          <button
            onClick={() => setFilter("sem_dados")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === "sem_dados"
                ? "bg-slate-700 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Sem Aferição ({countSemDados})
          </button>
        </div>
      </div>

      {/* Barra de controle da lista: Contagem e Botão Ocultar/Desocultar Todos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Leitos da Enfermaria
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
            {filteredPatients.length} {filteredPatients.length === 1 ? "leito" : "leitos"}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleAllVitals}
          disabled={filteredPatients.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs self-start sm:self-auto disabled:opacity-50"
          title={areAllExpanded ? "Ocultar quadros de aferição de todos os pacientes" : "Desocultar quadros de aferição de todos os pacientes"}
        >
          {areAllExpanded ? (
            <>
              <EyeOff size={14} className="text-slate-500" />
              <span>Ocultar Todas as Aferições</span>
            </>
          ) : (
            <>
              <Eye size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Desocultar Todas as Aferições</span>
            </>
          )}
        </button>
      </div>

      {/* Patient Ward Monitor List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
            <RefreshCw size={24} className="animate-spin text-teal-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Carregando dados fisiológicos da unidade...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
            <HeartPulse size={36} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Nenhum leito encontrado</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Ajuste os filtros de busca ou cadastre novas aferições.
            </p>
          </div>
        ) : (
          filteredPatients.map((p) => {
            const isExpanded = expandedPatientIds.has(p.id);

            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-[#111927] rounded-2xl border transition-all duration-150 p-4 sm:p-5 ${
                  p.overallVitalStatus === "critico"
                    ? "border-rose-300 dark:border-rose-900/80 shadow-xs"
                    : p.overallVitalStatus === "atencao"
                    ? "border-amber-300 dark:border-amber-900/80 shadow-xs"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Header row for patient */}
                <div
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isExpanded ? "pb-3 border-b border-slate-100 dark:border-slate-800/80" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Bed tag */}
                    <div className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-center shrink-0">
                      <span className="block text-[9px] font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wider">Leito</span>
                      <span className="text-xs font-bold font-mono text-teal-900 dark:text-teal-200">{p.bed || "—"}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/patient?id=${p.id}&tab=sinais`}
                          className="font-bold text-slate-900 dark:text-white text-sm hover:text-teal-600 transition-colors truncate"
                        >
                          {p.name}
                        </Link>
                        {p.condition && (
                          <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {p.condition}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {p.diagnosis || "Sem diagnóstico informado"}
                        {!isExpanded && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1.5">
                            • {p.latestVitals.size > 0 ? `${p.latestVitals.size}/7 aferições registradas` : "Nenhum sinal registrado"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        p.overallVitalStatus === "critico"
                          ? "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                          : p.overallVitalStatus === "atencao"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                          : p.overallVitalStatus === "normal"
                          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.overallVitalStatus === "critico"
                            ? "bg-rose-600 animate-pulse"
                            : p.overallVitalStatus === "atencao"
                            ? "bg-amber-500"
                            : p.overallVitalStatus === "normal"
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        }`}
                      />
                      {p.overallVitalStatus === "critico"
                        ? "Parâmetro Crítico"
                        : p.overallVitalStatus === "atencao"
                        ? "Parâmetro Alterado"
                        : p.overallVitalStatus === "normal"
                        ? "Parâmetros Estáveis"
                        : "Aguardando Aferição"}
                    </span>

                    <button
                      onClick={() => openAddModal(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Plus size={14} />
                      Aferir
                    </button>

                    <Link
                      href={`/patient?id=${p.id}&tab=sinais`}
                      className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 transition-colors"
                      title="Ver prontuário e histórico gráfico"
                    >
                      <ChevronRight size={16} />
                    </Link>

                    {/* Botão individual para Ocultar / Desocultar quadros de aferição */}
                    <button
                      type="button"
                      onClick={() => togglePatientVitals(p.id)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
                        isExpanded
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                          : "bg-teal-50/70 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200/80 dark:border-teal-800/60 hover:bg-teal-100/60"
                      }`}
                      title={isExpanded ? "Ocultar quadros de aferição deste paciente" : "Desocultar quadros de aferição deste paciente"}
                      aria-label={isExpanded ? "Ocultar quadros de aferição deste paciente" : "Desocultar quadros de aferição deste paciente"}
                    >
                      <span className="hidden sm:inline text-[11px]">
                        {isExpanded ? "Ocultar" : "Aferições"}
                      </span>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                  </div>
                </div>

                {/* Multiparameter Strip (visível apenas quando expandido) */}
                {isExpanded && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-3 animate-fade-in">
                    {VITAL_SIGN_TYPES.map((vt) => {
                      const latest = p.latestVitals.get(vt.value);
                      let valDisplay = "—";
                      let statusLabel = "Sem dado";
                      let statusCls = "text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800";
                      let dotCls = "bg-slate-300 dark:bg-slate-600";

                      if (latest) {
                        let s: VitalStatus = "normal";
                        if (vt.value === "PRESSAO_ARTERIAL" && latest.systolic != null) {
                          valDisplay = `${latest.systolic}/${latest.diastolic}`;
                          s = getBpStatus(latest.systolic, latest.diastolic ?? 0);
                        } else {
                          valDisplay = `${latest.value}`;
                          s = getValueStatus(vt.value, latest.value);
                        }

                        if (s === "critico") {
                          statusLabel = "Crítico";
                          statusCls = "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border-rose-200 dark:border-rose-800";
                          dotCls = "bg-rose-600 animate-pulse";
                        } else if (s === "atencao") {
                          statusLabel = "Atenção";
                          statusCls = "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border-amber-200 dark:border-amber-800";
                          dotCls = "bg-amber-500";
                        } else {
                          statusLabel = "Normal";
                          statusCls = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800";
                          dotCls = "bg-emerald-500";
                        }
                      }

                      return (
                        <div
                          key={vt.value}
                          role="button"
                          tabIndex={0}
                          onClick={() => openAddModal(p.id, vt.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openAddModal(p.id, vt.value);
                            }
                          }}
                          title={`Toque para aferir ${vt.label} (${p.name})`}
                          aria-label={`Aferir ${vt.label} para ${p.name}`}
                          className="bg-slate-50/80 dark:bg-slate-800/50 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 active:bg-teal-100/50 dark:active:bg-teal-900/40 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/60 hover:border-teal-400 dark:hover:border-teal-500 flex flex-col justify-between cursor-pointer active:scale-[0.97] transition-all select-none group/vcard"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 group-hover/vcard:text-teal-700 dark:group-hover/vcard:text-teal-300 transition-colors truncate">
                              {vt.label.replace("Frequência ", "Freq. ")}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <Plus size={12} className="text-teal-600 dark:text-teal-400 opacity-60 sm:opacity-0 group-hover/vcard:opacity-100 transition-opacity" />
                              <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
                            </div>
                          </div>

                          <div className="my-1 flex items-baseline gap-1">
                            <span className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                              {valDisplay}
                            </span>
                            {latest && (
                              <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                                {vt.unit}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-700/40">
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${statusCls}`}>
                              {statusLabel}
                            </span>
                            {latest ? (
                              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                {new Date(latest.recordedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 opacity-90 sm:opacity-0 group-hover/vcard:opacity-100 transition-opacity">
                                + Aferir
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Recent Measurements Timeline */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock size={17} className="text-teal-600 dark:text-teal-400" />
            <h2 className="font-bold text-slate-900 dark:text-white text-sm">
              Últimas Aferições Registradas no Plantão
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {recentVitals.length} registro(s)
          </span>
        </div>

        {recentVitals.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
            Nenhuma aferição registrada ainda hoje.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentVitals.map((item) => {
              const vt = VITAL_SIGN_TYPES.find((t) => t.value === item.type);
              const valDisplay =
                item.type === "PRESSAO_ARTERIAL" && item.systolic != null
                  ? `${item.systolic}/${item.diastolic} mmHg`
                  : `${item.value} ${item.unit}`;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewingVital(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setViewingVital(item);
                    }
                  }}
                  className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-all cursor-pointer active:scale-[0.99] group/recent select-none"
                  title="Toque para visualizar detalhes desta aferição"
                  aria-label={`Visualizar aferição de ${item.patientName}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white shrink-0 group-hover/recent:bg-teal-50 dark:group-hover/recent:bg-teal-950/40 group-hover/recent:text-teal-700 dark:group-hover/recent:text-teal-300 transition-colors">
                      {new Date(item.recordedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover/recent:text-teal-700 dark:group-hover/recent:text-teal-400 transition-colors">
                          {item.patientName}
                        </p>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Leito {item.patientBed}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {vt?.label || item.type}: <strong className="text-slate-800 dark:text-slate-200">{valDisplay}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        item.status === "critico"
                          ? "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
                          : item.status === "atencao"
                          ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800"
                          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === "critico"
                            ? "bg-rose-600 animate-pulse"
                            : item.status === "atencao"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      {item.status === "critico" ? "Crítico" : item.status === "atencao" ? "Atenção" : "Normal"}
                    </span>
                    <ChevronRight size={15} className="text-slate-400 dark:text-slate-500 group-hover/recent:text-teal-600 dark:group-hover/recent:text-teal-400 group-hover/recent:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Quick Form for Aferição */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HeartPulse size={18} className="text-teal-600 dark:text-teal-400" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Registrar {VITAL_SIGN_TYPES.find((v) => v.value === vitalType)?.label || "Sinal Vital"}
                  </h3>
                  {selectedPatientId && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {(() => {
                        const pt = patients.find((p) => p.id === selectedPatientId);
                        return pt ? `${pt.name} (Leito ${pt.bed || "—"})` : "";
                      })()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleModalFullVoice}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                    isModalVoiceActive
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                  }`}
                  title="Ditar sinal vital por voz"
                >
                  <Mic size={13} className={isModalVoiceActive ? "animate-bounce" : ""} />
                  {isModalVoiceActive ? "Ouvindo..." : "Ditar por Voz"}
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sucesso Voz */}
            {modalVoiceMessage && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>{modalVoiceMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalVoiceMessage(null)}
                  className="text-emerald-700 dark:text-emerald-400 p-0.5"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Painel de Voz no Modal */}
            {isModalVoiceActive && (
              <div className="mt-3 p-3.5 rounded-2xl bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-2 animate-fade-in shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span>{modalFullSpeech.isListening ? "Ouvindo sinal vital..." : "Microfone pausado"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      modalFullSpeech.stopListening();
                      setIsModalVoiceActive(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Fechar
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                  Ex: &quot;Temperatura 36 e meio&quot;, &quot;Pressão 12 por 8&quot;, &quot;Saturação 98%&quot;, &quot;Dor 3&quot;
                </p>

                {liveModalTranscript && (
                  <div className="p-2 bg-white dark:bg-slate-900/80 rounded-xl border border-teal-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono">
                    &quot;{liveModalTranscript}&quot;
                  </div>
                )}

                {liveModalParsed.detectedVitals.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {liveModalParsed.detectedVitals.map((item, idx) => {
                      const displayVal =
                        item.type === "PRESSAO_ARTERIAL"
                          ? `${item.systolic}/${item.diastolic} mmHg`
                          : `${item.value} ${item.unit}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplyModalVoice(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                        >
                          <Check size={12} />
                          <span>{item.label}: {displayVal}</span>
                          <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded ml-1">Aplicar</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            {vitalError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={15} />
                {vitalError}
              </div>
            )}

            <form onSubmit={handleSaveVital} className="mt-4 space-y-4">
              {/* Paciente */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paciente e Leito
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                  required
                >
                  <option value="">Selecione o paciente...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      Leito {p.bed || "—"} - {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de Sinal Vital */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Parâmetro a Aferir
                </label>
                <select
                  value={vitalType}
                  onChange={(e) => setVitalType(e.target.value as VitalSignType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                >
                  {VITAL_SIGN_TYPES.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label} ({v.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Valores de medição */}
              {vitalType === "PRESSAO_ARTERIAL" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pressão Arterial (mmHg)
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleModalFieldVoice("pressure")}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                        activeModalFieldVoice === "pressure"
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-200 dark:border-teal-800"
                      }`}
                      title="Ditar PA por voz (ex: 12 por 8)"
                    >
                      <Mic size={12} className={activeModalFieldVoice === "pressure" ? "animate-bounce" : ""} />
                      {activeModalFieldVoice === "pressure" ? "Ouvindo PA..." : "Ditar PA (ex: 12 por 8)"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Sistólica</label>
                      <input
                        type="number"
                        autoFocus
                        value={vitalSystolic}
                        onChange={(e) => setVitalSystolic(e.target.value)}
                        placeholder="Ex: 120"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Diastólica</label>
                      <input
                        type="number"
                        value={vitalDiastolic}
                        onChange={(e) => setVitalDiastolic(e.target.value)}
                        placeholder="Ex: 80"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Valor ({VITAL_SIGN_TYPES.find((t) => t.value === vitalType)?.unit})
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleModalFieldVoice("value")}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                        activeModalFieldVoice === "value"
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-200 dark:border-teal-800"
                      }`}
                      title="Ditar valor por voz"
                    >
                      <Mic size={12} className={activeModalFieldVoice === "value" ? "animate-bounce" : ""} />
                      {activeModalFieldVoice === "value" ? "Ouvindo..." : "Ditar"}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    autoFocus
                    value={vitalValue}
                    onChange={(e) => setVitalValue(e.target.value)}
                    placeholder={
                      vitalType === "TEMPERATURA"
                        ? "Ex: 36.5"
                        : vitalType === "GLICEMIA"
                        ? "Ex: 110"
                        : vitalType === "SATURACAO_O2"
                        ? "Ex: 98"
                        : vitalType === "ESCALA_DE_DOR"
                        ? "0 a 10"
                        : "Ex: 75"
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                    required
                  />
                </div>
              )}

              {/* Live Status Feedback Banner */}
              {liveStatusPreview && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                    liveStatusPreview === "critico"
                      ? "bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
                      : liveStatusPreview === "atencao"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                      : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        liveStatusPreview === "critico"
                          ? "bg-rose-600 animate-pulse"
                          : liveStatusPreview === "atencao"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span>Classificação Clínica:</span>
                  </div>
                  <span className="uppercase tracking-wider text-[11px] font-bold">
                    {liveStatusPreview === "critico"
                      ? "Crítico"
                      : liveStatusPreview === "atencao"
                      ? "Atenção"
                      : "Normal"}
                  </span>
                </div>
              )}

              {/* Data e Horário */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data e Horário da Aferição
                </label>
                <input
                  type="datetime-local"
                  value={vitalDate}
                  onChange={(e) => setVitalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500/50"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Confirmar Aferição
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Detalhes da Aferição */}
      {viewingVital && (() => {
        const vt = VITAL_SIGN_TYPES.find((t) => t.value === viewingVital.type);
        const valDisplay =
          viewingVital.type === "PRESSAO_ARTERIAL" && viewingVital.systolic != null
            ? `${viewingVital.systolic}/${viewingVital.diastolic}`
            : `${viewingVital.value}`;

        const isCritico = viewingVital.status === "critico";
        const isAtencao = viewingVital.status === "atencao";

        const range = VITAL_RANGES[viewingVital.type];

        let refNormal = "—";
        let refCritico = "—";

        if (viewingVital.type === "PRESSAO_ARTERIAL") {
          refNormal = "90/60 a 140/90 mmHg";
          refCritico = "< 80/50 ou > 180/110 mmHg";
        } else if (viewingVital.type === "SATURACAO_O2") {
          refNormal = "95% a 100%";
          refCritico = "< 90%";
        } else if (range) {
          refNormal = `${range.minNormal} a ${range.maxNormal} ${vt?.unit || ""}`;
          refCritico = `< ${range.minCritical} ou > ${range.maxCritical} ${vt?.unit || ""}`;
        }

        const dateObj = new Date(viewingVital.recordedAt);
        const formattedDate = dateObj.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const formattedTime = dateObj.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative space-y-4 animate-scale-in">
              {/* Header do Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isCritico
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                        : isAtencao
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                        : "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400"
                    }`}
                  >
                    <HeartPulse size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      Visualizar Aferição
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Sinal Vital Registrado
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingVital(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Card do Paciente */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Paciente / Leito
                  </span>
                  <Link
                    href={`/patient?id=${viewingVital.patientId}`}
                    className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-0.5"
                  >
                    Prontuário Completo
                    <ChevronRight size={13} />
                  </Link>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {viewingVital.patientName}
                  </p>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shrink-0">
                    Leito {viewingVital.patientBed}
                  </span>
                </div>
              </div>

              {/* Destaque do Valor e Status */}
              <div
                className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${
                  isCritico
                    ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/50"
                    : isAtencao
                    ? "bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/50"
                    : "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/50"
                }`}
              >
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {vt?.label || viewingVital.type}
                </span>

                <div className="flex items-baseline justify-center gap-1.5 my-1">
                  <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {valDisplay}
                  </span>
                  <span className="text-sm font-semibold font-mono text-slate-500 dark:text-slate-400">
                    {viewingVital.unit || vt?.unit}
                  </span>
                </div>

                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      isCritico
                        ? "bg-rose-600 text-white shadow-xs"
                        : isAtencao
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-emerald-600 text-white shadow-xs"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Status: {isCritico ? "Crítico" : isAtencao ? "Atenção" : "Normal"}
                  </span>
                </div>
              </div>

              {/* Informações Clínicas / Referências */}
              <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                    <Clock size={13} className="text-slate-400" />
                    Registrado em:
                  </span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {formattedDate} às {formattedTime}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/50 dark:border-slate-700/40">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Faixa Normal:
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    {refNormal}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    Faixa Crítica:
                  </span>
                  <span className="font-mono text-rose-700 dark:text-rose-400 font-semibold">
                    {refCritico}
                  </span>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const pId = viewingVital.patientId;
                    const vType = viewingVital.type;
                    setViewingVital(null);
                    openAddModal(pId, vType);
                  }}
                  className="px-3.5 py-2.5 rounded-xl border border-teal-200 dark:border-teal-800/80 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors min-h-[40px] inline-flex items-center gap-1.5 cursor-pointer"
                  title="Registrar nova medição para este paciente"
                >
                  <Plus size={14} />
                  Nova Aferição
                </button>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewingVital(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px] cursor-pointer"
                  >
                    Fechar
                  </button>
                  <Link
                    href={`/patient?id=${viewingVital.patientId}`}
                    className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-xs font-bold transition-all shadow-xs min-h-[40px] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    Prontuário
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
