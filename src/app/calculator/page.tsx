"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calculator, Droplets, Syringe, Scale, ArrowLeft,
  Activity, FlaskConical, Baby, ClipboardList, Wind, Clock,
} from "lucide-react";

import DoseCalculator from "@/components/calculators/DoseCalculator";
import DripCalculator from "@/components/calculators/DripCalculator";
import WeightCalculator from "@/components/calculators/WeightCalculator";
import ConvertCalculator from "@/components/calculators/ConvertCalculator";
import InfusionCalculator from "@/components/calculators/InfusionCalculator";
import DilutionCalculator from "@/components/calculators/DilutionCalculator";
import PediatricCalculator from "@/components/calculators/PediatricCalculator";
import FluidBalanceCalculator from "@/components/calculators/FluidBalanceCalculator";
import ClinicalScalesCalculator from "@/components/calculators/ClinicalScalesCalculator";
import OxygenCalculator from "@/components/calculators/OxygenCalculator";
import InsulinCalculator from "@/components/calculators/InsulinCalculator";
import LowthianClockCalculator from "@/components/calculators/LowthianClockCalculator";

type CalcMode =
  | "dose" | "drip" | "weight" | "convert"
  | "infusion" | "dilution" | "pediatric" | "fluid"
  | "scales" | "oxygen" | "insulin" | "lowthian";

const MODES: { key: CalcMode; label: string; icon: any }[] = [
  { key: "dose", label: "Cálculo", icon: Syringe },
  { key: "drip", label: "Gotejamento", icon: Droplets },
  { key: "weight", label: "Dose / Peso", icon: Scale },
  { key: "convert", label: "Conversor", icon: Calculator },
  { key: "infusion", label: "Infusão", icon: Activity },
  { key: "dilution", label: "Diluição", icon: FlaskConical },
  { key: "pediatric", label: "Pediatria", icon: Baby },
  { key: "fluid", label: "Balanço Hídrico", icon: Droplets },
  { key: "scales", label: "Escalas Clínicas", icon: ClipboardList },
  { key: "lowthian", label: "Relógio de Lowthian", icon: Clock },
  { key: "oxygen", label: "Oxigenoterapia", icon: Wind },
  { key: "insulin", label: "Insulina", icon: Syringe },
];

export default function CalculatorPage() {
  const router = useRouter();
  const [mode, setMode] = useState<CalcMode>("dose");

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Calculadora de Enfermagem
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs">
            Doses, gotejamento, infusão, diluição, pediatria, hidratação, escalas clínicas e mais
          </p>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`p-3 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-2.5 min-h-[44px] ${
                active
                  ? "bg-teal-700 border-teal-700 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <m.icon size={16} className={active ? "text-white shrink-0" : "text-slate-400 shrink-0"} />
              <p className="text-xs font-semibold truncate">{m.label}</p>
            </button>
          );
        })}
      </div>

      {/* Active Calculator Panel */}
      {mode === "dose" && <DoseCalculator />}
      {mode === "drip" && <DripCalculator />}
      {mode === "weight" && <WeightCalculator />}
      {mode === "convert" && <ConvertCalculator />}
      {mode === "infusion" && <InfusionCalculator />}
      {mode === "dilution" && <DilutionCalculator />}
      {mode === "pediatric" && <PediatricCalculator />}
      {mode === "fluid" && <FluidBalanceCalculator />}
      {mode === "scales" && <ClinicalScalesCalculator />}
      {mode === "lowthian" && <LowthianClockCalculator />}
      {mode === "oxygen" && <OxygenCalculator />}
      {mode === "insulin" && <InsulinCalculator />}
    </div>
  );
}
