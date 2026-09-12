"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Mic,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Calendar,
  User,
  AlertTriangle,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  ListTodo,
} from "lucide-react";
import { listTasks, completeTask, deleteTask, type Task } from "@/lib/localdb";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [search, setSearch] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const items = await listTasks();
      setTasks(items);
    } catch (err) {
      console.error("Erro ao carregar tarefas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleComplete = async (id: string) => {
    setActionLoadingId(id);
    try {
      await completeTask(id);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao concluir tarefa:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este agendamento?")) return;
    setActionLoadingId(id);
    try {
      await deleteTask(id);
      await loadTasks();
    } catch (err) {
      console.error("Erro ao excluir tarefa:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Separação em pendentes e concluídas
  const pendingTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  const currentList = activeTab === "pending" ? pendingTasks : completedTasks;

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return currentList;
    const q = search.toLowerCase();
    return currentList.filter(
      (t) =>
        t.patientName.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  }, [currentList, search]);

  const formatScheduleDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    if (isToday) {
      return `Hoje às ${timeStr}`;
    }
    if (isTomorrow) {
      return `Amanhã às ${timeStr}`;
    }
    return `${d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    })} às ${timeStr}`;
  };

  const isOverdue = (dateStr: string, completed: boolean) => {
    if (completed) return false;
    return new Date(dateStr).getTime() < Date.now();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header com Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111927] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <ListTodo size={20} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Agendador de Tarefas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lembretes locais clínicos disparados mesmo com o app fechado
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Link
            href="/tasks/new"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Mic size={16} /> Nova Tarefa por Voz
          </Link>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Abas */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto border border-slate-200/80 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              activeTab === "pending"
                ? "bg-white dark:bg-[#111927] text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Pendentes
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === "pending"
                  ? "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {pendingTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("completed")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              activeTab === "completed"
                ? "bg-white dark:bg-[#111927] text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Concluídas
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === "completed"
                  ? "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {completedTasks.length}
            </span>
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por paciente ou ação..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Lista de Tarefas */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
          Carregando agendamentos...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-[#111927] rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto mb-3">
            <Mic size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {activeTab === "pending"
              ? "Nenhuma tarefa pendente encontrada"
              : "Nenhuma tarefa concluída"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {activeTab === "pending"
              ? "Agende lembretes de cuidados, sinais vitais ou medicações falando com o microfone."
              : "As tarefas marcadas como concluídas serão arquivadas aqui."}
          </p>
          {activeTab === "pending" && (
            <Link
              href="/tasks/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Mic size={14} /> Agendar com Voz
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredTasks.map((task) => {
            const overdue = isOverdue(task.scheduledAt, task.completed);
            const isLoading = actionLoadingId === task.id;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  task.completed
                    ? "bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 opacity-85"
                    : overdue
                    ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 shadow-xs"
                    : "bg-white dark:bg-[#111927] border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Top Bar do Card */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          task.completed
                            ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400"
                            : overdue
                            ? "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400"
                            : "bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400"
                        }`}
                      >
                        <User size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {task.patientName || "Geral / Plantão"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.completed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                          <Check size={11} strokeWidth={3} /> Concluída
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 animate-pulse">
                          <AlertTriangle size={11} /> Atrasada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
                          <Clock size={11} /> Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Descrição */}
                  <p
                    className={`text-xs sm:text-sm font-medium leading-snug mt-1 ${
                      task.completed
                        ? "text-slate-500 dark:text-slate-400 line-through"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {task.description}
                  </p>
                </div>

                {/* Bottom Bar: Horário e Botões */}
                <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Clock size={13} className={overdue ? "text-rose-600 dark:text-rose-400" : ""} />
                    <span className={overdue ? "text-rose-600 dark:text-rose-400 font-bold" : "font-medium"}>
                      {formatScheduleDate(task.scheduledAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!task.completed && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleComplete(task.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                        title="Marcar como concluída"
                      >
                        <Check size={13} strokeWidth={3} />
                        Concluir
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleDelete(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                      title="Excluir agendamento"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (FAB) Mobile */}
      <div
        className="sm:hidden fixed right-4 z-30"
        style={{
          bottom: "calc(4.75rem + max(var(--safe-area-inset-bottom, 0px), env(safe-area-inset-bottom, 0px)))",
        }}
      >
        <Link
          href="/tasks/new"
          className="w-13 h-13 rounded-full bg-teal-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Nova tarefa por voz"
        >
          <Mic size={22} />
        </Link>
      </div>
    </div>
  );
}
