"use client";

import { useState } from "react";
import { Activity, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-cyan-50/80 dark:bg-cyan-950/40",
  border: "border-cyan-200 dark:border-cyan-800/50",
  text: "text-cyan-700 dark:text-cyan-300",
  textStrong: "text-cyan-900 dark:text-cyan-100",
  icon: "text-cyan-600 dark:text-cyan-400",
};

const SUBTABS = [
  { key: "rate", label: "Velocidade da Bomba (mL/h)" },
  { key: "time", label: "Tempo de Infusão" },
  { key: "vaso", label: "Drogas Vasoativas (mcg/kg/min)" },
];

function RatePanel() {
  const [volume, setVolume] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(volume);
    const t = parseFloat(time);
    if (!v || !t) return;
    setResult(`${(v / t).toFixed(1)} mL/h`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Volume Total (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 500" ring="focus:ring-cyan-500/50" />
        <NumField label="Tempo de Infusão (h) *" value={time} onChange={setTime} placeholder="Ex: 8" ring="focus:ring-cyan-500/50" />
      </div>
      <SubmitRow label="Calcular Velocidade" icon={Calculator} gradientBtn="from-cyan-500 to-blue-600 hover:from-cyan-600" shadow="shadow-cyan-500/20" onReset={() => { setVolume(""); setTime(""); setResult(null); }} />
      {result && <ResultCard label="Velocidade da Bomba:" value={result} formula={`${volume} mL ÷ ${time} h`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function TimePanel() {
  const [volume, setVolume] = useState("");
  const [rate, setRate] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(volume);
    const r = parseFloat(rate);
    if (!v || !r) return;
    setResult(`${(v / r).toFixed(2)} h`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Volume Total (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 500" ring="focus:ring-cyan-500/50" />
        <NumField label="Velocidade da Bomba (mL/h) *" value={rate} onChange={setRate} placeholder="Ex: 62.5" ring="focus:ring-cyan-500/50" />
      </div>
      <SubmitRow label="Calcular Tempo" icon={Calculator} gradientBtn="from-cyan-500 to-blue-600 hover:from-cyan-600" shadow="shadow-cyan-500/20" onReset={() => { setVolume(""); setRate(""); setResult(null); }} />
      {result && <ResultCard label="Tempo de Infusão:" value={result} formula={`${volume} mL ÷ ${rate} mL/h`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function VasoPanel() {
  const [dose, setDose] = useState(""); // mcg/kg/min
  const [weight, setWeight] = useState("");
  const [concentration, setConcentration] = useState(""); // mcg/mL
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseFloat(dose);
    const w = parseFloat(weight);
    const c = parseFloat(concentration);
    if (!d || !w || !c) return;
    const r = (d * w * 60) / c;
    setResult(`${r.toFixed(2)} mL/h`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField label="Dose Prescrita (mcg/kg/min) *" value={dose} onChange={setDose} placeholder="Ex: 5" ring="focus:ring-cyan-500/50" />
        <NumField label="Peso do Paciente (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring="focus:ring-cyan-500/50" />
        <NumField label="Concentração da Solução (mcg/mL) *" value={concentration} onChange={setConcentration} placeholder="Ex: 1600" ring="focus:ring-cyan-500/50" />
      </div>
      <SubmitRow label="Calcular mL/h" icon={Calculator} gradientBtn="from-cyan-500 to-blue-600 hover:from-cyan-600" shadow="shadow-cyan-500/20" onReset={() => { setDose(""); setWeight(""); setConcentration(""); setResult(null); }} />
      {result && (
        <ResultCard
          label="Velocidade de Infusão:"
          value={result}
          formula="mL/h = (Dose × Peso × 60) ÷ Concentração"
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
        />
      )}
    </form>
  );
}

export default function InfusionCalculator() {
  const [sub, setSub] = useState("rate");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Activity}
        gradient="from-cyan-500 to-blue-600"
        title="Infusão (Bomba)"
        subtitle="Velocidade, tempo de infusão e drogas vasoativas contínuas"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-cyan-600" />
      {sub === "rate" && <RatePanel />}
      {sub === "time" && <TimePanel />}
      {sub === "vaso" && <VasoPanel />}
    </div>
  );
}
