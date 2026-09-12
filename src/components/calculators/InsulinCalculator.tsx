"use client";

import { useState } from "react";
import { Syringe, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-lime-50/80 dark:bg-lime-950/40",
  border: "border-lime-200 dark:border-lime-800/50",
  text: "text-lime-700 dark:text-lime-300",
  textStrong: "text-lime-900 dark:text-lime-100",
  icon: "text-lime-600 dark:text-lime-400",
};
const BTN = "from-lime-500 to-green-600 hover:from-lime-600";
const RING = "focus:ring-lime-500/50";

const SUBTABS = [
  { key: "scale", label: "Escala Móvel" },
  { key: "convert", label: "Conversão de Unidades (UI)" },
];

const SCALE_TABLE = [
  { max: 140, dose: "Sem cobertura adicional" },
  { max: 180, dose: "2 UI" },
  { max: 220, dose: "4 UI" },
  { max: 260, dose: "6 UI" },
  { max: 300, dose: "8 UI" },
  { max: Infinity, dose: "10 UI + avaliar médico/protocolo" },
];

function ScalePanel() {
  const [glucose, setGlucose] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const g = parseFloat(glucose);
    if (!g) return;
    const tier = SCALE_TABLE.find((t) => g < t.max);
    setResult(tier ? tier.dose : "Avaliar protocolo institucional");
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <NumField label="Glicemia Capilar (mg/dL) *" value={glucose} onChange={setGlucose} placeholder="Ex: 210" ring={RING} />
      <SubmitRow label="Sugerir Dose" icon={Calculator} gradientBtn={BTN} shadow="shadow-lime-500/20" onReset={() => { setGlucose(""); setResult(null); }} />
      {result && (
        <ResultCard
          label="Sugestão de Cobertura (Escala Móvel):"
          value={result}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
          extra={<p className="text-[11px] text-slate-400 mt-1">Tabela de referência genérica — sempre confirme com o protocolo institucional e prescrição médica</p>}
        />
      )}
    </form>
  );
}

function ConvertPanel() {
  const [dose, setDose] = useState(""); // UI
  const [concentration, setConcentration] = useState("100"); // UI/mL
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseFloat(dose);
    const c = parseFloat(concentration);
    if (!d || !c) return;
    setResult(`${(d / c).toFixed(3)} mL`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Dose Prescrita (UI) *" value={dose} onChange={setDose} placeholder="Ex: 10" ring={RING} />
        <NumField label="Concentração da Insulina (UI/mL) *" value={concentration} onChange={setConcentration} placeholder="Ex: 100" ring={RING} />
      </div>
      <SubmitRow label="Converter para mL" icon={Calculator} gradientBtn={BTN} shadow="shadow-lime-500/20" onReset={() => { setDose(""); setConcentration("100"); setResult(null); }} />
      {result && <ResultCard label="Volume a Administrar:" value={result} formula={`${dose} UI ÷ ${concentration} UI/mL`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

export default function InsulinCalculator() {
  const [sub, setSub] = useState("scale");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Syringe}
        gradient="from-lime-500 to-green-600"
        title="Insulina"
        subtitle="Escala móvel de cobertura e conversão de unidades (UI)"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-lime-600" />
      {sub === "scale" ? <ScalePanel /> : <ConvertPanel />}
    </div>
  );
}
