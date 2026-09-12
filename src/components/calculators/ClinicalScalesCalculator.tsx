"use client";

import { useState } from "react";
import { ClipboardList, Calculator } from "lucide-react";
import { PanelHeader, NumField, SelectField, SubmitRow, ResultCard, SubTabs, useCopy } from "./ui";

const COLOR = {
  bg: "bg-indigo-50/80 dark:bg-indigo-950/40",
  border: "border-indigo-200 dark:border-indigo-800/50",
  text: "text-indigo-700 dark:text-indigo-300",
  textStrong: "text-indigo-900 dark:text-indigo-100",
  icon: "text-indigo-600 dark:text-indigo-400",
};
const BTN = "from-indigo-500 to-violet-600 hover:from-indigo-600";
const RING = "focus:ring-indigo-500/50";

const SUBTABS = [
  { key: "glasgow", label: "Glasgow" },
  { key: "braden", label: "Braden" },
  { key: "apgar", label: "APGAR" },
  { key: "burns", label: "Regra dos Nove" },
  { key: "bmi", label: "IMC" },
  { key: "bsa", label: "Superfície Corporal" },
  { key: "morse", label: "Morse (Queda)" },
  { key: "pain", label: "Escala de Dor" },
  { key: "sedation", label: "Ramsay/RASS" },
];

/* ---------- Genérico: escala com critérios em select, soma pontuada ---------- */
function ScoredScale({
  criteria,
  classify,
  submitLabel,
  resultLabel,
}: {
  criteria: { key: string; label: string; options: { value: string; label: string; points: number }[] }[];
  classify: (total: number) => string;
  submitLabel: string;
  resultLabel: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(criteria.map((c) => [c.key, c.options[0].value]))
  );
  const [result, setResult] = useState<{ total: number; label: string } | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    let total = 0;
    for (const c of criteria) {
      const opt = c.options.find((o) => o.value === values[c.key]);
      total += opt ? opt.points : 0;
    }
    setResult({ total, label: classify(total) });
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {criteria.map((c) => (
          <SelectField
            key={c.key}
            label={c.label}
            value={values[c.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [c.key]: v }))}
            options={c.options.map((o) => ({ value: o.value, label: `${o.label} (${o.points})` }))}
          />
        ))}
      </div>
      <SubmitRow label={submitLabel} icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => setResult(null)} />
      {result && (
        <ResultCard
          label={resultLabel}
          value={`${result.total} pontos`}
          formula={result.label}
          onCopy={() => copy(`${result.total} pontos — ${result.label}`)}
          copied={copied}
          colorClasses={COLOR}
        />
      )}
    </form>
  );
}

function GlasgowPanel() {
  return (
    <ScoredScale
      submitLabel="Calcular Glasgow"
      resultLabel="Escala de Coma de Glasgow:"
      criteria={[
        {
          key: "eye", label: "Abertura Ocular", options: [
            { value: "4", label: "Espontânea", points: 4 },
            { value: "3", label: "Ao estímulo verbal", points: 3 },
            { value: "2", label: "Ao estímulo doloroso", points: 2 },
            { value: "1", label: "Ausente", points: 1 },
          ]
        },
        {
          key: "verbal", label: "Resposta Verbal", options: [
            { value: "5", label: "Orientado", points: 5 },
            { value: "4", label: "Confuso", points: 4 },
            { value: "3", label: "Palavras inapropriadas", points: 3 },
            { value: "2", label: "Sons incompreensíveis", points: 2 },
            { value: "1", label: "Ausente", points: 1 },
          ]
        },
        {
          key: "motor", label: "Resposta Motora", options: [
            { value: "6", label: "Obedece comandos", points: 6 },
            { value: "5", label: "Localiza a dor", points: 5 },
            { value: "4", label: "Retirada à dor", points: 4 },
            { value: "3", label: "Flexão anormal (decorticação)", points: 3 },
            { value: "2", label: "Extensão anormal (descerebração)", points: 2 },
            { value: "1", label: "Ausente", points: 1 },
          ]
        },
      ]}
      classify={(t) => (t >= 13 ? "TCE Leve (13-15)" : t >= 9 ? "TCE Moderado (9-12)" : "TCE Grave (≤8)")}
    />
  );
}

function BradenPanel() {
  const lvl4 = [
    { value: "1", label: "Completamente limitada/molhada/acamado/imóvel", points: 1 },
    { value: "2", label: "Muito limitada", points: 2 },
    { value: "3", label: "Levemente limitada", points: 3 },
    { value: "4", label: "Nenhuma limitação", points: 4 },
  ];
  return (
    <ScoredScale
      submitLabel="Calcular Braden"
      resultLabel="Escala de Braden (Risco de Lesão por Pressão):"
      criteria={[
        { key: "sens", label: "Percepção Sensorial", options: lvl4 },
        { key: "moist", label: "Umidade", options: lvl4 },
        { key: "act", label: "Atividade", options: lvl4 },
        { key: "mob", label: "Mobilidade", options: lvl4 },
        { key: "nutr", label: "Nutrição", options: lvl4 },
        {
          key: "fric", label: "Fricção e Cisalhamento", options: [
            { value: "1", label: "Problema", points: 1 },
            { value: "2", label: "Problema em potencial", points: 2 },
            { value: "3", label: "Nenhum problema", points: 3 },
          ]
        },
      ]}
      classify={(t) => (t <= 9 ? "Risco Muito Alto • Indicado Relógio de Lowthian (2h/2h)" : t <= 12 ? "Risco Alto • Indicado Relógio de Lowthian (2h/2h)" : t <= 14 ? "Risco Moderado • Indicado Relógio de Lowthian (2h/3h)" : t <= 18 ? "Risco Baixo • Vigilância de decúbito" : "Sem Risco")}
    />
  );
}

function ApgarPanel() {
  const opts012 = (a: string, b: string, c: string) => [
    { value: "0", label: a, points: 0 },
    { value: "1", label: b, points: 1 },
    { value: "2", label: c, points: 2 },
  ];
  return (
    <ScoredScale
      submitLabel="Calcular APGAR"
      resultLabel="Índice de APGAR:"
      criteria={[
        { key: "fc", label: "Frequência Cardíaca", options: opts012("Ausente", "< 100 bpm", "≥ 100 bpm") },
        { key: "resp", label: "Esforço Respiratório", options: opts012("Ausente", "Fraco / irregular", "Choro forte") },
        { key: "tono", label: "Tônus Muscular", options: opts012("Flácido", "Alguma flexão", "Movimento ativo") },
        { key: "irr", label: "Irritabilidade Reflexa", options: opts012("Sem resposta", "Careta", "Choro / tosse / espirro") },
        { key: "cor", label: "Cor da Pele", options: opts012("Cianótico / pálido", "Corpo rosado, extremidades cianóticas", "Totalmente rosado") },
      ]}
      classify={(t) => (t >= 7 ? "Normal (7-10)" : t >= 4 ? "Moderadamente Deprimido (4-6)" : "Severamente Deprimido (0-3)")}
    />
  );
}

function BurnsPanel() {
  const [areas, setAreas] = useState({ head: "", rArm: "", lArm: "", trunkF: "", trunkB: "", rLeg: "", lLeg: "", genital: "" });
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const set = (k: keyof typeof areas) => (v: string) => setAreas((p) => ({ ...p, [k]: v }));

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Object.values(areas).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
    setResult(`${total.toFixed(1)}% de Superfície Corporal Queimada`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <p className="text-xs text-slate-500">Informe o % queimado em cada área (referência adulto: cabeça 9%, cada braço 9%, tronco anterior/posterior 18% cada, cada perna 18%, genitália 1%)</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <NumField label="Cabeça/Pescoço (%)" value={areas.head} onChange={set("head")} placeholder="9" required={false} ring={RING} />
        <NumField label="MS Direito (%)" value={areas.rArm} onChange={set("rArm")} placeholder="9" required={false} ring={RING} />
        <NumField label="MS Esquerdo (%)" value={areas.lArm} onChange={set("lArm")} placeholder="9" required={false} ring={RING} />
        <NumField label="Tronco Anterior (%)" value={areas.trunkF} onChange={set("trunkF")} placeholder="18" required={false} ring={RING} />
        <NumField label="Tronco Posterior (%)" value={areas.trunkB} onChange={set("trunkB")} placeholder="18" required={false} ring={RING} />
        <NumField label="MI Direito (%)" value={areas.rLeg} onChange={set("rLeg")} placeholder="18" required={false} ring={RING} />
        <NumField label="MI Esquerdo (%)" value={areas.lLeg} onChange={set("lLeg")} placeholder="18" required={false} ring={RING} />
        <NumField label="Genitália (%)" value={areas.genital} onChange={set("genital")} placeholder="1" required={false} ring={RING} />
      </div>
      <SubmitRow label="Calcular SCQ" icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => { setAreas({ head: "", rArm: "", lArm: "", trunkF: "", trunkB: "", rLeg: "", lLeg: "", genital: "" }); setResult(null); }} />
      {result && <ResultCard label="Regra dos Nove:" value={result} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function BmiPanel() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState(""); // metros
  const [result, setResult] = useState<{ value: string; label: string } | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h) return;
    const bmi = w / (h * h);
    let label = "Obesidade Grau III";
    if (bmi < 18.5) label = "Abaixo do Peso";
    else if (bmi < 25) label = "Peso Normal";
    else if (bmi < 30) label = "Sobrepeso";
    else if (bmi < 35) label = "Obesidade Grau I";
    else if (bmi < 40) label = "Obesidade Grau II";
    setResult({ value: `${bmi.toFixed(1)} kg/m²`, label });
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring={RING} />
        <NumField label="Altura (m) *" value={height} onChange={setHeight} placeholder="Ex: 1.70" ring={RING} />
      </div>
      <SubmitRow label="Calcular IMC" icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => { setWeight(""); setHeight(""); setResult(null); }} />
      {result && <ResultCard label="Índice de Massa Corporal:" value={result.value} formula={result.label} onCopy={() => copy(`${result.value} — ${result.label}`)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function BsaPanel() {
  const [height, setHeight] = useState(""); // cm
  const [weight, setWeight] = useState(""); // kg
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) return;
    const bsa = Math.sqrt((h * w) / 3600);
    setResult(`${bsa.toFixed(2)} m²`);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumField label="Altura (cm) *" value={height} onChange={setHeight} placeholder="Ex: 170" ring={RING} />
        <NumField label="Peso (kg) *" value={weight} onChange={setWeight} placeholder="Ex: 70" ring={RING} />
      </div>
      <SubmitRow label="Calcular Superfície Corporal" icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => { setHeight(""); setWeight(""); setResult(null); }} />
      {result && <ResultCard label="Superfície Corporal:" value={result} formula="SC = √[(Altura(cm) × Peso(kg)) ÷ 3600]" onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function MorsePanel() {
  return (
    <ScoredScale
      submitLabel="Calcular Morse"
      resultLabel="Escala de Morse (Risco de Queda):"
      criteria={[
        { key: "hist", label: "Histórico de Quedas", options: [{ value: "0", label: "Não", points: 0 }, { value: "25", label: "Sim", points: 25 }] },
        { key: "diag", label: "Diagnóstico Secundário", options: [{ value: "0", label: "Não", points: 0 }, { value: "15", label: "Sim", points: 15 }] },
        { key: "aux", label: "Auxílio para Deambular", options: [
          { value: "0", label: "Nenhum / acamado / cadeira de rodas", points: 0 },
          { value: "15", label: "Muletas / bengala / andador", points: 15 },
          { value: "30", label: "Apoia-se em mobiliário", points: 30 },
        ]},
        { key: "iv", label: "Terapia IV / Heparin Lock", options: [{ value: "0", label: "Não", points: 0 }, { value: "20", label: "Sim", points: 20 }] },
        { key: "marcha", label: "Marcha", options: [
          { value: "0", label: "Normal / acamado / imóvel", points: 0 },
          { value: "10", label: "Fraca", points: 10 },
          { value: "20", label: "Comprometida", points: 20 },
        ]},
        { key: "mental", label: "Estado Mental", options: [
          { value: "0", label: "Orientado quanto à própria capacidade", points: 0 },
          { value: "15", label: "Superestima capacidade / esquece limitações", points: 15 },
        ]},
      ]}
      classify={(t) => (t <= 24 ? "Risco Baixo" : t <= 50 ? "Risco Moderado" : "Risco Alto")}
    />
  );
}

function PainPanel() {
  const [level, setLevel] = useState("0");
  const [result, setResult] = useState<{ label: string } | null>(null);
  const { copied, copy } = useCopy();

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(level, 10);
    const label = n === 0 ? "Sem Dor" : n <= 3 ? "Dor Leve" : n <= 6 ? "Dor Moderada" : "Dor Intensa";
    setResult({ label });
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <SelectField
        label="Nível de Dor Relatado (Escala Numérica/EVA)"
        value={level}
        onChange={setLevel}
        options={Array.from({ length: 11 }, (_, i) => ({ value: String(i), label: String(i) }))}
      />
      <SubmitRow label="Classificar Dor" icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => { setLevel("0"); setResult(null); }} />
      {result && <ResultCard label="Classificação da Dor:" value={`${level} / 10`} formula={result.label} onCopy={() => copy(`${level}/10 — ${result.label}`)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

function SedationPanel() {
  const [scale, setScale] = useState<"ramsay" | "rass">("rass");
  const RASS = [
    { value: "4", label: "+4 Combativo" }, { value: "3", label: "+3 Muito agitado" },
    { value: "2", label: "+2 Agitado" }, { value: "1", label: "+1 Inquieto" },
    { value: "0", label: "0 Alerta e calmo" }, { value: "-1", label: "-1 Sonolento" },
    { value: "-2", label: "-2 Sedação leve" }, { value: "-3", label: "-3 Sedação moderada" },
    { value: "-4", label: "-4 Sedação profunda" }, { value: "-5", label: "-5 Não desperta" },
  ];
  const RAMSAY = [
    { value: "1", label: "1 — Ansioso, agitado" },
    { value: "2", label: "2 — Cooperativo, orientado, tranquilo" },
    { value: "3", label: "3 — Responde apenas a comandos" },
    { value: "4", label: "4 — Resposta rápida ao estímulo glabelar/auditivo" },
    { value: "5", label: "5 — Resposta lenta ao estímulo" },
    { value: "6", label: "6 — Sem resposta" },
  ];
  const [value, setValue] = useState("0");
  const [result, setResult] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const options = scale === "rass" ? RASS : RAMSAY;

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const opt = options.find((o) => o.value === value);
    setResult(opt ? opt.label : null);
  };

  return (
    <form onSubmit={calc} className="space-y-4">
      <SubTabs
        items={[{ key: "rass", label: "RASS" }, { key: "ramsay", label: "Ramsay" }]}
        active={scale}
        onChange={(k) => { setScale(k as "ramsay" | "rass"); setValue(k === "rass" ? "0" : "1"); setResult(null); }}
        activeClasses="bg-indigo-600"
      />
      <SelectField label={scale === "rass" ? "Nível RASS" : "Nível Ramsay"} value={value} onChange={setValue} options={options} />
      <SubmitRow label="Registrar Nível" icon={Calculator} gradientBtn={BTN} shadow="shadow-indigo-500/20" onReset={() => setResult(null)} />
      {result && <ResultCard label={`Escala de Sedação (${scale === "rass" ? "RASS" : "Ramsay"}):`} value={result} onCopy={() => copy(result)} copied={copied} colorClasses={COLOR} />}
    </form>
  );
}

export default function ClinicalScalesCalculator() {
  const [sub, setSub] = useState("glasgow");

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={ClipboardList}
        gradient="from-indigo-500 to-violet-600"
        title="Escalas e Índices Clínicos"
        subtitle="Glasgow, Braden, APGAR, Regra dos Nove, IMC, SC, Morse, Dor e Sedação"
      />
      <SubTabs items={SUBTABS} active={sub} onChange={setSub} activeClasses="bg-indigo-600" />
      {sub === "glasgow" && <GlasgowPanel />}
      {sub === "braden" && <BradenPanel />}
      {sub === "apgar" && <ApgarPanel />}
      {sub === "burns" && <BurnsPanel />}
      {sub === "bmi" && <BmiPanel />}
      {sub === "bsa" && <BsaPanel />}
      {sub === "morse" && <MorsePanel />}
      {sub === "pain" && <PainPanel />}
      {sub === "sedation" && <SedationPanel />}
    </div>
  );
}
