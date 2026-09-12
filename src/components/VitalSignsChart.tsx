"use client";

import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { VITAL_SIGN_TYPES } from "@/types";
import type { VitalSignType } from "@/types";
import { Activity } from "lucide-react";

interface VitalSign {
  id: string;
  type: string;
  value: number;
  systolic: number | null;
  diastolic: number | null;
  recordedAt: string;
}

export default function VitalSignsChart({ vitalSigns }: { vitalSigns: VitalSign[] }) {
  const [selectedType, setSelectedType] = useState<VitalSignType>("TEMPERATURA");

  const typesWithData = useMemo(() => {
    const types = new Set(vitalSigns.map((v) => v.type));
    return VITAL_SIGN_TYPES.filter((t) => types.has(t.value));
  }, [vitalSigns]);

  const chartData = useMemo(() => {
    const filtered = vitalSigns
      .filter((v) => v.type === selectedType)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    return filtered.map((v) => ({
      time: new Date(v.recordedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      value:
        selectedType === "PRESSAO_ARTERIAL" && v.systolic != null
          ? v.systolic
          : v.value,
      systolic: v.systolic,
      diastolic: v.diastolic,
      date: new Date(v.recordedAt).toLocaleDateString("pt-BR"),
    }));
  }, [vitalSigns, selectedType]);

  if (typesWithData.length === 0) return null;

  const currentTypeConfig = VITAL_SIGN_TYPES.find((t) => t.value === selectedType);

  return (
    <div className="bg-white dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-600 dark:text-blue-400" />
          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
            Curva Gráfica de Sinais Vitais
          </h4>
          {currentTypeConfig && (
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
              ({currentTypeConfig.unit})
            </span>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {typesWithData.map((t) => {
            const active = selectedType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  active
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-sm">
          Nenhum registro para este sinal vital.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="rgba(148, 163, 184, 0.2)" />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} stroke="rgba(148, 163, 184, 0.2)" domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.92)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(51, 65, 85, 0.6)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#f8fafc",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                }}
                labelStyle={{ fontWeight: "bold", color: "#93c5fd", marginBottom: "4px" }}
                labelFormatter={(_, payload) => {
                  if (payload?.[0]) return `${payload[0].payload.date} · ${payload[0].payload.time}`;
                  return "";
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={currentTypeConfig?.label || "Valor"}
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#2563eb", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#2563eb", strokeWidth: 2, fill: "#60a5fa" }}
              />
              {selectedType === "PRESSAO_ARTERIAL" && (
                <>
                  <Line type="monotone" dataKey="systolic" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 3 }} name="Sistólica (máx)" />
                  <Line type="monotone" dataKey="diastolic" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Diastólica (mín)" />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
