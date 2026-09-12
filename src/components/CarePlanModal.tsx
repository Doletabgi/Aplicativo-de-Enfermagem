"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Save,
  CheckCheck,
  X,
  User,
  Bed,
  ExternalLink,
  Search,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  listPatients,
  getPatientStatus,
  Patient,
  getCareSuggestions,
  createNursingNote,
} from "@/lib/localdb";
import { STATUS_CONFIG } from "@/lib/statusConfig";

interface PatientWithStatus extends Patient {
  status?: string;
}

interface CarePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPatientId?: string | null;
}

export function CarePlanModal({ isOpen, onClose, initialPatientId }: CarePlanModalProps) {
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<string>("");

  const [generating, setGenerating] = useState(false);
  const [careSuggestions, setCareSuggestions] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega lista de pacientes ativos
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

        // Se veio initialPatientId e existe na lista, seleciona ele
        if (initialPatientId && withStatus.some((p) => p.id === initialPatientId)) {
          setSelectedPatientId(initialPatientId);
        } else if (withStatus.length > 0 && !selectedPatientId) {
          setSelectedPatientId(withStatus[0].id);
        }
      } catch (err) {
        console.error("Erro ao carregar pacientes no modal de cuidados:", err);
      } finally {
        if (isMounted) setLoadingPatients(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialPatientId]);

  // Atualiza diagnóstico quando paciente selecionado muda
  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  useEffect(() => {
    if (selectedPatient) {
      setDiagnosis(selectedPatient.diagnosis || "");
      setCareSuggestions(null);
      setErrorMsg(null);
      setSavedNote(false);
    }
  }, [selectedPatientId]);

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
      const suggestions = await getCareSuggestions({
        diagnosis: diagnosis.trim(),
        patientName: selectedPatient?.name,
        gender: selectedPatient?.gender,
        age: selectedPatient?.birthDate ? calcAge(selectedPatient.birthDate) : undefined,
      });

      if (!suggestions || suggestions.length === 0) {
        setErrorMsg("Não foi possível gerar sugestões para este diagnóstico. Tente novamente.");
      } else {
        setCareSuggestions(suggestions);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar sugestões de cuidados.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!careSuggestions || careSuggestions.length === 0) return;

    const text = [
      `PLANO DE CUIDADOS DE ENFERMAGEM (IA)`,
      `Paciente: ${selectedPatient?.name || "Paciente"} (Leito ${selectedPatient?.bed || "—"})`,
      `Diagnóstico: ${diagnosis}`,
      `Data/Hora: ${new Date().toLocaleString("pt-BR")}`,
      ``,
      ...careSuggestions.map((s, idx) => `${idx + 1}. ${s}`),
    ].join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSaveToRecord = async () => {
    if (!selectedPatient || !careSuggestions || careSuggestions.length === 0) return;

    setSavingNote(true);
    try {
      const noteContent = [
        `[PLANO DE CUIDADOS ASSISTENCIAIS - IA/PROTOCOLO]`,
        `Diagnóstico: ${diagnosis}`,
        ``,
        ...careSuggestions.map((s, idx) => `${idx + 1}. ${s}`),
      ].join("\n");

      await createNursingNote({
        patientId: selectedPatient.id,
        content: noteContent,
      });

      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 4000);
    } catch (err) {
      console.error("Erro ao salvar cuidados no prontuário:", err);
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
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Bot size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                  Cuidados por IA
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  <Sparkles size={11} />
                  Geração Imediata
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Selecione o paciente para gerar e consultar o plano de cuidados nesta tela
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
              Carregando leitos ativos...
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-10 glass-panel rounded-xl">
              <AlertCircle size={32} className="mx-auto text-amber-500 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhum paciente internado encontrado
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Cadastre ou reative um paciente no leito para gerar cuidados.
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
                    <div className="px-2.5 py-1 rounded-lg bg-teal-700 text-white font-mono font-bold text-xs text-center shrink-0">
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

                  {cfg && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold self-start sm:self-center border ${cfg.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  )}
                </div>
              )}

              {/* Campo de Diagnóstico Clínico (Editável se necessário) */}
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
                  placeholder="Ex: Pneumonia comunitária, HAS, Pós-op laparotomia, Sepse..."
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
                />
              </div>

              {/* Botão de Ação: Gerar */}
              <button
                onClick={handleGenerate}
                disabled={generating || !diagnosis.trim()}
                className="w-full py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white font-bold text-xs sm:text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {generating ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Processando Cuidados de Enfermagem...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Gerar Cuidados com IA Agora</span>
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
                    Plano de cuidados registrado com sucesso na aba Evoluções do paciente!
                  </span>
                </div>
              )}

              {/* Bloco de Resultados Gerados NA MESMA TELA */}
              {careSuggestions && careSuggestions.length > 0 && (
                <div className="mt-4 rounded-xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/20 p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-teal-100 dark:border-teal-900/60 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-teal-700 dark:text-teal-400" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Cuidados Sugeridos · {diagnosis}
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300">
                      {careSuggestions.length} condutas
                    </span>
                  </div>

                  <div className="divide-y divide-teal-100/60 dark:divide-teal-900/40">
                    {careSuggestions.map((item, idx) => (
                      <div key={idx} className="py-2.5 flex items-start gap-3">
                        <span className="w-5 h-5 rounded-md bg-teal-700 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Barra de Ações Rápidas do Resultado */}
                  <div className="pt-3 border-t border-teal-100 dark:border-teal-900/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copied ? "Copiado!" : "Copiar"}</span>
                      </button>

                      <button
                        onClick={handleSaveToRecord}
                        disabled={savingNote || savedNote}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white transition-colors shadow-2xs disabled:opacity-50"
                      >
                        {savedNote ? <CheckCheck size={13} /> : <Save size={13} />}
                        <span>{savedNote ? "Salvo" : savingNote ? "Salvando..." : "Salvar no Prontuário"}</span>
                      </button>
                    </div>

                    {selectedPatient && (
                      <Link
                        href={`/patient?id=${selectedPatient.id}&tab=cuidados`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:underline ml-auto"
                      >
                        <span>Abrir Prontuário</span>
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
            {patients.length} leito(s) monitorado(s)
          </span>
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
