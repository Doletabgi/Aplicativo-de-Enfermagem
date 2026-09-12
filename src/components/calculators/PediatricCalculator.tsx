"use client";

import { useState } from "react";
import { Baby, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-rose-50/80 dark:bg-rose-950/40",
  border: "border-rose-200 dark:border-rose-800/50",
  text: "text-rose-700 dark:text-rose-300",
  textStrong: "text-rose-900 dark:text-rose-100",
  icon: "text-rose-600 dark:text-rose-400",
};

const SUBTABS = [
  { key: "weight", label: "Dose por Peso" },
  { key: "bsa", label: "Dose por Superfície Corporal" },
  { key: "drip", label: "Gotejamento Neonatal" },
];

function WeightPanel() {
  const [weight, setWeight] = useState("");
  const [dose, setDose] = useState(""); // mg/kg
  const [available, setAvailable] = useState(""); // mg
  const [volume, setVolume] = useState(""); // mL
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    const d = parseFloat(dose);
    const a = parseFloat(available);
    const v = parseFloat(volume);
    if (!w || !d || !a || !v) return;
    const totalDose = w * d;
    const r = (totalDose / a) * v;
    setResult(`${r.toFixed(2)} mL (${totalDose.toFixed(2)} mg dose total)`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NumField label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 12" ring="focus:ring-rose-500/50" />
        <NumField label="Dose (mg/kg) *" value={dose} onChange={setDose} placeholder="Ex: 10" ring="focus:ring-rose-500/50" />
        <NumField label="Frasco (mg) *" value={available} onChange={setAvailable} placeholder="Ex: 250" ring="focus:ring-rose-500/50" />
        <NumField label="Volume (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 5" ring="focus:ring-rose-500/50" />
      </div>
      <SubmitRow label="Calcular Dose Pediátrica" icon={Calculator} gradientBtn="from-rose-500 to-red-600 hover:from-rose-600" shadow="shadow-rose-500/20" onReset={() => { setWeight(""); setDose(""); setAvailable(""); setVolume(""); setResult(null); }} />
      {result && <ResultCard label="Volume e Dose Total:" value={result} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function BsaPanel() {
  const [height, setHeight] = useState(""); // cm
  const [weight, setWeight] = useState(""); // kg
  const [doseM2, setDoseM2] = useState(""); // mg/m2
  const [result, setResult] = useState<string | null>(null);
  const [bsaValue, setBsaValue] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const d = parseFloat(doseM2);
    if (!h || !w || !d) return;
    const bsa = Math.sqrt((h * w) / 3600);
    const totalDose = bsa * d;
    setBsaValue(`${bsa.toFixed(2)} m²`);
    setResult(`${totalDose.toFixed(2)} mg`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumField label="Altura (cm) *" value={height} onChange={setHeight} placeholder="Ex: 110" ring="focus:ring-rose-500/50" />
        <NumField label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 20" ring="focus:ring-rose-500/50" />
        <NumField label="Dose Prescrita (mg/m²) *" value={doseM2} onChange={setDoseM2} placeholder="Ex: 75" ring="focus:ring-rose-500/50" />
      </div>
      <SubmitRow label="Calcular Dose por SC" icon={Calculator} gradientBtn="from-rose-500 to-red-600 hover:from-rose-600" shadow="shadow-rose-500/20" onReset={() => { setHeight(""); setWeight(""); setDoseM2(""); setResult(null); setBsaValue(null); }} />
      {result && (
        <ResultCard
          label="Dose Total Prescrita:"
          value={result}
          formula={`Superfície Corporal: ${bsaValue} • SC = √[(Altura × Peso) ÷ 3600]`}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
        />
      )}
    </form>
  );
}

function NeonatalDripPanel() {
  const [volume, setVolume] = useState("");
  const [time, setTime] = useState(""); // minutos
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(volume);
    const t = parseFloat(time);
    if (!v || !t) return;
    setResult(`${(v / t).toFixed(2)} microgotas/min`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Volume Total (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 24" ring="focus:ring-rose-500/50" />
        <NumField label="Tempo de Infusão (min) *" value={time} onChange={setTime} placeholder="Ex: 60" ring="focus:ring-rose-500/50" />
      </div>
      <SubmitRow label="Calcular Microgotejamento" icon={Calculator} gradientBtn="from-rose-500 to-red-600 hover:from-rose-600" shadow="shadow-rose-500/20" onReset={() => { setVolume(""); setTime(""); setResult(null); }} />
      {result && <ResultCard label="Microgotejamento Neonatal:" value={result} formula={`${volume} mL ÷ ${time} min`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

export default function PediatricCalculator() {
  const [sub, setSub] = useState("weight");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Baby}
        gradient="from-rose-500 to-red-600"
        title="Pediatria"
        subtitle="Dose por peso, superfície corporal e gotejamento neonatal"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-rose-600" />
      {sub === "weight" && <WeightPanel />}
      {sub === "bsa" && <BsaPanel />}
      {sub === "drip" && <NeonatalDripPanel />}
    </div>
  );
}
