"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Download, Printer, Wand2, CalendarDays, AlertTriangle, CheckCircle2, Save, FolderOpen, X } from "lucide-react";
import { getSettings, listScales, listScalesByType, extractScaleMonth, getScale, saveScale, deleteScale } from "@/lib/localdb";
import { printDocument } from "@/lib/print";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface DayEntry {
  date: Date;
  dow: number;
}

interface ScaleResult {
  fixedNames: string[];
  floaterNames: string[];
  days: DayEntry[];
  shiftLabel: string;
  fixedCells: string[][];
  floaterCells: string[][];
}

const CELL_CLASS: Record<"work" | "folga" | "cover" | "free", string> = {
  work: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  folga: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  cover: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  free: "bg-stone-100 text-stone-500 dark:bg-slate-800 dark:text-slate-400",
};

function parseNames(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtDate(date: Date): string {
  return (
    String(date.getDate()).padStart(2, "0") +
    "/" +
    String(date.getMonth() + 1).padStart(2, "0")
  );
}

export default function GeradorEscala6x1() {
  const router = useRouter();

  const [startDate, setStartDate] = useState("");
  const [numDays, setNumDays] = useState("30");
  const [shiftLabel, setShiftLabel] = useState("Enfermagem — Turno Manhã");
  const [fixedNames, setFixedNames] = useState(
    "Ana Souza\nBruno Lima\nCarla Nunes\nDiego Ramos\nElaine Costa\nFelipe Torres"
  );
  const [floaterNames, setFloaterNames] = useState("Gabriela Melo");
  const [result, setResult] = useState<ScaleResult | null>(null);
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
    const m = today.getMonth();
    setStartDate(`${y}-${String(m + 1).padStart(2, "0")}-01`);
    setNumDays(String(new Date(y, m + 1, 0).getDate()));
    getSettings()
      .then((s) => setHospitalName(s.hospitalName || ""))
      .catch(() => {});
  }, []);

  const gerarEscala = () => {
    const num = Math.max(7, Math.min(90, parseInt(numDays || "30", 10)));
    const label = shiftLabel.trim();
    const fixed = parseNames(fixedNames);
    const floaters = parseNames(floaterNames);

    if (!startDate) {
      alert("Escolha a data de início.");
      return;
    }
    if (fixed.length === 0) {
      alert("Informe ao menos 1 funcionário na equipe efetiva.");
      return;
    }
    if (floaters.length === 0) {
      alert("Informe ao menos 1 folguista.");
      return;
    }

    const [y, m, d] = startDate.split("-").map(Number);
    const startDateObj = new Date(y, m - 1, d);

    const fixedOffsets = fixed.map((_, i) => i % 7);
    const floaterOffsets = floaters.map((_, j) => (fixed.length + j) % 7);

    const days: DayEntry[] = [];
    const fixedCells: string[][] = fixed.map(() => []);
    const floaterCells: string[][] = floaters.map(() => []);
    let floaterPointer = 0;

    for (let dIdx = 0; dIdx < num; dIdx++) {
      const date = new Date(startDateObj);
      date.setDate(startDateObj.getDate() + dIdx);
      const dow = date.getDay();

      const fixedRest = fixedOffsets.map((off) => (dIdx + off) % 7 === 6);
      const floaterOwnRest = floaterOffsets.map((off) => (dIdx + off) % 7 === 6);

      const restingFixedIdx: number[] = [];
      fixedRest.forEach((r, i) => {
        if (r) restingFixedIdx.push(i);
      });

      const availableFloaterIdx: number[] = [];
      floaterOwnRest.forEach((r, j) => {
        if (!r) availableFloaterIdx.push(j);
      });

      const assignment: Record<number, number> = {};
      const floaterAssignedTo: Record<number, number> = {};

      let avail = [...availableFloaterIdx];
      restingFixedIdx.forEach((fi) => {
        if (avail.length === 0) return;
        const pick = avail[floaterPointer % avail.length];
        avail.splice(floaterPointer % avail.length, 1);
        floaterPointer = (floaterPointer + 1) % Math.max(1, floaters.length);
        assignment[fi] = pick;
        floaterAssignedTo[pick] = fi;
      });

      fixedCells.forEach((row, i) => {
        if (fixedRest[i]) row.push(assignment.hasOwnProperty(i) ? "F" : "F!");
        else row.push("T");
      });
      floaterCells.forEach((row, j) => {
        if (floaterOwnRest[j]) row.push("F");
        else if (floaterAssignedTo.hasOwnProperty(j)) row.push("C");
        else row.push("L");
      });

      days.push({ date, dow });
    }

    setResult({
      fixedNames: fixed,
      floaterNames: floaters,
      days,
      shiftLabel: label,
      fixedCells,
      floaterCells,
    });
  };

  const cycleStatus = (type: "fixed" | "floater", i: number, di: number) => {
    if (!result) return;
    const cells = type === "fixed" ? result.fixedCells : result.floaterCells;
    const order = type === "fixed" ? ["T", "F", "F!"] : ["F", "C", "L"];
    const cur = cells[i][di];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const updated = cells.map((row, ri) => (ri === i ? [...row] : row));
    updated[i][di] = next;
    if (type === "fixed") {
      setResult({ ...result, fixedCells: updated });
    } else {
      setResult({ ...result, floaterCells: updated });
    }
  };

  const rawMonthKey = startDate ? startDate.slice(0, 7) : "";
  const monthKey = rawMonthKey ? `6x1:${rawMonthKey}` : "";

  const salvarMes = async () => {
    if (!result) {
      alert("Gere a escala primeiro.");
      return;
    }
    if (!monthKey) {
      alert("Escolha a data de início.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const data = JSON.stringify({
        shiftLabel: result.shiftLabel,
        fixedNames: result.fixedNames,
        floaterNames: result.floaterNames,
        fixedCells: result.fixedCells,
        floaterCells: result.floaterCells,
        days: result.days.map((d) => ({
          iso: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(
            d.date.getDate()
          ).padStart(2, "0")}`,
          dow: d.dow,
        })),
      });
      await saveScale(monthKey, data);
      setSaveMsg("Mês salvo!");
      carregarMeses();
    } catch {
      setSaveMsg("Erro ao salvar o mês.");
    } finally {
      setSaving(false);
    }
  };

  const carregarMeses = async () => {
    try {
      setSavedMonths(await listScalesByType("6x1"));
    } catch {
      setSavedMonths([]);
    }
  };

  const carregarMes = async (month: string) => {
    setLoadingMonth(true);
    try {
      const record = await getScale(month);
      if (!record) throw new Error("not found");
      const data = JSON.parse(record.data);
      const fixedCells: string[][] = data.fixedCells;
      const floaterCells: string[][] = data.floaterCells;
      setResult({
        shiftLabel: data.shiftLabel || "",
        fixedNames: data.fixedNames,
        floaterNames: data.floaterNames,
        fixedCells,
        floaterCells,
        days: data.days.map((d: { iso: string; dow: number }) => ({
          date: new Date(d.iso + "T00:00:00"),
          dow: d.dow,
        })),
      });
      setStartDate(data.days[0]?.iso?.slice(0, 10) || month + "-01");
      setShowArchive(false);
    } catch {
      alert("Não foi possível carregar o mês.");
    } finally {
      setLoadingMonth(false);
    }
  };

  const excluirMes = async (month: string) => {
    if (!confirm(`Excluir a escala salva do mês ${month}?`)) return;
    try {
      await deleteScale(month);
      carregarMeses();
    } catch {}
  };

  const exportarCSV = () => {
    if (!result) {
      alert("Gere a escala primeiro.");
      return;
    }
    const { fixedNames: fixed, floaterNames: floaters, days, shiftLabel: label, fixedCells, floaterCells } = result;
    const rows: string[][] = [];
    const header = [label || "Equipe", ...days.map((d) => fmtDate(d.date) + " " + DOW[d.dow])];
    rows.push(header);

    fixed.forEach((name, i) => {
      const row = [name + " (Efetivo)"];
      days.forEach((_, di) => {
        const cell = fixedCells[i][di];
        if (cell === "F!") row.push("FOLGA (sem cobertura)");
        else if (cell === "F") row.push("FOLGA");
        else row.push("Trabalha");
      });
      rows.push(row);
    });
    floaters.forEach((name, j) => {
      const row = [name + " (Folguista)"];
      days.forEach((_, di) => {
        const cell = floaterCells[j][di];
        if (cell === "F") row.push("FOLGA");
        else if (cell === "C") row.push("Cobre");
        else row.push("Disponível");
      });
      rows.push(row);
    });

    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "escala-6x1-enfermagem.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const problemDays = result
    ? result.days
        .map((d, di) => ({
          date: d.date,
          dow: d.dow,
          uncoveredFixedIdx: result.fixedCells
            .map((row, i) => (row[di] === "F!" ? i : -1))
            .filter((i) => i >= 0),
        }))
        .filter((p) => p.uncoveredFixedIdx.length > 0)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
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
            margin-bottom: 2.5rem;
          }
          .print-scale-table {
            width: 100% !important;
            font-size: 8px !important;
            border-collapse: collapse !important;
          }
          .print-scale-table th,
          .print-scale-table td {
            border: 1px solid #94a3b8 !important;
            padding: 1.5px 2px !important;
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
          .print-scale-table .print-role {
            font-size: 7px !important;
            font-weight: 400 !important;
            color: #64748b !important;
            display: block !important;
          }
        }
      `}</style>
      <div className="no-print">
        <button
          onClick={() => router.push("/team/escalas")}
          className="flex items-center gap-1 text-xs text-stone-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-1 transition-all duration-200"
        >
          <ChevronLeft size={14} /> Voltar para Escalas
        </button>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
              Escala assistencial
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-slate-100 tracking-tight">
              Gerador de Escala 6x1 com Folguista
            </h1>
            <p className="text-stone-500 dark:text-slate-400 mt-1 text-sm max-w-2xl">
              Monta a escala mensal da equipe efetiva no regime 6x1 (6 dias trabalhados, 1 de folga, em rodízio semanal)
              e distribui automaticamente o(s) folguista(s) para cobrir cada folga, sem deixar plantão descoberto.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-stone-900 dark:bg-slate-800 text-white dark:text-slate-100 text-xs font-mono px-3.5 py-2 rounded-full whitespace-nowrap">
            6 × 1 · rodízio semanal
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm p-5 sm:p-6 no-print">
        <h2 className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-slate-100 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-mono">
            1
          </span>
          Dados da escala
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Data de início
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-stone-900 dark:text-slate-100 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Período a gerar (dias)
              </label>
              <input
                type="number"
                value={numDays}
                min={7}
                max={90}
                onChange={(e) => setNumDays(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-stone-900 dark:text-slate-100 transition-all duration-200"
              />
              <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">Recomendado: 28–31 dias (um mês).</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Identificação do plantão / turno
              </label>
              <input
                type="text"
                value={shiftLabel}
                onChange={(e) => setShiftLabel(e.target.value)}
                placeholder="Ex.: Enfermagem — Turno Manhã (07h–13h)"
                className="w-full px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-stone-900 dark:text-slate-100 transition-all duration-200"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Equipe efetiva (um nome por linha)
              </label>
              <textarea
                value={fixedNames}
                onChange={(e) => setFixedNames(e.target.value)}
                className="w-full min-h-[120px] px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-stone-900 dark:text-slate-100 transition-all duration-200"
              />
              <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
                Cada pessoa entra num rodízio 6x1 com folga em dia diferente da semana.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Folguista(s) — um nome por linha
              </label>
              <textarea
                value={floaterNames}
                onChange={(e) => setFloaterNames(e.target.value)}
                className="w-full min-h-[60px] px-3.5 py-2.5 bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 rounded-xl text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-stone-900 dark:text-slate-100 transition-all duration-200"
              />
              <p className="text-xs text-stone-400 dark:text-slate-500 mt-1">
                Cobre quem estiver de folga. Se faltar folguista em algum dia, a escala avisa.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={gerarEscala}
            className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs"
          >
            <Wand2 size={16} /> Gerar escala
          </button>
          <button
            onClick={salvarMes}
            disabled={saving}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 active:bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-xs disabled:opacity-60"
          >
            <Save size={16} /> {saving ? "Salvando…" : "Salvar mês"}
          </button>
          <button
            onClick={() => {
              carregarMeses();
              setShowArchive(true);
            }}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
          >
            <FolderOpen size={16} /> Meses salvos
          </button>
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
          >
            <Download size={16} /> Exportar CSV
          </button>
          <button
            onClick={() => printDocument("Escala_6x1_Enfermagem")}
            className="flex items-center gap-2 border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-slate-300 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
          >
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>
        {saveMsg && (
          <p className="mt-3 text-sm font-mono text-emerald-600 dark:text-emerald-400">{saveMsg}</p>
        )}
      </div>

      {result && (
        <div className="space-y-5 no-print">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-emerald-600" /> Trabalha
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-amber-500" /> Folga (efetivo)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-blue-600" /> Folguista cobrindo
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-stone-400 dark:bg-slate-500" /> Folguista livre (não precisou cobrir)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-md bg-white dark:bg-slate-900 ring-2 ring-inset ring-red-600" /> Folga sem cobertura
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-slate-400 font-mono">
            Clique numa célula para alternar o status. Salve o mês para guardar as alterações.
          </p>

          {problemDays.length === 0 ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 rounded-xl px-4 py-3 text-sm font-mono">
              <CheckCircle2 size={16} className="shrink-0" />
              Cobertura completa — todos os dias de folga têm folguista designado.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm font-mono">
                <AlertTriangle size={16} className="shrink-0" />
                <strong>{problemDays.length} dia(s) com cobertura insuficiente.</strong> Considere adicionar mais 1
                folguista à equipe.
              </div>
              {problemDays.map((d, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 rounded-xl px-4 py-3 text-sm font-mono"
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  {fmtDate(d.date)} ({DOW[d.dow]}) — sem cobertura para:{" "}
                  {d.uncoveredFixedIdx.map((i) => result.fixedNames[i]).join(", ")}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-center">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-stone-50 dark:bg-slate-800/80 text-left px-3.5 py-2 font-semibold text-xs text-stone-900 dark:text-slate-100 border-b border-r border-stone-200 dark:border-slate-700 min-w-[190px]">
                    {result.shiftLabel || "Equipe"}
                  </th>
                  {result.days.map((d, idx) => (
                    <th
                      key={idx}
                      className="px-1 py-2 font-mono font-semibold text-xs text-stone-700 dark:text-slate-300 border-b border-r border-stone-200 dark:border-slate-700"
                    >
                      {fmtDate(d.date)}
                      <span className="block font-normal text-[10px] text-stone-500 dark:text-slate-400 uppercase">
                        {DOW[d.dow]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.fixedNames.map((name, i) => (
                  <tr key={`f-${i}`} className={i % 2 === 1 ? "bg-stone-50/50 dark:bg-slate-800/20" : ""}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3.5 py-2.5 border-b border-r border-stone-200 dark:border-slate-700 min-w-[190px]">
                      <span className="font-semibold text-sm text-stone-900 dark:text-slate-100">{name}</span>
                      <span className="block font-mono text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                        Efetivo
                      </span>
                    </td>
                    {result.days.map((day, di) => {
                      const cell = result.fixedCells[i][di];
                      if (cell === "F") {
                        return (
                          <td
                            key={di}
                            title={`${name} — folga`}
                            className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.folga} cursor-pointer hover:opacity-70`}
                            onClick={() => cycleStatus("fixed", i, di)}
                          >
                            F
                          </td>
                        );
                      }
                      if (cell === "F!") {
                        return (
                          <td
                            key={di}
                            title={`${name} — folga SEM cobertura`}
                            className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.folga} ring-2 ring-inset ring-red-600 cursor-pointer hover:opacity-70`}
                            onClick={() => cycleStatus("fixed", i, di)}
                          >
                            F!
                          </td>
                        );
                      }
                      return (
                        <td
                          key={di}
                          title={`${name} — trabalha`}
                          className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.work} cursor-pointer hover:opacity-70`}
                          onClick={() => cycleStatus("fixed", i, di)}
                        >
                          T
                        </td>
                      );
                    })}
                  </tr>
                ))}

                <tr>
                  <td
                    colSpan={result.days.length + 1}
                    className="px-3.5 py-1.5 font-mono text-[11px] text-stone-500 dark:text-slate-400 bg-stone-50 dark:bg-slate-800/60 border-b border-t border-stone-200 dark:border-slate-700"
                  >
                    FOLGUISTAS
                  </td>
                </tr>

                {result.floaterNames.map((name, j) => (
                  <tr key={`g-${j}`} className={j % 2 === 1 ? "bg-stone-50/50 dark:bg-slate-800/20" : ""}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3.5 py-2.5 border-b border-r border-stone-200 dark:border-slate-700 min-w-[190px]">
                      <span className="font-semibold text-sm text-stone-900 dark:text-slate-100">{name}</span>
                      <span className="block font-mono text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
                        Folguista
                      </span>
                    </td>
                    {result.days.map((day, di) => {
                      const cell = result.floaterCells[j][di];
                      if (cell === "F") {
                        return (
                          <td
                            key={di}
                            title={`${name} — folga própria`}
                            className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.folga} cursor-pointer hover:opacity-70`}
                            onClick={() => cycleStatus("floater", j, di)}
                          >
                            F
                          </td>
                        );
                      }
                      if (cell === "C") {
                        return (
                          <td
                            key={di}
                            title={`${name} — cobre`}
                            className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.cover} cursor-pointer hover:opacity-70`}
                            onClick={() => cycleStatus("floater", j, di)}
                          >
                            C
                          </td>
                        );
                      }
                      return (
                        <td
                          key={di}
                          title={`${name} — disponível, ninguém para cobrir`}
                          className={`px-0 py-1.5 w-[34px] font-mono text-xs font-semibold border-b border-r border-stone-200 dark:border-slate-700 ${CELL_CLASS.free} cursor-pointer hover:opacity-70`}
                          onClick={() => cycleStatus("floater", j, di)}
                        >
                          L
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {result.fixedNames.map((name, i) => {
              const folgas = result.fixedCells[i].filter((c) => c === "F" || c === "F!").length;
              return (
                <div
                  key={`s-${i}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-700/50 p-3.5"
                >
                  <p className="text-sm font-semibold text-stone-900 dark:text-slate-100">{name}</p>
                  <p className="font-mono text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                    Efetivo
                  </p>
                  <p className="font-mono text-xs text-stone-500 dark:text-slate-400 mt-1.5">
                    Folgas no período: {folgas}
                  </p>
                  <p className="font-mono text-xs text-stone-500 dark:text-slate-400">
                    Dias trabalhados: {result.days.length - folgas}
                  </p>
                </div>
              );
            })}
            {result.floaterNames.map((name, j) => {
              const folgas = result.floaterCells[j].filter((c) => c === "F").length;
              const coberturas = result.floaterCells[j].filter((c) => c === "C").length;
              return (
                <div
                  key={`s-${result.fixedNames.length + j}`}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-stone-200 dark:border-slate-700/50 p-3.5"
                >
                  <p className="text-sm font-semibold text-stone-900 dark:text-slate-100">{name}</p>
                  <p className="font-mono text-[10px] text-stone-500 dark:text-slate-400 uppercase tracking-wider">
                    Folguista
                  </p>
                  <p className="font-mono text-xs text-stone-500 dark:text-slate-400 mt-1.5">
                    Folgas próprias: {folgas}
                  </p>
                  <p className="font-mono text-xs text-stone-500 dark:text-slate-400">
                    Dias cobrindo: {coberturas}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result && (
        <div className="hidden print:block print-scale">
          <div className="text-center border-b-2 border-stone-900 pb-2 mb-3">
            {hospitalName && <h1 className="text-xl font-bold text-stone-900">{hospitalName}</h1>}
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">Escala de Plantão 6x1 com Folguista</h2>
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
                <th className="text-left">{result.shiftLabel || "Equipe"}</th>
                {result.days.map((d, idx) => {
                  const wknd = d.dow === 0 || d.dow === 6;
                  return (
                    <th key={idx} className={wknd ? "print-wknd" : ""}>
                      {fmtDate(d.date)}
                      <span className="print-dow">{DOW[d.dow]}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {result.fixedNames.map((name, i) => (
                <tr key={`p-${i}`}>
                  <td>
                    <span className="print-name">{name}</span>
                    <span className="print-role">Efetivo</span>
                  </td>
                  {result.days.map((day, di) => {
                    const wknd = day.dow === 0 || day.dow === 6;
                    const cell = result.fixedCells[i][di];
                    if (cell === "F" || cell === "F!") {
                      return (
                        <td key={di} className={(cell === "F!" ? "font-bold" : "") + (wknd ? " print-wknd" : "")}>
                          {cell}
                        </td>
                      );
                    }
                    return (
                      <td key={di} className={wknd ? "print-wknd" : ""}>
                        T
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td colSpan={result.days.length + 1} className="bg-stone-100 text-left">
                  <strong>FOLGUISTAS</strong>
                </td>
              </tr>
              {result.floaterNames.map((name, j) => (
                <tr key={`pg-${j}`}>
                  <td>
                    <span className="print-name">{name}</span>
                    <span className="print-role">Folguista</span>
                  </td>
                  {result.days.map((day, di) => {
                    const wknd = day.dow === 0 || day.dow === 6;
                    const cell = result.floaterCells[j][di];
                    if (cell === "F") return <td key={di} className={wknd ? "print-wknd" : ""}>F</td>;
                    if (cell === "C")
                      return (
                        <td key={di} className={"font-bold" + (wknd ? " print-wknd" : "")}>
                          C
                        </td>
                      );
                    return <td key={di} className={wknd ? "print-wknd" : ""}>L</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[9px] text-stone-600 mt-1.5">
            T = Trabalha · F = Folga · C = Folguista cobrindo · L = Folguista livre · F! = Folga sem cobertura
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

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-700/50 shadow-sm p-5 sm:p-6 text-sm text-stone-500 dark:text-slate-400 leading-relaxed no-print">
        <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-slate-100 mb-2.5">
          <CalendarDays size={15} className="text-emerald-600 dark:text-emerald-400" /> Como a escala é montada
        </h3>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-stone-700 dark:text-slate-200">Rodízio 6x1:</strong> cada funcionário efetivo folga
            1 dia a cada 7, em ciclo contínuo; os dias de folga são escalonados (defasados) entre a equipe para que
            nunca todos folguem no mesmo dia.
          </li>
          <li>
            <strong className="text-stone-700 dark:text-slate-200">Folguista:</strong> assume o lugar de quem está de
            folga naquele dia, em rodízio justo entre os folguistas disponíveis. O folguista também tem seu próprio dia
            de folga semanal.
          </li>
          <li>
            <strong className="text-stone-700 dark:text-slate-200">Cobertura insuficiente:</strong> se houver mais
            funcionários de folga do que folguistas disponíveis num mesmo dia, a célula é marcada e listada nos avisos —
            sinal de que a equipe precisa de mais um folguista.
          </li>
          <li>
            <strong className="text-stone-700 dark:text-slate-200">Descanso entre jornadas:</strong> esta ferramenta
            organiza dias de trabalho/folga (nível diário). Para plantões de 12h ou 24h, verifique manualmente o
            intervalo interjornada mínimo de 11h (CLT) e o repouso semanal de 24h consecutivas antes de publicar a
            escala oficial.
          </li>
          <li>
            Ajuste livremente o número de pessoas na equipe efetiva e de folguistas — o gerador recalcula tudo
            automaticamente.
          </li>
        </ul>
      </div>

      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-slate-700">
              <h3 className="text-base font-bold text-stone-900 dark:text-slate-100">
                Meses salvos
              </h3>
              <button
                onClick={() => setShowArchive(false)}
                className="p-1.5 rounded-lg text-stone-500 dark:text-slate-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-2">
              {loadingMonth ? (
                <p className="text-sm text-stone-500 dark:text-slate-400 font-mono">Carregando…</p>
              ) : savedMonths.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-slate-400">
                  Nenhum mês salvo ainda. Gere uma escala e use "Salvar mês".
                </p>
              ) : (
                savedMonths.map((m) => {
                  const cleanMonth = extractScaleMonth(m.month);
                  const [y, mm] = cleanMonth.split("-").map(Number);
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
                          {cleanMonth} · salvo em{" "}
                          {new Date(m.savedAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => carregarMes(m.month)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-all duration-200"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => excluirMes(m.month)}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-600 text-stone-600 dark:text-slate-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-slate-800 transition-all duration-200"
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
