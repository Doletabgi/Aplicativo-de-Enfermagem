"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { consumePendingImportContent, subscribePendingImport } from "@/lib/pendingImport";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Bed,
  Activity,
  Pill,
  Users,
  Clock,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  X,
  Share2,
} from "lucide-react";
import {
  getPatientById,
  importAnyPatientBundle,
  validatePatientBundle,
  type PatientExportBundle,
  type MultiImportResult,
  type PatientItemBundle,
} from "@/lib/localdb";

export default function ImportPatientPage() {
  const router = useRouter();

  const [bundle, setBundle] = useState<PatientExportBundle | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [readingFile, setReadingFile] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Verificação de pacientes existentes
  const [existingCount, setExistingCount] = useState<number>(0);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<MultiImportResult | null>(null);

  // Extrai lista uniforme de itens de pacientes do bundle (seja individual ou lote)
  const patientItems: PatientItemBundle[] = useMemo(() => {
    if (!bundle) return [];
    if (Array.isArray(bundle.patients) && bundle.patients.length > 0) {
      return bundle.patients;
    }
    if (bundle.patient) {
      return [
        {
          patient: bundle.patient,
          vitalSigns: bundle.vitalSigns || [],
          medications: bundle.medications || [],
          nursingNotes: bundle.nursingNotes || [],
        },
      ];
    }
    return [];
  }, [bundle]);

  const totalVitals = useMemo(() => {
    return patientItems.reduce((acc, p) => acc + (p.vitalSigns?.length || 0), 0);
  }, [patientItems]);

  const totalMeds = useMemo(() => {
    return patientItems.reduce((acc, p) => acc + (p.medications?.length || 0), 0);
  }, [patientItems]);

  // Processa texto JSON vindo de arquivo manual ou de abertura nativa (ex: WhatsApp/Bluetooth)
  const loadJsonContent = async (rawText: string, name?: string, size?: number) => {
    setReadingFile(true);
    setParseError(null);
    setBundle(null);
    setImportSuccess(null);
    setExistingCount(0);
    if (name) setFileName(name);
    if (size) setFileSize(size);

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error("O arquivo não é um JSON válido.");
      }

      if (!validatePatientBundle(parsed)) {
        throw new Error(
          "Estrutura de arquivo inválida. O arquivo deve ser um prontuário gerado pelo aplicativo."
        );
      }

      const validBundle = parsed as PatientExportBundle;
      setBundle(validBundle);

      const items: PatientItemBundle[] =
        Array.isArray(validBundle.patients) && validBundle.patients.length > 0
          ? validBundle.patients
          : validBundle.patient
          ? [
              {
                patient: validBundle.patient,
                vitalSigns: validBundle.vitalSigns || [],
                medications: validBundle.medications || [],
                nursingNotes: validBundle.nursingNotes || [],
              },
            ]
          : [];

      if (!name) {
        if (items.length > 1) {
          setFileName(`plantao-${items.length}-pacientes.json`);
        } else if (items[0]) {
          setFileName(
            `paciente-${items[0].patient.name.toLowerCase().replace(/\s+/g, "-")}.json`
          );
        } else {
          setFileName("prontuario-compartilhado.json");
        }
      }
      if (!size) {
        setFileSize(rawText.length);
      }

      // Checar se algum paciente já existe no banco
      const existingChecks = await Promise.all(
        items.map((item) => getPatientById(item.patient.id))
      );
      const found = existingChecks.filter(Boolean).length;
      setExistingCount(found);
    } catch (err: any) {
      console.error("Erro ao ler dados do prontuário:", err);
      setParseError(err?.message || "Falha ao processar o arquivo.");
    } finally {
      setReadingFile(false);
    }
  };

  // Consome arquivo de paciente recebido via ImportListener global
  useEffect(() => {
    const initial = consumePendingImportContent();
    if (initial) {
      loadJsonContent(initial, "paciente-aberto.json", initial.length);
    }

    const unsubscribe = subscribePendingImport((content) => {
      consumePendingImportContent();
      loadJsonContent(content, "paciente-aberto.json", content.length);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Leitura do arquivo selecionado manualmente
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await loadJsonContent(text, file.name, file.size);
    } catch (err: any) {
      setParseError(err?.message || "Falha ao ler o arquivo selecionado.");
    }
  };

  // Resetar seleção
  const handleReset = () => {
    setBundle(null);
    setFileName("");
    setFileSize(0);
    setParseError(null);
    setExistingCount(0);
    setImportSuccess(null);
  };

  // Clique no botão de importar
  const handleStartImport = () => {
    if (!bundle) return;
    if (existingCount > 0) {
      // Paciente(s) já existem: pede confirmação de atualização/merge
      setShowConflictModal(true);
    } else {
      // Nenhum conflito: importa direto
      executeImport(false);
    }
  };

  // Executa a importação no banco SQLite
  const executeImport = async (overwrite: boolean) => {
    if (!bundle) return;
    setImporting(true);
    setShowConflictModal(false);

    try {
      const result = await importAnyPatientBundle(bundle, overwrite);
      setImportSuccess(result);
    } catch (err: any) {
      console.error("Erro na importação:", err);
      setParseError(
        err?.message || "Ocorreu um erro ao importar os dados para o banco de dados local."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
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
              <Share2 size={18} />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Importar Prontuários de Pacientes
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Transferência de pacientes entre celulares 100% offline via arquivo JSON
          </p>
        </div>
      </div>

      {/* Offline Assurance Banner */}
      <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-start gap-3">
        <ShieldCheck size={20} className="text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 dark:text-slate-300">
          <p className="font-bold text-teal-900 dark:text-teal-200">
            Privacidade Hospitalar & Operação 100% Offline
          </p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400 leading-relaxed">
            Nenhum dado é enviado para a internet ou servidores externos. Os registros clínicos
            são importados diretamente do arquivo para a memória local deste dispositivo.
          </p>
        </div>
      </div>

      {/* Erro de leitura/formato */}
      {parseError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 animate-fade-in">
          <AlertCircle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-rose-900 dark:text-rose-200">
              Não foi possível processar o arquivo
            </p>
            <p className="mt-0.5 text-rose-700 dark:text-rose-300 font-mono">{parseError}</p>
          </div>
          <button onClick={() => setParseError(null)} className="text-rose-400 hover:text-rose-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success State */}
      {importSuccess && (
        <div className="bg-white dark:bg-[#111927] rounded-2xl border border-emerald-300 dark:border-emerald-800 p-6 sm:p-8 shadow-xs text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {importSuccess.totalPatients > 1
                ? `${importSuccess.totalPatients} Pacientes Importados com Sucesso!`
                : importSuccess.createdCount > 0
                ? "Paciente Importado com Sucesso!"
                : "Prontuário Atualizado com Sucesso!"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {importSuccess.totalPatients > 1
                ? `Registros clínicos de ${importSuccess.totalPatients} pacientes foram gravados com sucesso neste celular (${importSuccess.createdCount} novos, ${importSuccess.updatedCount} atualizados).`
                : `Os dados clínicos de ${patientItems[0]?.patient.name || "paciente"} foram gravados com sucesso no banco de dados local.`}
            </p>
          </div>

          {/* Detailed summary */}
          <div className="max-w-md mx-auto grid grid-cols-3 gap-2 py-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-center">
            <div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {importSuccess.totalPatients}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Pacientes</span>
            </div>
            <div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {importSuccess.vitalsAdded}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Sinais Vitais</span>
            </div>
            <div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {importSuccess.medsAdded}
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Medicações</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {patientItems.length === 1 && patientItems[0] ? (
              <button
                onClick={() => router.push(`/patient?id=${patientItems[0].patient.id}`)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                Abrir Prontuário do Paciente
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => router.push("/patients")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
              >
                Ver Lista de Pacientes
                <ChevronRight size={16} />
              </button>
            )}

            <button
              onClick={() => router.push("/")}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Ir para Dashboard
            </button>

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Importar Outro Arquivo
            </button>
          </div>
        </div>
      )}

      {/* File Upload Drop Area */}
      {!bundle && !importSuccess && (
        <div className="bg-white dark:bg-[#111927] rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 sm:p-12 text-center relative hover:border-teal-500 dark:hover:border-teal-400 transition-colors group">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            aria-label="Selecionar arquivo JSON"
          />

          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform shadow-xs">
            {readingFile ? <RefreshCw size={28} className="animate-spin" /> : <Upload size={28} />}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Selecione o arquivo de prontuário recebido
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Toque para escolher o arquivo{" "}
            <code className="font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 rounded">
              .json
            </code>{" "}
            recebido por Bluetooth, Quick Share ou WhatsApp
          </p>

          <div className="mt-5 inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs pointer-events-none">
            <Upload size={16} />
            Escolher Arquivo .JSON
          </div>
        </div>
      )}

      {/* Preview Card */}
      {bundle && !importSuccess && (
        <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-6 animate-fade-in">
          {/* File summary bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                  {fileName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {(fileSize / 1024).toFixed(1)} KB · Exportado em{" "}
                  {new Date(bundle.exportedAt).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Remover e escolher outro arquivo"
            >
              <X size={18} />
            </button>
          </div>

          {/* Existing Patient Warning */}
          {existingCount > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <p className="font-bold">
                  Atenção: {existingCount} de {patientItems.length} paciente(s) já cadastrado(s) neste dispositivo
                </p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300 leading-relaxed">
                  Ao confirmar a importação, os dados cadastrais serão atualizados e serão mesclados
                  apenas os novos sinais vitais e medicações sem duplicação de registros.
                </p>
              </div>
            </div>
          )}

          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-center">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto mb-1">
                <Users size={16} />
              </div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {patientItems.length}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                Pacientes
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-center">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto mb-1">
                <Activity size={16} />
              </div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {totalVitals}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                Sinais Vitais
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-center">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto mb-1">
                <Pill size={16} />
              </div>
              <span className="block text-lg font-bold font-mono text-slate-900 dark:text-white">
                {totalMeds}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                Medicações
              </span>
            </div>
          </div>

          {/* Patients Details Preview List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pacientes contidos no arquivo ({patientItems.length})
            </h4>

            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {patientItems.map((item, idx) => (
                <div
                  key={item.patient.id || idx}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-center shrink-0">
                      <span className="block text-[8px] font-semibold text-teal-700 dark:text-teal-400 uppercase">
                        Leito
                      </span>
                      <span className="text-xs font-bold font-mono text-teal-950 dark:text-teal-200">
                        {item.patient.bed || "—"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.patient.name}
                        </p>
                        {item.patient.condition && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {item.patient.condition}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Diagnóstico: {item.patient.diagnosis || "Não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                    <span>
                      <strong>{item.vitalSigns?.length ?? 0}</strong> vitais
                    </span>
                    <span>•</span>
                    <span>
                      <strong>{item.medications?.length ?? 0}</strong> medicações
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleStartImport}
              disabled={importing}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 min-h-[42px]"
            >
              {importing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Importando dados...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  {existingCount > 0
                    ? `Confirmar Atualização / Merge (${patientItems.length} pacientes)`
                    : `Importar ${patientItems.length} Paciente${patientItems.length > 1 ? "s" : ""}`}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Instructions Card */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Share2 size={16} className="text-teal-600 dark:text-teal-400" />
          Como transferir pacientes entre dois celulares
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-400 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="font-bold text-teal-700 dark:text-teal-400 block mb-1">
              1. No Celular de Origem
            </span>
            Na Dashboard, toque em <strong>Compartilhamento de Pacientes</strong>, selecione os
            pacientes desejados e toque em Compartilhar.
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="font-bold text-teal-700 dark:text-teal-400 block mb-1">
              2. Envie o Arquivo
            </span>
            Escolha o método de envio nativo (Bluetooth, Quick Share, Nearby Share, WhatsApp ou
            salvar em pasta).
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="font-bold text-teal-700 dark:text-teal-400 block mb-1">
              3. No Celular de Destino
            </span>
            Abra esta tela e selecione o arquivo <code>.json</code> recebido. O prontuário será
            importado imediatamente com histórico completo.
          </div>
        </div>
      </div>

      {/* Conflict Confirmation Modal */}
      {showConflictModal && bundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Paciente(s) já cadastrado(s)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {existingCount} paciente(s) coincidente(s)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Deseja <strong>atualizar os dados existentes</strong> deste(s) paciente(s) e adicionar
              apenas os registros clínicos (sinais vitais e medicações) que ainda não constam neste
              dispositivo?
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
              Nenhum dado duplicado será criado. Apenas novos registros serão mesclados aos
              prontuários.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeImport(true)}
                disabled={importing}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors shadow-xs"
              >
                Atualizar e Mesclar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
