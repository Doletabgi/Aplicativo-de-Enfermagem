"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Save,
  CheckCheck,
  X,
  Edit3,
  AlertCircle,
  ExternalLink,
  Activity,
  Pill,
} from "lucide-react";
import {
  listPatients,
  getPatientStatus,
  Patient,
  getNursingReport,
  createNursingNote,
  listVitalSigns,
  listMedications,
} from "@/lib/localdb";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { VITAL_SIGN_TYPES } from "@/types";

interface PatientWithStatus extends Patient {
  status?: string;
}

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string | null;
}

export function ShiftReportModal({ isOpen, onClose, initialPatientId }: ShiftReportModalProps) {
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");

  const [vitalsCount, setVitalsCount] = useState<number>(0);
  const [medsCount, setMedsCount] = useState<number>(0);

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedReport, setEditedReport] = useState("");

  const [copied, setCopied] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega lista de pacientes internados ativos
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function load() {
      setLoadingPatients(true);
      try {
        const raw = await listPatients();
        const active = raw.filter((p) => p.active);
        const withStatus = await Promise.all(
          active.map(async (p) => {
            const status = await getPatientStatus(p.id);
            return { ...p, status };
          })
        );

        if (!isMounted) return;
        setPatients(withStatus);

        if (initialPatientId && withStatus.some((p) => p.id === initialPatientId)) {
          setSelectedPatientId(initialPatientId);
        } else if (withStatus.length > 0 && !selectedPatientId) {
          setSelectedPatientId(withStatus[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar pacientes no modal de relatório:", err);
      } finally {
        if (isMounted) setLoadingPatients(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialPatientId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Atualiza diagnóstico e métricas clínicas quando o paciente selecionado muda
  useEffect(() => {
    if (!selectedPatientId) return;

    let isMounted = true;
    if (selectedPatient) {
      setDiagnosis(selectedPatient.diagnosis || "");
      setReport(null);
      setEditedReport("");
      setIsEditingReport(false);
      setErrorMsg(null);
      setSavedNote(false);
    }

    async function loadClinicalContext() {
      try {
        const [vitals, meds] = await Promise.all([
          listVitalSigns({ patientId: selectedPatientId }),
          listMedications({ patientId: selectedPatientId }),
        ]);
        if (!isMounted) return;
        setVitalsCount(vitals.length);
        setMedsCount(meds.length);
      } catch (err) {
        console.warn("Erro ao buscar contexto clínico:", err);
      }
    }

    loadClinicalContext();

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId, selectedPatient]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!diagnosis.trim()) {
      setErrorMsg("Por favor, informe ou confirme o diagnóstico do paciente.");
      return;
    }

    setGenerating(true);
    setErrorMsg(null);
    setCopied(false);
    setSavedNote(false);

    try {
      // Busca sinais vitais recentes e medicações ativas do paciente
      const [rawVitals, rawMeds] = await Promise.all([
        listVitalSigns({ patientId: selectedPatientId }),
        listMedications({ patientId: selectedPatientId }),
      ]);

      const formattedVitals = rawVitals.slice(0, 6).map((v) => {
        const vt = VITAL_SIGN_TYPES.find((t) => t.value === v.type);
        const value =
          v.type === "PRESSAO_ARTERIAL" && v.systolic != null
            ? `${v.systolic}/${v.diastolic} mmHg`
            : `${v.value} ${vt?.unit || ""}`;
        return { label: vt?.label || v.type, value };
      });

      const formattedMeds = rawMeds.map((m) => ({
        name: m.name,
        dose: m.dose,
        schedule: m.schedule,
      }));

      const reportText = await getNursingReport({
        diagnosis: diagnosis.trim(),
        patientName: selectedPatient?.name,
        gender: selectedPatient?.gender,
        age: selectedPatient?.birthDate ? calcAge(selectedPatient.birthDate) : undefined,
        vitalSigns: formattedVitals,
        medications: formattedMeds,
      });

      if (!reportText) {
        setErrorMsg("Não foi possível compilar o relatório. Tente novamente.");
      } else {
        setReport(reportText);
        setEditedReport(reportText);
        setIsEditingReport(false);
        try {
          sessionStorage.setItem(`ai_report_${selectedPatientId}`, reportText);
        } catch {}
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao compilar relatório clínico com IA.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    const textToCopy = isEditingReport ? editedReport : report;
    if (!textToCopy) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveAsNote = async () => {
    const contentToSave = (isEditingReport ? editedReport : report || "").trim();
    if (!contentToSave || !selectedPatient) return;

    setSavingNote(true);
    try {
      const header = `[RELATÓRIO DE PASSAGEM DE PLANTÃO - IA]\nDiagnóstico: ${diagnosis}\n`;
      const fullContent = contentToSave.startsWith("[RELATÓRIO") ? contentToSave : `${header}\n${contentToSave}`;

      await createNursingNote({
        patientId: selectedPatient.id,
        content: fullContent,
      });

      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 4000);
    } catch (err) {
      console.error("Erro ao salvar relatório como evolução:", err);
      setErrorMsg("Erro ao registrar no prontuário do paciente.");
    } finally {
      setSavingNote(false);
    }
  };

  function calcAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }

  const cfg = selectedPatient
    ? STATUS_CONFIG[selectedPatient.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <ClipboardList size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                  Relatório por IA
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  <Sparkles size={11} />
                  Passagem de Plantão
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Selecione o paciente e ajuste o diagnóstico para consolidar o relatório
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={19} />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 overflow-y-auto flex-1 pr-1 space-y-4">
          {loadingPatients ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw size={15} className="animate-spin text-teal-600" />
              Carregando pacientes internados...
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-10 glass-panel rounded-xl">
              <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhum paciente internado encontrado
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Cadastre ou reative um paciente no leito para gerar relatórios.
              </p>
            </div>
          ) : (
            <>
              {/* Seletor de Paciente */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Selecione o Paciente / Leito:
                </label>
                <div className="relative">
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.bed ? `Leito ${p.bed}` : "Sem leito"} — {p.name} {p.diagnosis ? `(${p.diagnosis})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card Resumo do Paciente Selecionado */}
              {selectedPatient && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="px-2.5 py-1 rounded-lg bg-teal-800 text-white font-mono font-bold text-xs text-center shrink-0">
                      <span className="block text-[8px] uppercase tracking-wider opacity-80">Leito</span>
                      {selectedPatient.bed || "—"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {selectedPatient.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {selectedPatient.birthDate ? `${calcAge(selectedPatient.birthDate)} anos` : "Idade N/I"} · {selectedPatient.gender === "M" ? "Masculino" : selectedPatient.gender === "F" ? "Feminino" : "Gênero N/I"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                      <Activity size={10} className="text-teal-600" />
                      {vitalsCount} sinais
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300">
                      <Pill size={10} className="text-teal-600" />
                      {medsCount} meds
                    </span>
                    {cfg && (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Campo de Diagnóstico Clínico Base (Editável pelo usuário) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Diagnóstico Clínico Base:
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (Editável para direcionar a IA)
                  </span>
                </div>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Ex: Pneumonia comunitária grave, HAS, DPOC exacerbado, Pós-op laparotomia..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                />
              </div>

              {/* Botão de Ação: Gerar Relatório */}
              <button
                onClick={handleGenerate}
                disabled={generating || !diagnosis.trim()}
                className="w-full py-3 px-4 rounded-xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white font-bold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Compilando Relatório Clínico com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Gerar Relatório de Plantão com IA Agora</span>
                  </>
                )}
              </button>

              {/* Mensagem de Erro */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Feedback de Salvo no Prontuário */}
              {savedNote && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fade-in">
                  <CheckCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold">
                    Relatório de plantão registrado com sucesso na aba Evoluções do paciente!
                  </span>
                </div>
              )}

              {/* Exibição do Relatório Gerado */}
              {report && (
                <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/20 dark:bg-teal-950/20 overflow-hidden shadow-xs animate-fade-in">
                  {/* Barra de Ações do Relatório */}
                  <div className="px-4 py-2.5 bg-teal-100/60 dark:bg-teal-900/40 border-b border-teal-200/80 dark:border-teal-800/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-teal-700 dark:text-teal-400" />
                      <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider">
                        Relatório Consolidado
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingReport) {
                            setReport(editedReport);
                            setIsEditingReport(false);
                          } else {
                            setEditedReport(report);
                            setIsEditingReport(true);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {isEditingReport ? <Check size={13} className="text-teal-600" /> : <Edit3 size={13} />}
                        {isEditingReport ? "Concluir Edição" : "Editar"}
                      </button>

                      <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {copied ? <Check size={13} className="text-teal-600" /> : <Copy size={13} />}
                        {copied ? "Copiado!" : "Copiar"}
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveAsNote}
                        disabled={savingNote}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-teal-800 hover:bg-teal-700 text-white shadow-xs transition-colors disabled:opacity-50"
                      >
                        {savingNote ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Salvar como Evolução</span>
                      </button>
                    </div>
                  </div>

                  {/* Corpo do Relatório */}
                  <div className="p-4 sm:p-5">
                    {isEditingReport ? (
                      <textarea
                        value={editedReport}
                        onChange={(e) => setEditedReport(e.target.value)}
                        rows={12}
                        className="w-full p-3.5 bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-sans leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                        placeholder="Edite o relatório..."
                      />
                    ) : (
                      <div className="whitespace-pre-line text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans select-text">
                        {report}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          {selectedPatient ? (
            <Link
              href={`/patient?id=${selectedPatient.id}&tab=relatorio`}
              className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 hover:underline font-semibold text-[11px]"
              onClick={onClose}
            >
              <span>Abrir prontuário completo</span>
              <ExternalLink size={12} />
            </Link>
          ) : (
            <span />
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
