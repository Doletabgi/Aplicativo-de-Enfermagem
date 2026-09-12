"use client";

import { useState } from "react";
import { Syringe, Calculator } from "lucide-react";
import { PanelHeader, UnitField, SubmitRow, ResultCard, useCopy } from "./ui";

const UNITS = ["mg", "mcg", "g", "UI"];

const toMg = (val: number, unit: string) => {
  if (unit === "g") return val * 1000;
  if (unit === "mcg") return val * 0.001;
  return val;
};
const toMl = (val: number, unit: string) => (unit === "L" ? val * 1000 : val);
const fmt = (val: number, unit: string) => `${val} ${unit}`;

export default function DoseCalculator() {
  const [desiredDose, setDesiredDose] = useState("");
  const [desiredUnit, setDesiredUnit] = useState("mg");
  const [availableDose, setAvailableDose] = useState("");
  const [availableUnit, setAvailableUnit] = useState("mg");
  const [volume, setVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("ml");
  const [result, setResult] = useState<string | null>(null);
  const [formula, setFormula] = useState("");
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseFloat(desiredDose);
    const a = parseFloat(availableDose);
    const v = parseFloat(volume);
    if (!d || !a || !v) return;
    const dMg = toMg(d, desiredUnit);
    const aMg = toMg(a, availableUnit);
    const vMl = toMl(v, volumeUnit);
    const r = (dMg / aMg) * vMl;
    setFormula(`(${fmt(d, desiredUnit)} ÷ ${fmt(a, availableUnit)}) × ${fmt(v, volumeUnit)}`);
    setResult(`${r.toFixed(2)} mL`);
  };

  const reset = () => {
    setDesiredDose(""); setAvailableDose(""); setVolume(""); setResult(null);
  };

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Syringe}
        gradient="from-blue-600 to-indigo-600"
        title="Cálculo de Dose (Regra de 3)"
        subtitle="Volume a aspirar = (Dose Prescrita ÷ Dose Frasco) × Volume Frasco"
      />

      <form onSubmit={calc} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <UnitField label="Dose Prescrita *" value={desiredDose} onChange={setDesiredDose} unit={desiredUnit} onUnitChange={setDesiredUnit} units={UNITS} placeholder="Ex: 500" ring="focus:ring-blue-500/50" />
          <UnitField label="Dose Disponível no Frasco *" value={availableDose} onChange={setAvailableDose} unit={availableUnit} onUnitChange={setAvailableUnit} units={UNITS} placeholder="Ex: 1000" ring="focus:ring-blue-500/50" />
          <UnitField label="Volume / Diluente *" value={volume} onChange={setVolume} unit={volumeUnit} onUnitChange={setVolumeUnit} units={["ml", "L"]} placeholder="Ex: 10" ring="focus:ring-blue-500/50" />
        </div>
        <SubmitRow label="Calcular Volume" icon={Calculator} gradientBtn="from-blue-600 to-indigo-600 hover:from-blue-700" shadow="shadow-blue-500/20" onReset={reset} />
      </form>

      {result && (
        <ResultCard
          label="Volume a Administrar:"
          value={result}
          formula={`Fórmula: ${formula}`}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={{
            bg: "bg-blue-50/80 dark:bg-blue-950/40",
            border: "border-blue-200 dark:border-blue-800/50",
            text: "text-blue-700 dark:text-blue-300",
            textStrong: "text-blue-900 dark:text-blue-100",
            icon: "text-blue-600 dark:text-blue-400",
          }}
        />
      )}
    </div>
  );
}
