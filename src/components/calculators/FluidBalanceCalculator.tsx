"use client";

import { useState } from "react";
import { Droplets, Calculator } from "lucide-react";
import { PanelHeader, NumField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-sky-50/80 dark:bg-sky-950/40",
  border: "border-sky-200 dark:border-sky-800/50",
  text: "text-sky-700 dark:text-sky-300",
  textStrong: "text-sky-900 dark:text-sky-100",
  icon: "text-sky-600 dark:text-sky-400",
};

const BTN = "from-sky-500 to-cyan-600 hover:from-sky-600";
const RING = "focus:ring-sky-500/50";

const SUBTABS = [
  { key: "balance", label: "Balanço 24h" },
  { key: "need", label: "Necessidade Hídrica" },
  { key: "enteral", label: "Dieta Enteral" },
  { key: "calorie", label: "Necessidade Calórica" },
  { key: "electrolyte", label: "Reposição de Eletrólitos" },
  { key: "formula", label: "Fórmula Infantil" },
];

function BalancePanel() {
  const [intake, setIntake] = useState("");
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const i = parseFloat(intake);
    const o = parseFloat(output);
    if (isNaN(i) || isNaN(o)) return;
    const r = i - o;
    setResult(`${r >= 0 ? "+" : ""}${r.toFixed(0)} mL ${r >= 0 ? "(positivo)" : "(negativo)"}`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Ingesta Total (mL) *" value={intake} onChange={setIntake} placeholder="Ex: 2200" ring={RING} />
        <NumField label="Eliminação Total (mL) *" value={output} onChange={setOutput} placeholder="Ex: 1800" ring={RING} />
      </div>
      <SubmitRow label="Calcular Balanço" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setIntake(""); setOutput(""); setResult(null); }} />
      {result && <ResultCard label="Balanço Hídrico 24h:" value={result} formula={`${intake} mL − ${output} mL`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function NeedPanel() {
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState(""); // mL/kg/dia
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    const r = parseFloat(rate);
    if (!w || !r) return;
    setResult(`${(w * r).toFixed(0)} mL/dia`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Peso do Paciente (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring={RING} />
        <NumField label="Necessidade (mL/kg/dia) *" value={rate} onChange={setRate} placeholder="Ex: 30 (adulto) / 100 (criança)" ring={RING} />
      </div>
      <SubmitRow label="Calcular Volume Diário" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setWeight(""); setRate(""); setResult(null); }} />
      {result && <ResultCard label="Necessidade Hídrica Diária:" value={result} formula={`${weight} kg × ${rate} mL/kg/dia`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function EnteralPanel() {
  const [volume, setVolume] = useState("");
  const [time, setTime] = useState(""); // horas
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
        <NumField label="Volume Total da Dieta (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 1000" ring={RING} />
        <NumField label="Tempo de Infusão (h) *" value={time} onChange={setTime} placeholder="Ex: 20" ring={RING} />
      </div>
      <SubmitRow label="Calcular Gotejamento" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setVolume(""); setTime(""); setResult(null); }} />
      {result && <ResultCard label="Velocidade da Dieta Enteral:" value={result} formula={`${volume} mL ÷ ${time} h`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function CaloriePanel() {
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState(""); // kcal/kg/dia
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    const r = parseFloat(rate);
    if (!w || !r) return;
    setResult(`${(w * r).toFixed(0)} kcal/dia`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Peso do Paciente (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring={RING} />
        <NumField label="Meta Calórica (kcal/kg/dia) *" value={rate} onChange={setRate} placeholder="Ex: 25" ring={RING} />
      </div>
      <SubmitRow label="Calcular Necessidade Calórica" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setWeight(""); setRate(""); setResult(null); }} />
      {result && <ResultCard label="Necessidade Calórica Diária:" value={result} formula={`${weight} kg × ${rate} kcal/kg/dia`} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function ElectrolytePanel() {
  const [current, setCurrent] = useState("");
  const [desired, setDesired] = useState("");
  const [weight, setWeight] = useState("");
  const [factor, setFactor] = useState("0.6");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseFloat(current);
    const d = parseFloat(desired);
    const w = parseFloat(weight);
    const f = parseFloat(factor);
    if (isNaN(c) || isNaN(d) || !w || !f) return;
    const r = (d - c) * w * f;
    setResult(`${r.toFixed(1)} mEq`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NumField label="Nível Atual (mEq/L) *" value={current} onChange={setCurrent} placeholder="Ex: 128" ring={RING} />
        <NumField label="Nível Desejado (mEq/L) *" value={desired} onChange={setDesired} placeholder="Ex: 135" ring={RING} />
        <NumField label="Peso do Paciente (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring={RING} />
        <NumField label="Fator de Distribuição *" value={factor} onChange={setFactor} placeholder="Na: 0.6 / K: 0.4" ring={RING} />
      </div>
      <SubmitRow label="Calcular Reposição" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setCurrent(""); setDesired(""); setWeight(""); setFactor("0.6"); setResult(null); }} />
      {result && (
        <ResultCard
          label="Quantidade a Repor:"
          value={result}
          formula="mEq = (Desejado − Atual) × Peso × Fator"
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
          extra={<p className="text-[11px] text-slate-400 mt-1">Sódio ≈ 0.6 • Potássio ≈ 0.4 — confirme conforme protocolo institucional</p>}
        />
      )}
    </form>
  );
}

function FormulaPanel() {
  const [desiredVolume, setDesiredVolume] = useState("");
  const [waterPerScoop, setWaterPerScoop] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(desiredVolume);
    const w = parseFloat(waterPerScoop);
    if (!v || !w) return;
    setResult(`${(v / w).toFixed(1)} medidas de pó`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Volume Desejado (mL) *" value={desiredVolume} onChange={setDesiredVolume} placeholder="Ex: 150" ring={RING} />
        <NumField label="Água por Medida (mL) *" value={waterPerScoop} onChange={setWaterPerScoop} placeholder="Ex: 30" ring={RING} />
      </div>
      <SubmitRow label="Calcular Medidas" icon={Calculator} gradientBtn={BTN} shadow="shadow-sky-500/20" onReset={() => { setDesiredVolume(""); setWaterPerScoop(""); setResult(null); }} />
      {result && (
        <ResultCard
          label="Medidas de Pó Necessárias:"
          value={result}
          formula={`${desiredVolume} mL ÷ ${waterPerScoop} mL por medida`}
          onCopy={() => copy(result)}
          copied={copied}
          colorClasses={COLOR}
          extra={<p className="text-[11px] text-slate-400 mt-1">Sempre siga a instrução do fabricante da fórmula</p>}
        />
      )}
    </form>
  );
}

export default function FluidBalanceCalculator() {
  const [sub, setSub] = useState("balance");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Droplets}
        gradient="from-sky-500 to-cyan-600"
        title="Balanço Hídrico e Nutrição"
        subtitle="Balanço 24h, necessidade hídrica, dieta enteral, calorias e eletrólitos"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-sky-600" />
      {sub === "balance" && <BalancePanel />}
      {sub === "need" && <NeedPanel />}
      {sub === "enteral" && <EnteralPanel />}
      {sub === "calorie" && <CaloriePanel />}
      {sub === "electrolyte" && <ElectrolytePanel />}
      {sub === "formula" && <FormulaPanel />}
    </div>
  );
}
