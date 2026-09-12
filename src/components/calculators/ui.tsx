"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { Copy, Check, RotateCcw } from "lucide-react";

/** Copia texto para a área de transferência e controla o estado "copiado" por 2s */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível - ignora silenciosamente
    }
  };
  return { copied, copy };
}

/** Cabeçalho padrão de cada painel de calculadora */
export function PanelHeader({
  icon: Icon,
  gradient: _gradient,
  title,
  subtitle,
}: {
  icon: ElementType;
  gradient?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div className="w-9 h-9 rounded-lg bg-teal-800 dark:bg-teal-700 text-white flex items-center justify-center shadow-xs shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h2>
        <p className="text-xs text-slate-500 font-mono">{subtitle}</p>
      </div>
    </div>
  );
}

/** Campo numérico simples (sem seletor de unidade) */
export function NumField({
  label,
  value,
  onChange,
  placeholder,
  required = true,
  ring = "focus:ring-blue-500/50",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  ring?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 ${ring} outline-none`}
      />
    </div>
  );
}

/** Campo numérico com seletor de unidade ao lado */
export function UnitField({
  label,
  value,
  onChange,
  unit,
  onUnitChange,
  units,
  placeholder,
  required = true,
  ring = "focus:ring-blue-500/50",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  onUnitChange: (v: string) => void;
  units: string[];
  placeholder?: string;
  required?: boolean;
  ring?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className={`flex-1 min-w-0 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 ${ring} outline-none`}
        />
        <select
          value={unit}
          onChange={(e) => onUnitChange(e.target.value)}
          className="w-20 px-2 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
        >
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Select genérico com rótulo (para escalas clínicas, dispositivos, etc.) */
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/** Botões de submit + limpar com padrão clínico e touch targets adequados */
export function SubmitRow({
  label,
  icon: Icon,
  gradientBtn: _gradientBtn,
  shadow: _shadow,
  onReset,
}: {
  label: string;
  icon: ElementType;
  gradientBtn?: string;
  shadow?: string;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <button
        type="submit"
        className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98] min-h-[44px]"
      >
        <Icon size={15} /> {label}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Limpar campos"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}

/** Card de resultado com valor em destaque, fórmula opcional e botão de copiar */
export function ResultCard({
  label,
  value,
  formula,
  colorClasses,
  onCopy,
  copied,
  extra,
}: {
  label: string;
  value: string;
  formula?: string;
  colorClasses: { bg: string; border: string; text: string; textStrong: string; icon: string };
  onCopy?: () => void;
  copied?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className={`p-5 rounded-2xl ${colorClasses.bg} border ${colorClasses.border} flex items-center justify-between gap-4 animate-fade-in`}>
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider ${colorClasses.text}`}>{label}</p>
        <p className={`text-2xl sm:text-3xl font-extrabold ${colorClasses.textStrong} font-mono mt-1`}>{value}</p>
        {formula && <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">{formula}</p>}
        {extra}
      </div>
      {onCopy && (
        <button
          onClick={onCopy}
          className={`p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${colorClasses.icon} shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shrink-0`}
          title="Copiar resultado"
        >
          {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
        </button>
      )}
    </div>
  );
}

/** Abas secundárias dentro de uma categoria que tem múltiplos subitens */
export function SubTabs({
  items,
  active,
  onChange,
  activeClasses,
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
  activeClasses: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              isActive
                ? `${activeClasses} text-white border-transparent shadow-sm`
                : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
