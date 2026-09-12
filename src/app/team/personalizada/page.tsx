"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Printer,
  Edit3,
  Calendar,
  Save,
  FolderOpen,
  X,
  UserPlus,
  Trash2,
  Check,
  Ban,
  Sparkles,
} from "lucide-react";
import {
  getSettings,
  listTeamMembers,
  listScalesByType,
  extractScaleMonth,
  getScale,
  saveScale,
  deleteScale,
} from "@/lib/localdb";
import { printDocument } from "@/lib/print";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface DayEntry {
  date: Date;
  dow: number;
  dayNum: number;
}

const CELL_CLASS = {
  T: "bg-emerald-500 text-white font-bold hover:bg-emerald-600 shadow-xs",
  F: "bg-stone-200 dark:bg-slate-700 text-stone-600 dark:text-slate-300 hover:bg-stone-300 dark:hover:bg-slate-600 font-medium",
};

function fmtDate(date: Date): string {
  return (
    String(date.getDate()).padStart(2, "0") +
    "/" +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

export default function GeradorEscalaPersonalizada() {
  const router = useRouter();

  const [month, setMonth] = useState("");
  const [shiftLabel, setShiftLabel] = useState("Enfermagem — Escala Personalizada");

  const [members, setMembers] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");

  const [days, setDays] = useState<DayEntry[]>([]);
  const [cells, setCells] = useState<string[][]>([]); // members x days ("T" | "F")

  const [hospitalName, setHospitalName] = useState("");
  const [savedMonths, setSavedMonths] = useState<
    { id: string; month: string; savedAt: string }[]
  >([]);
  const [showArchive, setShowArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Inicializar mês e carregar membros
  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const currentMonth = `${y}-${m}`;
    setMonth(currentMonth);

    getSettings()
      .then((s) => setHospitalName(s.hospitalName || ""))
      .catch(() => {});

    listTeamMembers()
      .then((team) => {
        const active = team.filter((m) => m.active);
        const names =
          active.length > 0
            ? active.map((m) => m.name)
            : ["Ana Souza", "Bruno Lima", "Carla Nunes", "Diego Ramos", "Elaine Costa"];
        setMembers(names);
        inicializarGrade(currentMonth, names);
      })
      .catch(() => {
        const defaultNames = ["Ana Souza", "Bruno Lima", "Carla Nunes"];
        setMembers(defaultNames);
        inicializarGrade(currentMonth, defaultNames);
      });
  }, []);

  const inicializarGrade = (selectedMonth: string, teamList: string[], existingCells?: string[][]) => {
    if (!selectedMonth) return;
    const [y, mm] = selectedMonth.split("-").map(Number);
    const daysInMonth = new Date(y, mm, 0).getDate();

    const newDays: DayEntry[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, mm - 1, d);
      newDays.push({
        date,
        dow: date.getDay(),
        dayNum: d,
      });
    }
    setDays(newDays);

    if (existingCells && existingCells.length === teamList.length) {
      setCells(existingCells);
    } else {
      // Padrão: Seg a Sex = "T", Sáb e Dom = "F"
      const grid = teamList.map(() =>
        newDays.map((d) => (d.dow === 0 || d.dow === 6 ? "F" : "T"))
      );
      setCells(grid);
    }
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    inicializarGrade(newMonth, members);
  };

  const toggleCell = (memberIdx: number, dayIdx: number) => {
    setCells((prev) => {
      const copy = prev.map((row) => [...row]);
      const current = copy[memberIdx][dayIdx];
      copy[memberIdx][dayIdx] = current === "T" ? "F" : "T";
      return copy;
    });
  };

  const preencherDiasUteis = () => {
    setCells((prev) =>
      prev.map(() => days.map((d) => (d.dow === 0 || d.dow === 6 ? "F" : "T")))
    );
  };

  const marcarTodosTrabalham = () => {
    setCells((prev) => prev.map(() => days.map(() => "T")));
  };

  const marcarTodosFolgam = () => {
    setCells((prev) => prev.map(() => days.map(() => "F")));
  };

  const alterarLinhaColaborador = (memberIdx: number, status: "T" | "F") => {
    setCells((prev) =>
      prev.map((row, i) => (i === memberIdx ? days.map(() => status) : row))
    );
  };

  const adicionarMembro = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.includes(trimmed)) {
      alert("Colaborador já na grade.");
      return;
    }
    const updated = [...members, trimmed];
    setMembers(updated);
    // Adiciona nova linha na grade
    setCells((prev) => [
      ...prev,
      days.map((d) => (d.dow === 0 || d.dow === 6 ? "F" : "T")),
    ]);
    setNewMemberName("");
  };

  const removerMembro = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
    setCells((prev) => prev.filter((_, i) => i !== index));
  };

  const monthKey = month ? `personalizada:${month}` : "";

  const salvarMes = async () => {
    if (members.length === 0 || days.length === 0) {
      alert("Defina ao menos um colaborador e selecione o mês.");
      return;
    }
    if (!monthKey) {
      alert("Selecione o mês.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const data = JSON.stringify({
        shiftLabel,
        members,
        cells,
        days: days.map((d) => ({
          iso: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(
            d.date.getDate()
          ).padStart(2, "0")}`,
          dow: d.dow,
          dayNum: d.dayNum,
        })),
      });
      await saveScale(monthKey, data);
      setSaveMsg("Escala personalizada salva com sucesso!");
      carregarMeses();
    } catch {
      setSaveMsg("Erro ao salvar a escala.");
    } finally {
      setSaving(false);
    }
  };

  const carregarMeses = async () => {
    try {
      setSavedMonths(await listScalesByType("personalizada"));
    } catch {
      setSavedMonths([]);
    }
  };

  const carregarMes = async (rawMonthKey: string) => {
    setLoadingMonth(true);
    try {
      const record = await getScale(rawMonthKey);
      if (!record) throw new Error("not found");
      const data = JSON.parse(record.data);
      const loadedDays: DayEntry[] = (data.days || []).map(
        (d: { iso: string; dow: number; dayNum: number }) => ({
          date: new Date(d.iso + "T00:00:00"),
          dow: d.dow,
          dayNum: d.dayNum,
        })
      );
      setShiftLabel(data.shiftLabel || "Enfermagem — Escala Personalizada");
      setMembers(data.members || []);
      setDays(loadedDays);
      setCells(data.cells || []);
      const clean = extractScaleMonth(rawMonthKey);
      setMonth(clean);
      setShowArchive(false);
    } catch {
      alert("Não foi possível carregar o mês.");
    } finally {
      setLoadingMonth(false);
    }
  };

  const excluirMes = async (rawMonthKey: string) => {
    const clean = extractScaleMonth(rawMonthKey);
    if (!confirm(`Excluir a escala personalizada de ${clean}?`)) return;
    try {
      await deleteScale(rawMonthKey);
      carregarMeses();
    } catch {}
  };

  const exportarCSV = () => {
    if (members.length === 0 || days.length === 0) {
      alert("A grade está vazia.");
      return;
    }
    const rows: string[][] = [];
    const header = [
      shiftLabel || "Escala Personalizada",
      ...days.map((d) => `${String(d.dayNum).padStart(2, "0")}/${fmtDate(d.date).slice(3)} (${DOW[d.dow]})`),
    ];
    rows.push(header);

    members.forEach((name, i) => {
      const row = [name];
      days.forEach((_, di) => {
        row.push(cells[i]?.[di] === "T" ? "Trabalha" : "FOLGA");
      });
      rows.push(row);
    });

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-personalizada-${month || "mes"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <style>{`
        @page {
          size: A4 landscape;
          margin: 8mm;
        }
        @media print {
          body {
            background: white !important;
          }
          .print-scale {
            display: flex !important;
            flex-direction: column;
            min-height: 100vh;
          }
          .print-scale .print-signatures {
            margin-top: auto;
            margin-bottom: 2rem;
          }
          .print-scale-table {
            width: 100% !important;
            font-size: 8px !important;
            border-collapse: collapse !important;
          }
          .print-scale-table th,
          .print-scale-table td {
            border: 1px solid #94a3b8 !important;
            padding: 2px 3px !important;
            text-align: center !important;
            line-height: 1.15 !important;
          }
          .print-scale-table th:first-child,
          .print-scale-table td:first-child {
            text-align: left !important;
            padding-left: 4px !important;
          }
          .print-scale-table thead th {
            background: #f1f5f9 !important;
            font-weight: 600 !important;
            padding: 3px 2px !important;
          }
          .print-scale-table thead th .print-dow {
            display: block !important;
            font-weight: 400 !important;
            font-size: 7px !important;
            text-transform: uppercase !important;
            letter-spacing: 0.04em !important;
            color: #64748b !important;
          }
          .print-scale-table .print-wknd {
            background: #e2e8f0 !important;
          }
          .print-scale-table thead th.print-wknd {
            background: #cbd5e1 !important;
          }
          .print-scale-table thead th.print-wknd .print-dow {
            color: #475569 !important;
            font-weight: 600 !important;
          }
          .print-scale-table .print-name {
            font-weight: 600 !important;
            white-space: nowrap !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="no-print">
        <button
          onClick={() => router.push("/team/escalas")}
          className="flex items-center gap-1 text-xs text-stone-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 mb-2 transition-all duration-200"
        >
          <ChevronLeft size={14} /> Voltar para Escalas
        </button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-600 dark:text-teal-400">
              Escala Assistencial
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-slate-100 tracking-tight">
              Escala Personalizada (Grade Manual)
            </h1>
            <p className="text-stone-500 dark:text-slate-400 mt-1 text-sm max-w-2xl">
              Monte a escala com total liberdade clicando nas células para alternar entre Trabalha e Folga.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-teal-800 dark:bg-teal-700 text-white text-xs font-mono px-3.5 py-2 rounded-full whitespace-nowrap">
            Grade Editável Manual
          </span>
        </div>
      </div>

      {/* Painel Superior de Configuração e Ações */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm p-5 sm:p-6 no-print space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Mês de Referência
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-stone-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Identificação do Turno / Setor
            </label>
            <input
              type="text"
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              placeholder="Ex: Enfermagem Geral — Turno Noturno"
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-stone-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Atalhos Rápidos de Preenchimento */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-stone-500 dark:text-slate-400 flex items-center gap-1 mr-1">
            <Sparkles size={13} className="text-teal-600 dark:text-teal-400" /> Ações Rápidas:
          </span>
          <button
            type="button"
            onClick={preencherDiasUteis}
            className="px-3 py-1.5 bg-stone-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-stone-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 rounded-lg text-xs font-medium transition-colors border border-stone-200 dark:border-slate-700"
          >
            Preencher Dias Úteis (Seg-Sex)
          </button>
          <button
            type="button"
            onClick={marcarTodosTrabalham}
            className="px-3 py-1.5 bg-stone-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-stone-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 rounded-lg text-xs font-medium transition-colors border border-stone-200 dark:border-slate-700"
          >
            Todos Trabalham
          </button>
          <button
            type="button"
            onClick={marcarTodosFolgam}
            className="px-3 py-1.5 bg-stone-100 dark:bg-slate-800 hover:bg-stone-200 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 rounded-lg text-xs font-medium transition-colors border border-stone-200 dark:border-slate-700"
          >
            Todos Folgam
          </button>
        </div>

        {/* Adicionar Colaborador */}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-slate-800">
          <input
            type="text"
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarMembro();
              }
            }}
            placeholder="Adicionar novo colaborador à grade..."
            className="flex-1 max-w-sm px-3 py-1.5 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg text-xs"
          />
          <button
            type="button"
            onClick={adicionarMembro}
            className="px-3 py-1.5 bg-stone-800 dark:bg-slate-700 text-white rounded-lg text-xs font-semibold hover:bg-stone-900 flex items-center gap-1"
          >
            <UserPlus size={13} /> Adicionar
          </button>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone-100 dark:border-slate-800">
          <button
            type="button"
            onClick={salvarMes}
            disabled={saving || members.length === 0}
            className="flex items-center gap-2 bg-stone-900 hover:bg-stone-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all duration-200"
          >
            <Save size={16} /> {saving ? "Salvando..." : "Salvar Mês"}
          </button>
          <button
            type="button"
            onClick={() => {
              carregarMeses();
              setShowArchive(true);
            }}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
          >
            <FolderOpen size={16} /> Meses Salvos
          </button>
          <button
            type="button"
            onClick={exportarCSV}
            disabled={members.length === 0}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => printDocument("Escala_Personalizada_Enfermagem")}
            disabled={members.length === 0}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>

        {saveMsg && (
          <p className="text-xs font-mono text-teal-600 dark:text-teal-400 font-semibold">{saveMsg}</p>
        )}
      </div>

      {/* Grade Manual Interativa */}
      {members.length > 0 && days.length > 0 && (
        <div className="space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center font-bold text-[9px]">
                  T
                </span>
                Trabalha (Clique para alternar)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-4 h-4 rounded bg-stone-200 dark:bg-slate-700 text-stone-700 dark:text-slate-300 flex items-center justify-center font-bold text-[9px]">
                  F
                </span>
                Folga (Clique para alternar)
              </span>
            </div>
            <p className="text-stone-500 dark:text-slate-400">
              * Cada célula é um botão interativo: verde = Trabalha / cinza = Folga.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 dark:bg-slate-800/80 text-stone-700 dark:text-slate-300 border-b border-stone-200 dark:border-slate-700">
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-stone-100 dark:bg-slate-800 z-10 min-w-[180px]">
                    Colaborador
                  </th>
                  <th className="px-2 py-2.5 text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                    Ações
                  </th>
                  {days.map((d, di) => {
                    const isWknd = d.dow === 0 || d.dow === 6;
                    return (
                      <th
                        key={di}
                        className={`px-1 py-2 min-w-[32px] border-l border-stone-200 dark:border-slate-700 ${
                          isWknd ? "bg-stone-200/70 dark:bg-slate-700/60" : ""
                        }`}
                      >
                        <span className="font-bold text-xs">{d.dayNum}</span>
                        <span className="block text-[9px] uppercase font-mono text-stone-500 dark:text-slate-400">
                          {DOW[d.dow]}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {members.map((name, i) => (
                  <tr
                    key={`p-${i}`}
                    className="border-b border-stone-100 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="text-left px-3 py-2 font-medium text-stone-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">{name}</span>
                        <button
                          type="button"
                          onClick={() => removerMembro(i)}
                          className="p-1 text-red-400 hover:text-red-600 rounded"
                          title="Remover da grade"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={() => alterarLinhaColaborador(i, "T")}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          title="Preencher toda linha como Trabalha"
                        >
                          Tudo T
                        </button>
                        <button
                          type="button"
                          onClick={() => alterarLinhaColaborador(i, "F")}
                          className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-stone-100 text-stone-700 hover:bg-stone-200"
                          title="Preencher toda linha como Folga"
                        >
                          Tudo F
                        </button>
                      </div>
                    </td>
                    {days.map((d, di) => {
                      const isWknd = d.dow === 0 || d.dow === 6;
                      const val = cells[i]?.[di] || "F";
                      return (
                        <td
                          key={di}
                          onClick={() => toggleCell(i, di)}
                          className={`p-1 border-l border-stone-200 dark:border-slate-800 cursor-pointer select-none transition-colors ${
                            isWknd ? "bg-stone-50/70 dark:bg-slate-800/40" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs transition-all ${
                              val === "T" ? CELL_CLASS.T : CELL_CLASS.F
                            }`}
                            title={`Clique para alternar (${val === "T" ? "Trabalha" : "Folga"})`}
                          >
                            {val}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {members.map((name, i) => {
              const plantoes = (cells[i] || []).filter((c) => c === "T").length;
              const folgas = days.length - plantoes;
              return (
                <div
                  key={`sum-${i}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-800 p-3"
                >
                  <p className="text-xs font-bold text-stone-900 dark:text-slate-100 truncate">{name}</p>
                  <div className="mt-2 text-[11px] font-mono space-y-0.5 text-stone-600 dark:text-slate-400">
                    <p>Dias trabalhados: <strong>{plantoes}</strong></p>
                    <p>Dias de folga: <strong>{folgas}</strong></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Versão para Impressão */}
      {members.length > 0 && days.length > 0 && (
        <div className="hidden print:block print-scale">
          <div className="text-center border-b-2 border-stone-900 pb-2 mb-3">
            {hospitalName && <h1 className="text-xl font-bold text-stone-900">{hospitalName}</h1>}
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              Escala Mensal Personalizada de Plantão
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              {shiftLabel} ·{" "}
              {days.length > 0 &&
                `${new Date(days[0].date).toLocaleDateString("pt-BR")} a ${new Date(
                  days[days.length - 1].date
                ).toLocaleDateString("pt-BR")}`}{" "}
              · {days.length} dias
            </p>
            <p className="text-[10px] text-stone-500">
              Emitido em {new Date().toLocaleString("pt-BR")}
            </p>
          </div>

          <table className="print-scale-table w-full">
            <thead>
              <tr>
                <th className="text-left">Colaborador</th>
                {days.map((d, idx) => {
                  const wknd = d.dow === 0 || d.dow === 6;
                  return (
                    <th key={idx} className={wknd ? "print-wknd" : ""}>
                      {d.dayNum}
                      <span className="print-dow">{DOW[d.dow]}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {members.map((name, i) => (
                <tr key={`print-row-${i}`}>
                  <td>
                    <span className="print-name">{name}</span>
                  </td>
                  {days.map((day, di) => {
                    const wknd = day.dow === 0 || day.dow === 6;
                    const cell = cells[i]?.[di] || "F";
                    return (
                      <td
                        key={di}
                        className={`${cell === "T" ? "font-bold" : ""} ${
                          wknd ? "print-wknd" : ""
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[9px] text-stone-600 mt-2">
            T = Trabalha · F = Folga
          </p>

          <div className="flex justify-between gap-6 text-[11px] print-signatures">
            <div className="text-center flex-1">
              <div className="font-semibold text-stone-900">Coordenador(a) de Enfermagem</div>
              <div className="mt-10 border-t border-stone-800 pt-1 text-stone-600">Nome e assinatura</div>
            </div>
            <div className="text-center flex-1">
              <div className="font-semibold text-stone-900">Gerência / Direção</div>
              <div className="mt-10 border-t border-stone-800 pt-1 text-stone-600">Nome e assinatura</div>
            </div>
            <div className="text-center flex-1">
              <div className="font-semibold text-stone-900">Equipe / Colaboradores</div>
              <div className="mt-10 border-t border-stone-800 pt-1 text-stone-600">Ciência da escala</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Meses Salvos */}
      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-stone-900 dark:text-slate-100">
                Escalas Personalizadas Salvas
              </h3>
              <button
                onClick={() => setShowArchive(false)}
                className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2">
              {loadingMonth ? (
                <p className="text-sm text-stone-500 font-mono">Carregando…</p>
              ) : savedMonths.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Nenhuma escala personalizada salva ainda. Monte uma grade e use "Salvar Mês".
                </p>
              ) : (
                savedMonths.map((m) => {
                  const clean = extractScaleMonth(m.month);
                  const [y, mm] = clean.split("-").map(Number);
                  const nome = new Date(y, (mm || 1) - 1, 1).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 border border-stone-200 dark:border-slate-700 rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-stone-900 dark:text-slate-100 capitalize">
                          {nome}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-slate-400 font-mono">
                          {clean} · salvo em {new Date(m.savedAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => carregarMes(m.month)}
                          className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium hover:bg-teal-700"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => excluirMes(m.month)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-slate-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-slate-800"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
