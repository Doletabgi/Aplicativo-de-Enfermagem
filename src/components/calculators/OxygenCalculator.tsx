"use client";

import { useState } from "react";
import { Wind, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-teal-50/80 dark:bg-teal-950/40",
  border: "border-teal-200 dark:border-teal-800/50",
  text: "text-teal-700 dark:text-teal-300",
  textStrong: "text-teal-900 dark:text-teal-100",
  icon: "text-teal-600 dark:text-teal-400",
};
const BTN = "from-teal-500 to-emerald-600 hover:from-teal-600";
const RING = "focus:ring-teal-500/50";

const SUBTABS = [
  { key: "flow", label: "Fluxo de O2 necessário" },
  { key: "fio2", label: "FiO2 Estimada" },
];

function FlowPanel() {
  const [fio2, setFio2] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseFloat(fio2);
    if (!f) return;
    const flow = (f - 21) / 4;
    setResult(`${flow.toFixed(1)} L/min (cateter nasal)`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <NumField label="FiO2 Desejada (%) *" value={fio2} onChange={setFio2} placeholder="Ex: 33" ring={RING} />
      <SubmitRow label="Calcular Fluxo" icon={Calculator} gradientBtn={BTN} shadow="shadow-teal-500/20" onReset={() => { setFio2(""); setResult(null); }} />
      {result && (
        <ResultCard
          label="Fluxo de O2 Estimado:"
          value={result}
          formula="Fluxo (L/min) = (FiO2 − 21) ÷ 4"
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
          extra={<p className="text-[11px] text-slate-400 mt-1">Estimativa válida para cateter nasal (baixo fluxo); ajuste conforme dispositivo real</p>}
        />
      )}
    </form>
  );
}

function Fio2Panel() {
  const [flow, setFlow] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseFloat(flow);
    if (!f && f !== 0) return;
    const fio2 = 21 + 4 * f;
    setResult(`${fio2.toFixed(0)}%`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <NumField label="Fluxo de O2 (L/min) *" value={flow} onChange={setFlow} placeholder="Ex: 3" ring={RING} />
      <SubmitRow label="Calcular FiO2" icon={Calculator} gradientBtn={BTN} shadow="shadow-teal-500/20" onReset={() => { setFlow(""); setResult(null); }} />
      {result && <ResultCard label="FiO2 Estimada:" value={result} formula="FiO2 (%) = 21 + (4 × Fluxo L/min)" onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

export default function OxygenCalculator() {
  const [sub, setSub] = useState("flow");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Wind}
        gradient="from-teal-500 to-emerald-600"
        title="Oxigenoterapia"
        subtitle="Fluxo de O2 e estimativa de FiO2 (cateter nasal, baixo fluxo)"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-teal-600" />
      {sub === "flow" ? <FlowPanel /> : <Fio2Panel />}
    </div>
  );
}
