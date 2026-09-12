"use client";

import { useState } from "react";
import { Droplets } from "lucide-react";
import { PanelHeader, NumField, SubmitRow } from "./ui";

export default function DripCalculator() {
  const [volume, setVolume] = useState("");
  const [time, setTime] = useState("");
  const [macro, setMacro] = useState<string | null>(null);
  const [micro, setMicro] = useState<string | null>(null);

  const calc = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(volume);
    const t = parseFloat(time);
    if (!v || !t) return;
    const m = v / (t * 3);
    const mi = v / t;
    setMacro(`${Math.round(m)} gotas/min (${m.toFixed(1)})`);
    setMicro(`${Math.round(mi)} microgotas/min (${mi.toFixed(1)})`);
  };

  const reset = () => { setVolume(""); setTime(""); setMacro(null); setMicro(null); };

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-7 space-y-5">
      <PanelHeader
        icon={Droplets}
        gradient="from-emerald-500 to-teal-600"
        title="Cálculo de Gotejamento de Infusão"
        subtitle="Macrogotas: V ÷ (T × 3) | Microgotas: V ÷ T"
      />

      <form onSubmit={calc} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumField label="Volume Total da Solução (mL) *" value={volume} onChange={setVolume} placeholder="Ex: 500, 1000" ring="focus:ring-emerald-500/50" />
          <NumField label="Tempo de Infusão (Horas) *" value={time} onChange={setTime} placeholder="Ex: 8, 12, 24" ring="focus:ring-emerald-500/50" />
        </div>
        <SubmitRow label="Calcular Gotejamento" icon={Droplets} gradientBtn="from-emerald-500 to-teal-600 hover:from-emerald-600" shadow="shadow-emerald-500/20" onReset={reset} />
      </form>

      {macro && micro && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
          <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Equipo Macrogotas:</p>
            <p className="text-2xl font-extrabold text-emerald-900 dark:text-emerald-100 font-mono mt-1">{macro}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{volume} mL ÷ ({time}h × 3)</p>
          </div>
          <div className="p-5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/50">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Equipo Microgotas:</p>
            <p className="text-2xl font-extrabold text-teal-900 dark:text-teal-100 font-mono mt-1">{micro}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{volume} mL ÷ {time}h</p>
          </div>
        </div>
      )}
    </div>
  );
}
