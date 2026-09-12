"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  UsersRound,
  UserPlus,
  Trash2,
  ChevronRight,
  Shield,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  listTeamMembers,
  createTeamMember,
  deleteTeamMember,
  type TeamMember,
} from "@/lib/localdb";

export default function TeamDashboard() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal novo colaborador
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Enfermeiro(a)");
  const [shift, setShift] = useState("MANHA");
  const [isCover, setIsCover] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const carregarEquipe = async () => {
    try {
      const data = await listTeamMembers();
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEquipe();
  }, []);

  const handleSalvarColaborador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Informe o nome do profissional.");
      return;
    }
    setSubmitting(true);
    try {
      await createTeamMember({
        name: name.trim(),
        role,
        shift,
        isCover,
      });
      setName("");
      setIsCover(false);
      setShowModal(false);
      await carregarEquipe();
    } catch {
      alert("Erro ao cadastrar profissional.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluirColaborador = async (id: string, memberName: string) => {
    if (!confirm(`Deseja remover ${memberName} da equipe?`)) return;
    try {
      await deleteTeamMember(id);
      await carregarEquipe();
    } catch {
      alert("Erro ao remover colaborador.");
    }
  };

  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Gestão de Equipe & Escalas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Gerenciamento de profissionais de enfermagem e modelos de escala de plantão
          </p>
        </div>
      </div>

      {/* Grid Principal de Quadros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quadro 1: Escalas (Leva para a tela /team/escalas com as 4 escalas) */}
        <div className="lg:col-span-1 flex flex-col">
          <Link
            href="/team/escalas"
            className="group flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs hover:border-teal-600/50 dark:hover:border-teal-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-800 dark:bg-teal-700 flex items-center justify-center text-white shadow-xs">
                  <Calendar size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40">
                  4 Modelos
                </span>
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                Escalas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Acesse a tela com os 4 modelos de escala disponíveis: <strong>6x1 com Folguista</strong>,{" "}
                <strong>12x36 Alternada</strong>, <strong>5x2 Semanal</strong> e{" "}
                <strong>Personalizada Manual</strong>.
              </p>

              <div className="mt-5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                  Escala 6x1 com Folguista
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                  Escala 12x36 (Grupos A e B)
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                  Escala 5x2 (Folgas Fixas)
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                  Escala Personalizada (Manual)
                </div>
              </div>
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                Abrir Quadro de Escalas <ChevronRight size={14} />
              </span>
            </div>
          </Link>
        </div>

        {/* Quadro 2: Gestão da Equipe de Enfermagem */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UsersRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Equipe de Enfermagem
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Profissionais cadastrados no hospital ({activeMembers.length} ativos)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus size={14} /> Cadastrar Profissional
              </button>
            </div>

            {/* Lista de Colaboradores */}
            {loading ? (
              <p className="text-xs text-stone-400 font-mono py-6 text-center">Carregando equipe…</p>
            ) : activeMembers.length === 0 ? (
              <div className="text-center py-8 px-4 bg-stone-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-stone-200 dark:border-slate-700">
                <UsersRound size={32} className="mx-auto text-stone-300 dark:text-slate-600 mb-2" />
                <p className="text-sm font-semibold text-stone-700 dark:text-slate-300">
                  Nenhum colaborador cadastrado
                </p>
                <p className="text-xs text-stone-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Cadastre os profissionais da equipe para serem vinculados automaticamente às escalas e evoluções.
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold"
                >
                  <UserPlus size={13} /> Adicionar Primeiro
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {activeMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-stone-50/70 dark:bg-slate-800/50 border border-stone-200/80 dark:border-slate-700/60 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {member.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          <span className="text-teal-700 dark:text-teal-400 font-medium">
                            {member.role || "Enfermeiro(a)"}
                          </span>
                          <span>·</span>
                          <span>{member.shift || "Geral"}</span>
                          {member.isCover && (
                            <>
                              <span>·</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                Folguista
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExcluirColaborador(member.id, member.name)}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      title="Excluir Colaborador"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>A equipe cadastrada é utilizada diretamente em todos os geradores de escalas.</span>
          </div>
        </div>
      </div>

      {/* Modal Cadastrar Colaborador */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-stone-900 dark:text-slate-100 flex items-center gap-2">
                <UserPlus size={18} className="text-teal-600" /> Cadastrar Novo Profissional
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSalvarColaborador} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ana Clara Silva"
                  className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-stone-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Cargo / Função
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl text-xs text-stone-900 dark:text-slate-100"
                  >
                    <option value="Enfermeiro(a)">Enfermeiro(a)</option>
                    <option value="Técnico(a) de Enfermagem">Técnico(a) de Enfermagem</option>
                    <option value="Auxiliar de Enfermagem">Auxiliar de Enfermagem</option>
                    <option value="Coordenador(a)">Coordenador(a)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Turno Principal
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-xl text-xs text-stone-900 dark:text-slate-100"
                  >
                    <option value="MANHA">Manhã (07h às 13h)</option>
                    <option value="TARDE">Tarde (13h às 19h)</option>
                    <option value="NOITE">Noite (19h às 07h)</option>
                    <option value="DIURNO">Diurno 12h</option>
                    <option value="GERAL">Geral / Comercial</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isCover"
                  checked={isCover}
                  onChange={(e) => setIsCover(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <label htmlFor="isCover" className="text-xs text-stone-700 dark:text-slate-300">
                  Atua como <strong>Folguista / Volante</strong> (cobertura de folgas)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs"
                >
                  {submitting ? "Salvando…" : "Salvar Profissional"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
