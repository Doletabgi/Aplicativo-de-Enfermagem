"use client";

import { useState } from "react";
import { FlaskConical, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-fuchsia-50/80 dark:bg-fuchsia-950/40",
  border: "border-fuchsia-200 dark:border-fuchsia-800/50",
  text: "text-fuchsia-700 dark:text-fuchsia-300",
  textStrong: "text-fuchsia-900 dark:text-fuchsia-100",
  icon: "text-fuchsia-600 dark:text-fuchsia-400",
};

const SUBTABS = [
  { key: "conc", label: "Concentração Final" },
  { key: "recon", label: "Reconstituição de Pó/Ampola" },
];

function ConcentrationPanel() {
  const [amount, setAmount] = useState(""); // mg
  const [volume, setVolume] = useState(""); // mL
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount);
    const v = parseFloat(volume);
    if (!a || !v) return;
    setResult(`${(a / v).toFixed(3)} mg/mL`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Quantidade do Fármaco (mg) *" value={amount} onChange={setAmount} placeholder="Ex: 500" ring="focus:ring-fuchsia-500/50" />
        <NumField label="Volume Final da Solução (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 100" ring="focus:ring-fuchsia-500/50" />
      </div>
      <SubmitRow label="Calcular Concentração" icon={Calculator} gradientBtn="from-fuchsia-500 to-pink-600 hover:from-fuchsia-600" shadow="shadow-fuchsia-500/20" onReset={() => { setAmount(""); setVolume(""); setResult(null); }} />
      {result && <ResultCard label="Concentração Final:" value={result} formula={`${amount} mg ÷ ${volume} mL`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function ReconstitutionPanel() {
  const [powder, setPowder] = useState(""); // mg
  const [desired, setDesired] = useState(""); // mg/mL
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(powder);
    const d = parseFloat(desired);
    if (!p || !d) return;
    setResult(`${(p / d).toFixed(2)} mL de diluente`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Quantidade do Pó (mg) *" value={powder} onChange={setPowder} placeholder="Ex: 1000" ring="focus:ring-fuchsia-500/50" />
        <NumField label="Concentração Desejada (mg/mL) *" value={desired} onChange={setDesired} placeholder="Ex: 100" ring="focus:ring-fuchsia-500/50" />
      </div>
      <SubmitRow label="Calcular Diluente" icon={Calculator} gradientBtn="from-fuchsia-500 to-pink-600 hover:from-fuchsia-600" shadow="shadow-fuchsia-500/20" onReset={() => { setPowder(""); setDesired(""); setResult(null); }} />
      {result && <ResultCard label="Volume de Diluente Necessário:" value={result} formula={`${powder} mg ÷ ${desired} mg/mL`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

export default function DilutionCalculator() {
  const [sub, setSub] = useState("conc");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={FlaskConical}
        gradient="from-fuchsia-500 to-pink-600"
        title="Diluição de Medicamentos"
        subtitle="Concentração final e reconstituição de pó/ampola"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-fuchsia-600" />
      {sub === "conc" ? <ConcentrationPanel /> : <ReconstitutionPanel />}
    </div>
  );
}
