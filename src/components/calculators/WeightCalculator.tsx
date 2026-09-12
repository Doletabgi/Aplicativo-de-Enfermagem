"use client";

import { useState } from "react";
import { Scale, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, useCopy } from "./ui";

export default function WeightCalculator() {
  const [weight, setWeight] = useState("");
  const [dose, setDose] = useState("");
  const [available, setAvailable] = useState("");
  const [volume, setVolume] = useState("");
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
    setResult(`${r.toFixed(2)} mL (${totalDose.toFixed(1)} mg dose total)`);
  };

  const reset = () => { setWeight(""); setDose(""); setAvailable(""); setVolume(""); setResult(null); };

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Scale}
        gradient="from-violet-500 to-purple-600"
        title="Cálculo de Dose por Peso (mg/kg)"
        subtitle="Dose Total = Peso (kg) × Dose por kg"
      />

      <form onSubmit={calc} className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumField label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring="focus:ring-violet-500/50" />
          <NumField label="Dose (mg/kg) *" value={dose} onChange={setDose} placeholder="Ex: 5" ring="focus:ring-violet-500/50" />
          <NumField label="Frasco (mg) *" value={available} onChange={setAvailable} placeholder="Ex: 500" ring="focus:ring-violet-500/50" />
          <NumField label="Volume (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 10" ring="focus:ring-violet-500/50" />
        </div>
        <SubmitRow label="Calcular Dose por Peso" icon={Calculator} gradientBtn="from-violet-500 to-purple-600 hover:from-violet-600" shadow="shadow-violet-500/20" onReset={reset} />
      </form>

      {result && (
        <ResultCard
          label="Volume e Dose Total:"
          value={result}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={{
            bg: "bg-violet-50/80 dark:bg-violet-950/40",
            border: "border-violet-200 dark:border-violet-800/50",
            text: "text-violet-700 dark:text-violet-300",
            textStrong: "text-violet-900 dark:text-violet-100",
            icon: "text-violet-600 dark:text-violet-400",
          }}
        />
      )}
    </div>
  );
}
