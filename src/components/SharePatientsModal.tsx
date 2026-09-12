"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Share2,
  X,
  Search,
  CheckSquare,
  Square,
  Users,
  Activity,
  Bed,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  ArrowRight,
} from "lucide-react";
import {
  listPatients,
  getPatientStatus,
  exportMultiplePatientsBundle,
  sharePatientBundle,
  Patient,
  PatientExportBundle,
} from "@/lib/localdb";
import { STATUS_CONFIG } from "@/lib/statusConfig";

interface PatientWithStatus extends Patient {
  status?: string;
}

interface SharePatientsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SharePatientsModal({ isOpen, onClose }: SharePatientsModalProps) {
  const [patients, setPatients] = useState<PatientWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [onlyActive, setOnlyActive] = useState(true);

  const [sharing, setSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega lista de pacientes e seus status
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      setShareSuccess(null);
      try {
        const raw = await listPatients();
        const withStatus = await Promise.all(
          raw.map(async (p) => {
            const status = await getPatientStatus(p.id);
            return { ...p, status };
          })
        );

        if (!isMounted) return;
        setPatients(withStatus);

        // Por padrão, seleciona todos os pacientes ativos
        const activeIds = withStatus.filter((p) => p.active).map((p) => p.id);
        setSelectedIds(new Set(activeIds));
      } catch (err) {
        console.error("Erro ao carregar pacientes para compartilhamento:", err);
        if (isMounted) setErrorMsg("Falha ao carregar a lista de pacientes.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Filtra pacientes por busca e por ativos/todos
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (onlyActive && !p.active) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.bed && p.bed.toLowerCase().includes(q)) ||
        (p.diagnosis && p.diagnosis.toLowerCase().includes(q))
      );
    });
  }, [patients, search, onlyActive]);

  // Alterna seleção de um paciente
  const togglePatient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Selecionar todos os filtrados
  const handleSelectAll = () => {
    const allFilteredIds = filteredPatients.map((p) => p.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allFilteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  // Desmarcar todos os filtrados
  const handleDeselectAll = () => {
    const allFilteredIds = new Set(filteredPatients.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      allFilteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // Ação de exportar e compartilhar
  const handleShare = async () => {
    if (selectedIds.size === 0) return;

    setSharing(true);
    setErrorMsg(null);
    setShareSuccess(null);

    try {
      const idsArray = Array.from(selectedIds);
      const bundle = await exportMultiplePatientsBundle(idsArray);
      await sharePatientBundle(bundle);
      setShareSuccess(
        `${idsArray.length} paciente${idsArray.length > 1 ? "s" : ""} preparado${idsArray.length > 1 ? "s" : ""} para compartilhamento com sucesso.`
      );
    } catch (err: any) {
      console.error("Erro ao compartilhar pacientes:", err);
      setErrorMsg(err?.message || "Falha ao gerar o arquivo de compartilhamento.");
    } finally {
      setSharing(false);
    }
  };

  if (!isOpen) return null;

  const isAllFilteredSelected =
    filteredPatients.length > 0 &&
    filteredPatients.every((p) => selectedIds.has(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Share2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg">
                  Compartilhar Pacientes
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  Transferência Offline
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione os pacientes para transferir entre dispositivos via Bluetooth, Quick Share ou WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800/60 space-y-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/20">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por paciente, leito ou diagnóstico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAll}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
              >
                {isAllFilteredSelected ? (
                  <>
                    <Square size={14} className="text-slate-500" />
                    Desmarcar todos ({filteredPatients.length})
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} className="text-teal-600" />
                    Selecionar todos ({filteredPatients.length})
                  </>
                )}
              </button>

              <label className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer ml-1 select-none">
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                />
                <span>Apenas internados</span>
              </label>
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="text-teal-600 dark:text-teal-400 font-bold">
                {selectedIds.size}
              </span>{" "}
              de {patients.length} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {shareSuccess && (
          <div className="m-4 mb-0 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span className="flex-1">{shareSuccess}</span>
          </div>
        )}

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-teal-600" />
              Carregando pacientes cadastrados...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
              <Users size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Nenhum paciente encontrado
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {search ? "Tente alterar os termos da busca." : "Nenhum paciente cadastrado no momento."}
              </p>
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const isSelected = selectedIds.has(patient.id);
              const statusCfg =
                patient.status && patient.status in STATUS_CONFIG
                  ? STATUS_CONFIG[patient.status as keyof typeof STATUS_CONFIG]
                  : STATUS_CONFIG.sem_dados;

              return (
                <div
                  key={patient.id}
                  onClick={() => togglePatient(patient.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-teal-50/60 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700/80 shadow-xs"
                      : "bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      aria-label={isSelected ? "Desmarcar" : "Marcar"}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? "bg-teal-600 text-white"
                          : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                      }`}
                    >
                      {isSelected && <CheckSquare size={14} />}
                    </button>

                    <div className="px-2.5 py-1 rounded-lg bg-teal-100 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-center shrink-0">
                      <span className="block text-[8px] font-semibold text-teal-700 dark:text-teal-400 uppercase">
                        Leito
                      </span>
                      <span className="text-xs font-bold font-mono text-teal-950 dark:text-teal-200">
                        {patient.bed || "—"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {patient.name}
                        </p>
                        {!patient.active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Alta
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {patient.diagnosis || "Sem diagnóstico informado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            href="/import"
            onClick={onClose}
            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 flex items-center gap-1.5 py-1"
          >
            <Download size={14} />
            Recebeu um arquivo? Ir para Importar
            <ArrowRight size={13} />
          </Link>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={selectedIds.size === 0 || sharing}
              className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs disabled:opacity-50 min-h-[42px]"
            >
              {sharing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Gerando arquivo...
                </>
              ) : (
                <>
                  <Share2 size={16} />
                  Compartilhar {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
