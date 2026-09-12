"use client";

import { useEffect, useState } from "react";
import { Building2, Check, Edit3, ShieldAlert, ArrowRight, RefreshCw } from "lucide-react";
import { listWorkspaces, getActiveWorkspace, setActiveWorkspace, renameWorkspace, closeAllWorkspaceConnections, resyncAllNotifications, type Workspace } from "@/lib/localdb";
import { THEMES } from "@/lib/theme";

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    window.addEventListener("workspaces_updated", loadData);
    return () => window.removeEventListener("workspaces_updated", loadData);
  }, []);

  const loadData = async () => {
    const list = await listWorkspaces();
    const active = await getActiveWorkspace();
    setWorkspaces(list);
    setActiveWorkspaceState(active);
    const initialNames: Record<string, string> = {};
    list.forEach((w) => {
      initialNames[w.id] = w.name;
    });
    setNames(initialNames);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveName = async (id: string) => {
    const newName = names[id]?.trim();
    if (!newName) return;
    setSavingId(id);
    try {
      const updated = await renameWorkspace(id, newName);
      setWorkspaces(updated);
      if (activeWorkspace?.id === id) {
        setActiveWorkspaceState({ ...activeWorkspace, name: newName });
      }
      showToast(`Nome da Área atualizado para "${newName}"`);
    } catch {
      showToast("Erro ao renomear área de trabalho");
    } finally {
      setSavingId(null);
    }
  };

  const handleSwitchWorkspace = async (id: string) => {
    if (activeWorkspace?.id === id) return;
    setSwitchingId(id);
    try {
      await closeAllWorkspaceConnections();
      await setActiveWorkspace(id);
      await resyncAllNotifications();
      await closeAllWorkspaceConnections();
      if (typeof window !== "undefined") {
        if (window.location.pathname === "/" || window.location.pathname === "") {
          window.location.reload();
        } else {
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error("Erro ao alternar workspace:", err);
      setSwitchingId(null);
      showToast("Erro ao alternar área de trabalho");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in pb-12">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-teal-900/90 text-white text-xs font-semibold shadow-xl backdrop-blur-xs flex items-center gap-2 animate-fade-in max-w-[90%] truncate">
          <Check size={16} className="text-teal-300 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Áreas de Trabalho (Hospitais)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gerencie seus dois ambientes hospitalares com bancos de dados isolados
            </p>
          </div>
        </div>
      </div>

      {/* Alerta de Isolamento de Dados */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex items-start gap-3.5">
        <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
          <p className="font-bold">Isolamento Total dos Dados Clínicos</p>
          <p className="text-amber-800/90 dark:text-amber-300/80">
            Cada área de trabalho tem seu <strong>próprio banco de dados local SQLite</strong>. Pacientes, prontuários, sinais vitais, medicações administradas, tarefas por voz, equipes e escalas cadastrados em um hospital <strong>não se misturam</strong> com o outro.
          </p>
          <p className="text-amber-800/90 dark:text-amber-300/80">
            O login e a senha do profissional são compartilhados entre ambos os hospitais.
          </p>
        </div>
      </div>

      {/* Lista das 2 Áreas de Trabalho */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workspaces.map((ws, idx) => {
          const isActive = activeWorkspace?.id === ws.id;
          const isSaving = savingId === ws.id;
          const isSwitching = switchingId === ws.id;

          return (
            <div
              key={ws.id}
              className={`rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                isActive
                  ? "bg-white dark:bg-[#111927] border-teal-600 dark:border-teal-500 ring-2 ring-teal-600/20 dark:ring-teal-500/20"
                  : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800"
              }`}
            >
              <div className="space-y-4">
                {/* Status & Identificação */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 flex items-center justify-center text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Área {idx + 1}
                    </span>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ativo
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Inativo
                    </span>
                  )}
                </div>

                {/* Edição do Nome */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nome da Área / Hospital
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={names[ws.id] || ""}
                      onChange={(e) =>
                        setNames({ ...names, [ws.id]: e.target.value })
                      }
                      placeholder="Ex: Hospital Municipal, Pronto-Socorro..."
                      className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      onClick={() => handleSaveName(ws.id)}
                      disabled={isSaving || names[ws.id] === ws.name}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Edit3 size={13} />
                      {isSaving ? "..." : "Salvar"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                    <span>Banco: <code className="font-mono">{ws.dbName}</code></span>
                    {ws.theme && (
                      <span className="font-semibold text-teal-700 dark:text-teal-400">
                        {THEMES.find((t) => t.id === ws.theme)?.emoji} {THEMES.find((t) => t.id === ws.theme)?.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botão de Alternar */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                {isActive ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400 py-2">
                    <Check size={16} /> Você está trabalhando nesta área
                  </div>
                ) : (
                  <button
                    onClick={() => handleSwitchWorkspace(ws.id)}
                    disabled={isSwitching}
                    className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSwitching ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Alternando banco de dados...
                      </>
                    ) : (
                      <>
                        Alternar para esta Área
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
