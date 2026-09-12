"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Printer,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Save,
  FolderOpen,
  X,
  UserPlus,
  Trash2,
  AlertCircle,
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
const DOW_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface DayEntry {
  date: Date;
  dow: number;
  dayNum: number;
}

interface Scale5x2Result {
  memberNames: string[];
  memberRestDays: Record<string, number[]>;
  days: DayEntry[];
  shiftLabel: string;
  cells: string[][];
}

const CELL_CLASS = {
  T: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold",
  F: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-medium",
};

function fmtDate(date: Date): string {
  return (
    String(date.getDate()).padStart(2, "0") +
    "/" +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

export default function GeradorEscala5x2() {
  const router = useRouter();

  const [month, setMonth] = useState("");
  const [shiftLabel, setShiftLabel] = useState("Enfermagem — Jornada 5x2");

  const [members, setMembers] = useState<string[]>([]);
  const [memberRestDays, setMemberRestDays] = useState<Record<string, number[]>>({});
  const [newMemberName, setNewMemberName] = useState("");

  const [result, setResult] = useState<Scale5x2Result | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [savedMonths, setSavedMonths] = useState<
    { id: string; month: string; savedAt: string }[]
  >([]);
  const [showArchive, setShowArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loadingMonth, setLoadingMonth] = useState(false);

  useEffect(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    setMonth(`${y}-${m}`);

    getSettings()
      .then((s) => setHospitalName(s.hospitalName || ""))
      .catch(() => {});

    // Carrega membros ativos
    listTeamMembers()
      .then((team) => {
        const active = team.filter((m) => m.active);
        const names =
          active.length > 0
            ? active.map((m) => m.name)
            : ["Ana Souza", "Bruno Lima", "Carla Nunes", "Diego Ramos", "Elaine Costa"];
        setMembers(names);

        // Predefinir 2 folgas para cada um de forma equilibrada
        const initialRest: Record<string, number[]> = {};
        const presets = [
          [0, 6], // Dom e Sáb
          [1, 2], // Seg e Ter
          [3, 4], // Qua e Qui
          [5, 6], // Sex e Sáb
          [0, 1], // Dom e Seg
        ];
        names.forEach((name, idx) => {
          initialRest[name] = presets[idx % presets.length];
        });
        setMemberRestDays(initialRest);
      })
      .catch(() => {
        const defaultNames = ["Ana Souza", "Bruno Lima", "Carla Nunes"];
        setMembers(defaultNames);
        setMemberRestDays({
          "Ana Souza": [0, 6],
          "Bruno Lima": [1, 2],
          "Carla Nunes": [3, 4],
        });
      });
  }, []);

  const toggleDayRest = (memberName: string, dowIdx: number) => {
    setMemberRestDays((prev) => {
      const current = prev[memberName] || [];
      if (current.includes(dowIdx)) {
        // Desmarcar
        return {
          ...prev,
          [memberName]: current.filter((d) => d !== dowIdx),
        };
      } else {
        // Se já tiver 2 marcados, remove o mais antigo e adiciona o novo
        let next: number[];
        if (current.length >= 2) {
          next = [current[1], dowIdx];
        } else {
          next = [...current, dowIdx];
        }
        return {
          ...prev,
          [memberName]: next,
        };
      }
    });
  };

  const aplicarPreset = (memberName: string, days: [number, number]) => {
    setMemberRestDays((prev) => ({
      ...prev,
      [memberName]: days,
    }));
  };

  const adicionarMembro = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (members.includes(trimmed)) {
      alert("Colaborador já adicionado.");
      return;
    }
    setMembers((prev) => [...prev, trimmed]);
    setMemberRestDays((prev) => ({
      ...prev,
      [trimmed]: [0, 6], // Padrão Sáb e Dom
    }));
    setNewMemberName("");
  };

  const removerMembro = (name: string) => {
    setMembers((prev) => prev.filter((m) => m !== name));
    setMemberRestDays((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const gerarEscala = () => {
    if (!month) {
      alert("Selecione o mês da escala.");
      return;
    }
    if (members.length === 0) {
      alert("Adicione ao menos um colaborador.");
      return;
    }

    // Validar se todos têm exatamente 2 dias de folga
    const invalid = members.filter((m) => (memberRestDays[m] || []).length !== 2);
    if (invalid.length > 0) {
      alert(
        `Os seguintes colaboradores precisam ter exatamente 2 dias de folga selecionados:\n${invalid.join(
          ", "
        )}`
      );
      return;
    }

    const [y, mm] = month.split("-").map(Number);
    const daysInMonth = new Date(y, mm, 0).getDate();

    const days: DayEntry[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, mm - 1, d);
      days.push({
        date,
        dow: date.getDay(),
        dayNum: d,
      });
    }

    // Para cada colaborador, em cada dia: se o dia da semana estiver nas suas 2 folgas fixas -> F, senão -> T
    const cells: string[][] = members.map((name) => {
      const rest = memberRestDays[name] || [];
      return days.map((d) => (rest.includes(d.dow) ? "F" : "T"));
    });

    setResult({
      memberNames: members,
      memberRestDays,
      days,
      shiftLabel: shiftLabel.trim() || "Enfermagem — Jornada 5x2",
      cells,
    });
  };

  const cycleStatus = (memberIdx: number, dayIdx: number) => {
    if (!result) return;
    const cur = result.cells[memberIdx][dayIdx];
    const next = cur === "T" ? "F" : "T";
    const updated = result.cells.map((row, ri) => (ri === memberIdx ? [...row] : row));
    updated[memberIdx][dayIdx] = next;
    setResult({ ...result, cells: updated });
  };

  const monthKey = month ? `5x2:${month}` : "";

  const salvarMes = async () => {
    if (!result) {
      alert("Gere a escala primeiro.");
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
        shiftLabel: result.shiftLabel,
        memberNames: result.memberNames,
        memberRestDays: result.memberRestDays,
        cells: result.cells,
        days: result.days.map((d) => ({
          iso: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(
            d.date.getDate()
          ).padStart(2, "0")}`,
          dow: d.dow,
          dayNum: d.dayNum,
        })),
      });
      await saveScale(monthKey, data);
      setSaveMsg("Escala 5x2 salva com sucesso!");
      carregarMeses();
    } catch {
      setSaveMsg("Erro ao salvar a escala.");
    } finally {
      setSaving(false);
    }
  };

  const carregarMeses = async () => {
    try {
      setSavedMonths(await listScalesByType("5x2"));
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
      setResult({
        shiftLabel: data.shiftLabel || "Enfermagem — Jornada 5x2",
        memberNames: data.memberNames || [],
        memberRestDays: data.memberRestDays || {},
        cells: data.cells || [],
        days: (data.days || []).map((d: { iso: string; dow: number; dayNum: number }) => ({
          date: new Date(d.iso + "T00:00:00"),
          dow: d.dow,
          dayNum: d.dayNum,
        })),
      });
      setMembers(data.memberNames || []);
      setMemberRestDays(data.memberRestDays || {});
      setShiftLabel(data.shiftLabel || "Enfermagem — Jornada 5x2");
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
    if (!confirm(`Excluir a escala 5x2 salva de ${clean}?`)) return;
    try {
      await deleteScale(rawMonthKey);
      carregarMeses();
    } catch {}
  };

  const exportarCSV = () => {
    if (!result) {
      alert("Gere a escala primeiro.");
      return;
    }
    const { memberNames, memberRestDays: rDays, days, shiftLabel: label, cells } = result;
    const rows: string[][] = [];
    const header = [
      label || "Jornada 5x2",
      "Folgas Fixas",
      ...days.map((d) => `${String(d.dayNum).padStart(2, "0")}/${fmtDate(d.date).slice(3)} (${DOW[d.dow]})`),
    ];
    rows.push(header);

    memberNames.forEach((name, i) => {
      const folgaLabel = (rDays[name] || []).map((dow) => DOW[dow]).join(" / ");
      const row = [name, folgaLabel];
      days.forEach((_, di) => {
        row.push(cells[i][di] === "T" ? "Trabalha" : "FOLGA");
      });
      rows.push(row);
    });

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-5x2-${month || "mes"}.csv`;
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
          .print-scale-table .print-rest {
            font-size: 7px !important;
            font-weight: 400 !important;
            color: #64748b !important;
            display: block !important;
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
              Gerador de Escala 5x2
            </h1>
            <p className="text-stone-500 dark:text-slate-400 mt-1 text-sm max-w-2xl">
              Jornada de 5 dias de trabalho por 2 dias de folga semanal, com os 2 dias de descanso definidos individualmente para cada profissional.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-teal-800 dark:bg-teal-700 text-white text-xs font-mono px-3.5 py-2 rounded-full whitespace-nowrap">
            5 Trabalhos · 2 Folgas / sem
          </span>
        </div>
      </div>

      {/* Configuração */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm p-5 sm:p-6 no-print space-y-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-slate-100">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-mono">
            1
          </span>
          Configuração do Mês e Folgas Individuais
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Mês da Escala
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
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
              placeholder="Ex: Ambulatório — Segunda a Sexta"
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-stone-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Escolha das 2 folgas semanais por colaborador */}
        <div className="pt-4 border-t border-stone-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-slate-100">
                Folgas Semanais por Colaborador
              </h3>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Selecione exatamente <strong>2 dias de descanso</strong> para cada membro da equipe. O padrão se repetirá todas as semanas do mês.
              </p>
            </div>
            <span className="text-xs text-stone-500 dark:text-slate-400 font-medium">
              {members.length} colaboradores
            </span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {members.map((name) => {
              const currentRest = memberRestDays[name] || [];
              const isValid = currentRest.length === 2;

              return (
                <div
                  key={name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-50/70 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl"
                >
                  <div className="flex items-center justify-between sm:justify-start gap-2 min-w-[180px]">
                    <span className="font-semibold text-xs text-stone-800 dark:text-slate-200 truncate">
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerMembro(name)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded sm:ml-1"
                      title="Remover"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Botões dos 7 dias da semana */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DOW.map((dayLabel, dowIdx) => {
                      const isSelected = currentRest.includes(dowIdx);
                      return (
                        <button
                          key={dowIdx}
                          type="button"
                          onClick={() => toggleDayRest(name, dowIdx)}
                          className={`w-9 h-8 rounded-lg text-xs font-bold transition-all border ${
                            isSelected
                              ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                              : "bg-white dark:bg-slate-800 text-stone-600 dark:text-slate-400 border-stone-200 dark:border-slate-700 hover:border-amber-400"
                          }`}
                          title={`Folga em ${DOW_FULL[dowIdx]}`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>

                  {/* Status das 2 folgas e presets */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isValid
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                      }`}
                    >
                      {!isValid && <AlertCircle size={10} />}
                      {currentRest.length}/2 dias
                    </span>

                    <button
                      type="button"
                      onClick={() => aplicarPreset(name, [0, 6])}
                      className="text-[10px] text-stone-500 dark:text-slate-400 hover:text-teal-600 underline"
                      title="Definir Sábado e Domingo"
                    >
                      Sáb/Dom
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Adicionar Colaborador Rápido */}
          <div className="mt-3 flex items-center gap-2">
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
              placeholder="Nome do colaborador extra..."
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
        </div>

        {/* Botão de Geração */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-stone-100 dark:border-slate-800">
          <button
            type="button"
            onClick={gerarEscala}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition-all duration-200"
          >
            <CalendarCheck size={16} /> Gerar Grade 5x2
          </button>
          <button
            type="button"
            onClick={salvarMes}
            disabled={saving || !result}
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
            disabled={!result}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => printDocument("Escala_5x2_Enfermagem")}
            disabled={!result}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-all duration-200"
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>

        {saveMsg && (
          <p className="text-xs font-mono text-teal-600 dark:text-teal-400 font-semibold">{saveMsg}</p>
        )}
      </div>

      {/* Grade em Tela */}
      {result && (
        <div className="space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-[9px]">
                  T
                </span>
                Trabalha (Jornada Diária)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-[9px]">
                  F
                </span>
                Folga Semanal Fixa
              </span>
            </div>
            <p className="text-stone-500 dark:text-slate-400">
              * Clique em uma célula para ajustar manualmente o status.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-stone-100 dark:bg-slate-800/80 text-stone-700 dark:text-slate-300 border-b border-stone-200 dark:border-slate-700">
                  <th className="text-left px-3 py-2.5 sticky left-0 bg-stone-100 dark:bg-slate-800 z-10 min-w-[160px]">
                    Colaborador
                  </th>
                  <th className="px-2 py-2.5 text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                    Folgas Fixas
                  </th>
                  {result.days.map((d, di) => {
                    const isWknd = d.dow === 0 || d.dow === 6;
                    return (
                      <th
                        key={di}
                        className={`px-1.5 py-2 min-w-[34px] border-l border-stone-200 dark:border-slate-700 ${
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
                {result.memberNames.map((name, i) => {
                  const restDesc = (result.memberRestDays[name] || []).map((dow) => DOW[dow]).join(", ");
                  return (
                    <tr
                      key={`m-${i}`}
                      className="border-b border-stone-100 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="text-left px-3 py-2 font-medium text-stone-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                        {name}
                      </td>
                      <td className="px-2 py-2 text-[10px] font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">
                        {restDesc || "—"}
                      </td>
                      {result.days.map((d, di) => {
                        const isWknd = d.dow === 0 || d.dow === 6;
                        const val = result.cells[i][di];
                        return (
                          <td
                            key={di}
                            onClick={() => cycleStatus(i, di)}
                            className={`p-1 border-l border-stone-200 dark:border-slate-800 cursor-pointer select-none transition-colors ${
                              isWknd ? "bg-stone-50/70 dark:bg-slate-800/40" : ""
                            }`}
                          >
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs ${
                                val === "T" ? CELL_CLASS.T : CELL_CLASS.F
                              }`}
                            >
                              {val}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {result.memberNames.map((name, i) => {
              const plantoes = result.cells[i].filter((c) => c === "T").length;
              const folgas = result.days.length - plantoes;
              const restDesc = (result.memberRestDays[name] || []).map((dow) => DOW[dow]).join(", ");
              return (
                <div
                  key={`sum-${i}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-800 p-3"
                >
                  <p className="text-xs font-bold text-stone-900 dark:text-slate-100 truncate">{name}</p>
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                    Folgas: {restDesc}
                  </span>
                  <div className="mt-2 text-[11px] font-mono space-y-0.5 text-stone-600 dark:text-slate-400">
                    <p>Trabalhados: <strong>{plantoes}</strong></p>
                    <p>Folgas no mês: <strong>{folgas}</strong></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Versão para Impressão */}
      {result && (
        <div className="hidden print:block print-scale">
          <div className="text-center border-b-2 border-stone-900 pb-2 mb-3">
            {hospitalName && <h1 className="text-xl font-bold text-stone-900">{hospitalName}</h1>}
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              Escala de Jornada 5x2 (Folgas Semanais Individuais)
            </h2>
            <p className="text-xs text-stone-600 mt-0.5">
              {result.shiftLabel} ·{" "}
              {result.days.length > 0 &&
                `${new Date(result.days[0].date).toLocaleDateString("pt-BR")} a ${new Date(
                  result.days[result.days.length - 1].date
                ).toLocaleDateString("pt-BR")}`}{" "}
              · {result.days.length} dias
            </p>
            <p className="text-[10px] text-stone-500">
              Emitido em {new Date().toLocaleString("pt-BR")}
            </p>
          </div>

          <table className="print-scale-table w-full">
            <thead>
              <tr>
                <th className="text-left">Colaborador</th>
                <th>Folgas Fixas</th>
                {result.days.map((d, idx) => {
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
              {result.memberNames.map((name, i) => {
                const restDesc = (result.memberRestDays[name] || []).map((dow) => DOW[dow]).join("/");
                return (
                  <tr key={`p-${i}`}>
                    <td>
                      <span className="print-name">{name}</span>
                    </td>
                    <td>
                      <span className="print-rest">{restDesc}</span>
                    </td>
                    {result.days.map((day, di) => {
                      const wknd = day.dow === 0 || day.dow === 6;
                      const cell = result.cells[i][di];
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
                );
              })}
            </tbody>
          </table>

          <p className="text-[9px] text-stone-600 mt-2">
            T = Dia Trabalhado (Jornada 5x2) · F = Folga Semanal Fixa
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
                Escalas 5x2 Salvas
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
                  Nenhuma escala 5x2 salva ainda. Configure as folgas e use "Salvar Mês".
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
