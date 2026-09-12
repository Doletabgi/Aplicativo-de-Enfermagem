"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Download,
  Printer,
  Clock,
  CalendarDays,
  CheckCircle2,
  Save,
  FolderOpen,
  X,
  ArrowRightLeft,
  UserPlus,
  Trash2,
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

interface Scale12x36Result {
  groupANames: string[];
  groupBNames: string[];
  days: DayEntry[];
  shiftLabel: string;
  groupACells: string[][];
  groupBCells: string[][];
  firstDayGroup: "A" | "B";
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

export default function GeradorEscala12x36() {
  const router = useRouter();

  const [month, setMonth] = useState("");
  const [shiftLabel, setShiftLabel] = useState("Enfermagem — Plantão 12x36");
  const [firstDayGroup, setFirstDayGroup] = useState<"A" | "B">("A");

  const [groupA, setGroupA] = useState<string[]>([]);
  const [groupB, setGroupB] = useState<string[]>([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberGroup, setNewMemberGroup] = useState<"A" | "B">("A");

  const [result, setResult] = useState<Scale12x36Result | null>(null);
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
      .then((members) => {
        const active = members.filter((m) => m.active);
        if (active.length > 0) {
          const half = Math.ceil(active.length / 2);
          setGroupA(active.slice(0, half).map((m) => m.name));
          setGroupB(active.slice(half).map((m) => m.name));
        } else {
          setGroupA(["Enf. Camila Rocha", "Téc. Gabriel Alves", "Téc. Juliana Prado"]);
          setGroupB(["Enf. Lucas Martins", "Téc. Mariana Sousa", "Téc. Rafael Dias"]);
        }
      })
      .catch(() => {
        setGroupA(["Enf. Camila Rocha", "Téc. Gabriel Alves"]);
        setGroupB(["Enf. Lucas Martins", "Téc. Mariana Sousa"]);
      });
  }, []);

  const moverPara = (name: string, from: "A" | "B") => {
    if (from === "A") {
      setGroupA((prev) => prev.filter((n) => n !== name));
      setGroupB((prev) => [...prev, name]);
    } else {
      setGroupB((prev) => prev.filter((n) => n !== name));
      setGroupA((prev) => [...prev, name]);
    }
  };

  const removerMembro = (name: string, group: "A" | "B") => {
    if (group === "A") setGroupA((prev) => prev.filter((n) => n !== name));
    else setGroupB((prev) => prev.filter((n) => n !== name));
  };

  const adicionarMembro = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (groupA.includes(trimmed) || groupB.includes(trimmed)) {
      alert("Este colaborador já está em um dos grupos.");
      return;
    }
    if (newMemberGroup === "A") setGroupA((prev) => [...prev, trimmed]);
    else setGroupB((prev) => [...prev, trimmed]);
    setNewMemberName("");
  };

  const gerarEscala = () => {
    if (!month) {
      alert("Selecione o mês da escala.");
      return;
    }
    if (groupA.length === 0 && groupB.length === 0) {
      alert("Adicione ao menos um colaborador no Grupo A ou no Grupo B.");
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

    // Regra 12x36:
    // Se no dia 1 trabalha o Grupo A:
    // Dias ímpares (1, 3, 5, ...): Grupo A = T, Grupo B = F
    // Dias pares (2, 4, 6, ...): Grupo A = F, Grupo B = T
    // Se no dia 1 trabalha o Grupo B:
    // Dias ímpares: Grupo B = T, Grupo A = F
    // Dias pares: Grupo B = F, Grupo A = T
    const groupACells: string[][] = groupA.map(() => []);
    const groupBCells: string[][] = groupB.map(() => []);

    for (let d = 1; d <= daysInMonth; d++) {
      const isOdd = d % 2 === 1;
      const groupAWorks = firstDayGroup === "A" ? isOdd : !isOdd;
      const groupBWorks = !groupAWorks;

      groupA.forEach((_, i) => {
        groupACells[i].push(groupAWorks ? "T" : "F");
      });
      groupB.forEach((_, j) => {
        groupBCells[j].push(groupBWorks ? "T" : "F");
      });
    }

    setResult({
      groupANames: groupA,
      groupBNames: groupB,
      days,
      shiftLabel: shiftLabel.trim() || "Enfermagem — Plantão 12x36",
      groupACells,
      groupBCells,
      firstDayGroup,
    });
  };

  const cycleStatus = (group: "A" | "B", memberIdx: number, dayIdx: number) => {
    if (!result) return;
    const cells = group === "A" ? result.groupACells : result.groupBCells;
    const cur = cells[memberIdx][dayIdx];
    const next = cur === "T" ? "F" : "T";
    const updated = cells.map((row, ri) => (ri === memberIdx ? [...row] : row));
    updated[memberIdx][dayIdx] = next;

    if (group === "A") {
      setResult({ ...result, groupACells: updated });
    } else {
      setResult({ ...result, groupBCells: updated });
    }
  };

  const monthKey = month ? `12x36:${month}` : "";

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
        firstDayGroup: result.firstDayGroup,
        groupANames: result.groupANames,
        groupBNames: result.groupBNames,
        groupACells: result.groupACells,
        groupBCells: result.groupBCells,
        days: result.days.map((d) => ({
          iso: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(
            d.date.getDate()
          ).padStart(2, "0")}`,
          dow: d.dow,
          dayNum: d.dayNum,
        })),
      });
      await saveScale(monthKey, data);
      setSaveMsg("Escala 12x36 salva com sucesso!");
      carregarMeses();
    } catch {
      setSaveMsg("Erro ao salvar a escala.");
    } finally {
      setSaving(false);
    }
  };

  const carregarMeses = async () => {
    try {
      setSavedMonths(await listScalesByType("12x36"));
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
        shiftLabel: data.shiftLabel || "Enfermagem — Plantão 12x36",
        firstDayGroup: data.firstDayGroup || "A",
        groupANames: data.groupANames || [],
        groupBNames: data.groupBNames || [],
        groupACells: data.groupACells || [],
        groupBCells: data.groupBCells || [],
        days: (data.days || []).map((d: { iso: string; dow: number; dayNum: number }) => ({
          date: new Date(d.iso + "T00:00:00"),
          dow: d.dow,
          dayNum: d.dayNum,
        })),
      });
      setGroupA(data.groupANames || []);
      setGroupB(data.groupBNames || []);
      setFirstDayGroup(data.firstDayGroup || "A");
      setShiftLabel(data.shiftLabel || "Enfermagem — Plantão 12x36");
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
    if (!confirm(`Excluir a escala 12x36 salva de ${clean}?`)) return;
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
    const { groupANames, groupBNames, days, shiftLabel: label, groupACells, groupBCells } = result;
    const rows: string[][] = [];
    const header = [
      label || "Plantão 12x36",
      "Grupo",
      ...days.map((d) => `${String(d.dayNum).padStart(2, "0")}/${fmtDate(d.date).slice(3)} (${DOW[d.dow]})`),
    ];
    rows.push(header);

    groupANames.forEach((name, i) => {
      const row = [name, "Grupo A"];
      days.forEach((_, di) => {
        row.push(groupACells[i][di] === "T" ? "Trabalha" : "FOLGA");
      });
      rows.push(row);
    });

    groupBNames.forEach((name, j) => {
      const row = [name, "Grupo B"];
      days.forEach((_, di) => {
        row.push(groupBCells[j][di] === "T" ? "Trabalha" : "FOLGA");
      });
      rows.push(row);
    });

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escala-12x36-${month || "mes"}.csv`;
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
          .print-scale-table .print-group {
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
              Gerador de Escala 12x36
            </h1>
            <p className="text-stone-500 dark:text-slate-400 mt-1 text-sm max-w-2xl">
              Alternância dia sim / dia não (12h de trabalho por 36h de descanso) dividida em Grupo A e Grupo B.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-teal-800 dark:bg-teal-700 text-white text-xs font-mono px-3.5 py-2 rounded-full whitespace-nowrap">
            12h Trabalho · 36h Descanso
          </span>
        </div>
      </div>

      {/* Configuração */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm p-5 sm:p-6 no-print space-y-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-slate-100">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-mono">
            1
          </span>
          Configuração do Mês e Início do Plantão
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              Quem trabalha no Dia 01?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFirstDayGroup("A")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  firstDayGroup === "A"
                    ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                    : "bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-slate-300 border-stone-200 dark:border-slate-700"
                }`}
              >
                Grupo A
              </button>
              <button
                type="button"
                onClick={() => setFirstDayGroup("B")}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                  firstDayGroup === "B"
                    ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                    : "bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-slate-300 border-stone-200 dark:border-slate-700"
                }`}
              >
                Grupo B
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Identificação do Turno / Setor
            </label>
            <input
              type="text"
              value={shiftLabel}
              onChange={(e) => setShiftLabel(e.target.value)}
              placeholder="Ex: UTI Adulto — Turno Diurno"
              className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 text-stone-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Divisão dos Grupos A e B */}
        <div className="pt-4 border-t border-stone-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-slate-100">
              Divisão da Equipe (Grupo A e Grupo B)
            </h3>
            <span className="text-xs text-stone-500 dark:text-slate-400">
              Total: {groupA.length + groupB.length} colaboradores
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bloco Grupo A */}
            <div className="p-4 rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/30 dark:bg-teal-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  Grupo A ({groupA.length})
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-mono">
                  {firstDayGroup === "A" ? "Inicia dia 01" : "Folga dia 01"}
                </span>
              </div>

              {groupA.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Nenhum membro no Grupo A</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {groupA.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-slate-700 text-xs text-stone-800 dark:text-slate-200"
                    >
                      <span className="truncate font-medium">{name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moverPara(name, "A")}
                          className="px-2 py-1 bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-slate-300 rounded hover:bg-teal-600 hover:text-white transition-colors text-[10px] font-semibold flex items-center gap-1"
                          title="Mover para Grupo B"
                        >
                          p/ Grupo B <ArrowRightLeft size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removerMembro(name, "A")}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco Grupo B */}
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Grupo B ({groupB.length})
                </span>
                <span className="text-[11px] text-blue-700 dark:text-blue-400 font-mono">
                  {firstDayGroup === "B" ? "Inicia dia 01" : "Folga dia 01"}
                </span>
              </div>

              {groupB.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2">Nenhum membro no Grupo B</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {groupB.map((name) => (
                    <div
                      key={name}
                      className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-slate-700 text-xs text-stone-800 dark:text-slate-200"
                    >
                      <span className="truncate font-medium">{name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moverPara(name, "B")}
                          className="px-2 py-1 bg-stone-100 dark:bg-slate-700 text-stone-600 dark:text-slate-300 rounded hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-semibold flex items-center gap-1"
                          title="Mover para Grupo A"
                        >
                          <ArrowRightLeft size={10} /> p/ Grupo A
                        </button>
                        <button
                          type="button"
                          onClick={() => removerMembro(name, "B")}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                          title="Remover"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Adicionar Colaborador Rápido */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
              className="flex-1 min-w-[200px] px-3 py-1.5 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg text-xs"
            />
            <select
              value={newMemberGroup}
              onChange={(e) => setNewMemberGroup(e.target.value as "A" | "B")}
              className="px-2.5 py-1.5 bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="A">Grupo A</option>
              <option value="B">Grupo B</option>
            </select>
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
            <Clock size={16} /> Gerar Escala 12x36
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
            onClick={() => printDocument("Escala_12x36_Enfermagem")}
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
                Trabalha (Plantão 12h)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-[9px]">
                  F
                </span>
                Folga (36h Descanso)
              </span>
            </div>
            <p className="text-stone-500 dark:text-slate-400">
              * Clique em uma célula para alternar o status manualmente se necessário.
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
                    Grupo
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
                {/* Linhas Grupo A */}
                {result.groupANames.map((name, i) => (
                  <tr
                    key={`ga-${i}`}
                    className="border-b border-stone-100 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="text-left px-3 py-2 font-medium text-stone-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                      {name}
                    </td>
                    <td className="px-2 py-2 text-[10px] font-bold text-teal-700 dark:text-teal-400">
                      Grupo A
                    </td>
                    {result.days.map((d, di) => {
                      const isWknd = d.dow === 0 || d.dow === 6;
                      const val = result.groupACells[i][di];
                      return (
                        <td
                          key={di}
                          onClick={() => cycleStatus("A", i, di)}
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
                ))}

                {/* Separador Grupo B */}
                <tr className="bg-stone-50 dark:bg-slate-800/50">
                  <td
                    colSpan={result.days.length + 2}
                    className="px-3 py-1.5 text-left text-[11px] font-bold text-stone-600 dark:text-slate-400 uppercase tracking-wider"
                  >
                    Integrantes do Grupo B
                  </td>
                </tr>

                {/* Linhas Grupo B */}
                {result.groupBNames.map((name, j) => (
                  <tr
                    key={`gb-${j}`}
                    className="border-b border-stone-100 dark:border-slate-800 hover:bg-stone-50/50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="text-left px-3 py-2 font-medium text-stone-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10">
                      {name}
                    </td>
                    <td className="px-2 py-2 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                      Grupo B
                    </td>
                    {result.days.map((d, di) => {
                      const isWknd = d.dow === 0 || d.dow === 6;
                      const val = result.groupBCells[j][di];
                      return (
                        <td
                          key={di}
                          onClick={() => cycleStatus("B", j, di)}
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {result.groupANames.map((name, i) => {
              const plantoes = result.groupACells[i].filter((c) => c === "T").length;
              const folgas = result.days.length - plantoes;
              return (
                <div
                  key={`sum-a-${i}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-teal-200 dark:border-teal-900/40 p-3"
                >
                  <p className="text-xs font-bold text-stone-900 dark:text-slate-100 truncate">{name}</p>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400">Grupo A</span>
                  <div className="mt-2 text-[11px] font-mono space-y-0.5 text-stone-600 dark:text-slate-400">
                    <p>Plantões: <strong>{plantoes}</strong></p>
                    <p>Folgas: <strong>{folgas}</strong></p>
                  </div>
                </div>
              );
            })}
            {result.groupBNames.map((name, j) => {
              const plantoes = result.groupBCells[j].filter((c) => c === "T").length;
              const folgas = result.days.length - plantoes;
              return (
                <div
                  key={`sum-b-${j}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-blue-200 dark:border-blue-900/40 p-3"
                >
                  <p className="text-xs font-bold text-stone-900 dark:text-slate-100 truncate">{name}</p>
                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">Grupo B</span>
                  <div className="mt-2 text-[11px] font-mono space-y-0.5 text-stone-600 dark:text-slate-400">
                    <p>Plantões: <strong>{plantoes}</strong></p>
                    <p>Folgas: <strong>{folgas}</strong></p>
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
              Escala de Plantão 12x36 (Grupos A e B)
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
                <th>Grupo</th>
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
              {result.groupANames.map((name, i) => (
                <tr key={`p-a-${i}`}>
                  <td>
                    <span className="print-name">{name}</span>
                  </td>
                  <td>
                    <span className="print-group">Grupo A</span>
                  </td>
                  {result.days.map((day, di) => {
                    const wknd = day.dow === 0 || day.dow === 6;
                    const cell = result.groupACells[i][di];
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
              <tr>
                <td colSpan={result.days.length + 2} className="bg-stone-100 text-left font-bold">
                  GRUPO B
                </td>
              </tr>
              {result.groupBNames.map((name, j) => (
                <tr key={`p-b-${j}`}>
                  <td>
                    <span className="print-name">{name}</span>
                  </td>
                  <td>
                    <span className="print-group">Grupo B</span>
                  </td>
                  {result.days.map((day, di) => {
                    const wknd = day.dow === 0 || day.dow === 6;
                    const cell = result.groupBCells[j][di];
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
            T = Plantão Trabalhado (12 horas) · F = Folga / Descanso (36 horas)
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
                Escalas 12x36 Salvas
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
                  Nenhuma escala 12x36 salva ainda. Gere uma escala e use "Salvar Mês".
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
