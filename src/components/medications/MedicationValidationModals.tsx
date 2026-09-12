"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ShieldAlert, X } from "lucide-react";
import { type TodayMedication } from "@/lib/localdb";
import { formatScheduleTime } from "@/lib/medication-status";

export interface EarlyAdminPromptData {
  medication: TodayMedication;
  scheduledTime: string;
  minutesRemaining: number;
}

export interface DuplicatePromptData {
  medication: TodayMedication;
  lastAdministeredAt: string;
  minutesAgo: number;
}

export interface EarlyAdminModalProps {
  data: EarlyAdminPromptData | null;
  onClose: () => void;
  onConfirm: (observation: string) => void;
}

export function EarlyAdminModal({ data, onClose, onConfirm }: EarlyAdminModalProps) {
  const [observation, setObservation] = useState("");
  const [error, setError] = useState(false);

  if (!data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!observation.trim()) {
      setError(true);
      return;
    }
    onConfirm(observation.trim());
    setObservation("");
    setError(false);
  };

  const schedFormatted = formatScheduleTime(data.scheduledTime);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#111927] rounded-3xl border-2 border-amber-500 max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
          <Clock size={32} />
        </div>

        <div className="text-center space-y-1.5">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            Atenção: Horário Antecipado
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Administração antecipada
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Esta dose está programada para as <strong>{schedFormatted}</strong>. Faltam <strong>{data.minutesRemaining} minutos</strong>. Deseja confirmar a administração agora?
          </p>
        </div>

        <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-900 space-y-1 text-xs">
          <p className="font-bold text-amber-900 dark:text-amber-200">
            {data.medication.name} ({data.medication.dose})
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-[11px]">
            Paciente: <strong>{data.medication.patientName}</strong> {data.medication.patientBed ? `• Leito ${data.medication.patientBed}` : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Motivo da antecipação (obrigatório) *
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => {
                setObservation(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
              placeholder="Ex: Motivo da antecipação: paciente em jejum para exame"
              className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                error ? "border-rose-500" : "border-slate-200 dark:border-slate-700"
              } rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500 resize-none`}
            />
            {error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                Por favor, justifique o motivo da administração antecipada.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs min-h-[40px] cursor-pointer"
            >
              Confirmar administração antecipada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface DuplicateModalProps {
  data: DuplicatePromptData | null;
  onClose: () => void;
  onConfirm: (observation: string) => void;
}

export function DuplicateModal({ data, onClose, onConfirm }: DuplicateModalProps) {
  const [observation, setObservation] = useState("");
  const [error, setError] = useState(false);

  if (!data) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!observation.trim()) {
      setError(true);
      return;
    }
    onConfirm(observation.trim());
    setObservation("");
    setError(false);
  };

  const lastTimeFormatted = new Date(data.lastAdministeredAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#111927] rounded-3xl border-2 border-rose-500 max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle size={32} />
        </div>

        <div className="text-center space-y-1.5">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            Alerta de Segurança Farmacológica
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Possível dose duplicada
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Esta medicação já foi administrada às <strong>{lastTimeFormatted}</strong> (há <strong>{data.minutesAgo} min</strong>). Tem certeza que deseja registrar uma nova dose agora?
          </p>
        </div>

        <div className="p-3.5 bg-rose-50/80 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-1 text-xs">
          <p className="font-bold text-rose-900 dark:text-rose-200">
            {data.medication.name} ({data.medication.dose})
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-[11px]">
            Paciente: <strong>{data.medication.patientName}</strong> {data.medication.patientBed ? `• Leito ${data.medication.patientBed}` : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Justificativa / Motivo da dose extra (obrigatório) *
            </label>
            <textarea
              rows={2}
              value={observation}
              onChange={(e) => {
                setObservation(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
              placeholder="Ex: Dose de resgate prescrita pelo médico às 15h"
              className={`w-full p-2.5 bg-slate-50 dark:bg-slate-800/80 border ${
                error ? "border-rose-500" : "border-slate-200 dark:border-slate-700"
              } rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-rose-500 resize-none`}
            />
            {error && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                Por favor, justifique o motivo da administração para prosseguir.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[40px] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs min-h-[40px] cursor-pointer"
            >
              Confirmar mesmo assim
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
