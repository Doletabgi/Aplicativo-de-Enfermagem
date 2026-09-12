"use client";

import { useState } from "react";
import { Calculator, ArrowRight } from "lucide-react";
import { PanelHeader, NumField, SelectField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const CONVERSIONS = [
  { from: "g", to: "mg", multiply: 1000 },
  { from: "mg", to: "mcg", multiply: 1000 },
  { from: "g", to: "mcg", multiply: 1000000 },
  { from: "L", to: "ml", multiply: 1000 },
  { from: "ml", to: "L", multiply: 0.001 },
  { from: "mg", to: "g", multiply: 0.001 },
  { from: "mcg", to: "mg", multiply: 0.001 },
  { from: "UI", to: "ml", multiply: 0.01, note: "Exemplo: 100UI/ml → 1UI = 0,01ml" },
];

const SUBTABS = [
  { key: "units", label: "Unidades (mg, g, mcg, L)" },
  { key: "drip", label: "Gotas ↔ Microgotas ↔ mL/h" },
];

function UnitsConverter() {
  const [from, setFrom] = useState("g");
  const [to, setTo] = useState("mg");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(value);
    if (!val) return;
    const conv = CONVERSIONS.find((c) => c.from === from && c.to === to);
    if (!conv) return;
    setResult(`${val} ${from} = ${(val * conv.multiply).toFixed(4)} ${to}`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField label="Valor *" value={value} onChange={setValue} placeholder="Ex: 1.5" ring="focus:ring-amber-500/50" />
        <SelectField label="De" value={from} onChange={setFrom} options={[...new Set(CONVERSIONS.map((c) => c.from))].map((u) => ({ value: u, label: u }))} />
        <SelectField label="Para" value={to} onChange={setTo} options={CONVERSIONS.filter((c) => c.from === from).map((c) => ({ value: c.to, label: c.to }))} />
      </div>
      <SubmitRow label="Realizar Conversão" icon={ArrowRight} gradientBtn="from-amber-500 to-orange-600 hover:from-amber-600" shadow="shadow-amber-500/20" onReset={() => { setValue(""); setResult(null); }} />

      {result && (
        <ResultCard
          label="Resultado:"
          value={result}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={{
            bg: "bg-amber-50/80 dark:bg-amber-950/40",
            border: "border-amber-200 dark:border-amber-800/50",
            text: "text-amber-700 dark:text-amber-300",
            textStrong: "text-amber-900 dark:text-amber-100",
            icon: "text-amber-600 dark:text-amber-400",
          }}
        />
      )}

      <div className="pt-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tabela de Referência Rápida</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {["1 g = 1.000 mg", "1 mg = 1.000 mcg", "1 L = 1.000 mL", "1 mL = 20 gotas"].map((t) => (
            <div key={t} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

function DripConverter() {
  const [mode, setMode] = useState<"toMlh" | "toGtt">("toMlh");
  const [volume, setVolume] = useState("");
  const [gtt, setGtt] = useState(""); // gotas ou microgotas por min
  const [mlh, setMlh] = useState("");
  const [factor, setFactor] = useState(20); // fator gotejamento (20 macro, 60 micro)
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "toMlh") {
      const g = parseFloat(gtt);
      if (!g) return;
      const r = (g * 60) / factor;
      setResult(`${r.toFixed(1)} mL/h`);
    } else {
      const m = parseFloat(mlh);
      if (!m) return;
      const r = (m * factor) / 60;
      setResult(`${r.toFixed(1)} gotas/min`);
    }
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <SubTabs
        items={[
          { key: "toMlh", label: "Gotas/min → mL/h" },
          { key: "toGtt", label: "mL/h → Gotas/min" },
        ]}
        active={mode}
        onChange={(k) => { setMode(k as "toMlh" | "toGtt"); setResult(null); }}
        activeClasses="bg-orange-600"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mode === "toMlh" ? (
          <NumField label="Gotas/Microgotas por minuto *" value={gtt} onChange={setGtt} placeholder="Ex: 21" ring="focus:ring-amber-500/50" />
        ) : (
          <NumField label="Velocidade (mL/h) *" value={mlh} onChange={setMlh} placeholder="Ex: 63" ring="focus:ring-amber-500/50" />
        )}
        <SelectField
          label="Fator do Equipo"
          value={String(factor)}
          onChange={(v) => setFactor(Number(v))}
          options={[
            { value: "20", label: "Macrogotas (20 gts/mL)" },
            { value: "60", label: "Microgotas (60 microgts/mL)" },
            { value: "10", label: "Equipo Sangue (10)" },
            { value: "15", label: "Equipo (15)" },
          ]}
        />
      </div>

      <SubmitRow label="Converter" icon={ArrowRight} gradientBtn="from-amber-500 to-orange-600 hover:from-amber-600" shadow="shadow-amber-500/20" onReset={() => { setGtt(""); setMlh(""); setResult(null); }} />

      {result && (
        <ResultCard
          label="Resultado:"
          value={result}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={{
            bg: "bg-amber-50/80 dark:bg-amber-950/40",
            border: "border-amber-200 dark:border-amber-800/50",
            text: "text-amber-700 dark:text-amber-300",
            textStrong: "text-amber-900 dark:text-amber-100",
            icon: "text-amber-600 dark:text-amber-400",
          }}
        />
      )}
    </form>
  );
}

export default function ConvertCalculator() {
  const [sub, setSub] = useState("units");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Calculator}
        gradient="from-amber-500 to-orange-600"
        title="Conversor de Unidades Farmacológicas"
        subtitle="Conversão entre gramas, miligramas, microgramas, litros, mL e gotejamento"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-orange-600" />
      {sub === "units" ? <UnitsConverter /> : <DripConverter />}
    </div>
  );
}
