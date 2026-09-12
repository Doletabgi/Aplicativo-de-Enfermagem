import type { VitalSignType, VitalRange } from "@/types";

export const VITAL_RANGES: Record<VitalSignType, VitalRange> = {
  TEMPERATURA: { minNormal: 36.0, maxNormal: 37.5, minCritical: 35.0, maxCritical: 40.0 },
  PRESSAO_ARTERIAL: { minNormal: 90, maxNormal: 140, minCritical: 80, maxCritical: 180 },
  FREQUENCIA_CARDIACA: { minNormal: 60, maxNormal: 100, minCritical: 40, maxCritical: 140 },
  FREQUENCIA_RESPIRATORIA: { minNormal: 12, maxNormal: 20, minCritical: 8, maxCritical: 30 },
  SATURACAO_O2: { minNormal: 95, maxNormal: 100, minCritical: 90, maxCritical: 100 },
  GLICEMIA: { minNormal: 70, maxNormal: 140, minCritical: 50, maxCritical: 250 },
  ESCALA_DE_DOR: { minNormal: 0, maxNormal: 3, minCritical: 0, maxCritical: 10 },
};

export const PLAUSIBLE_RANGES: Record<VitalSignType, { min: number; max: number }> = {
  TEMPERATURA: { min: 30, max: 43 },
  PRESSAO_ARTERIAL: { min: 30, max: 300 },
  FREQUENCIA_CARDIACA: { min: 20, max: 250 },
  FREQUENCIA_RESPIRATORIA: { min: 4, max: 60 },
  SATURACAO_O2: { min: 50, max: 100 },
  GLICEMIA: { min: 10, max: 600 },
  ESCALA_DE_DOR: { min: 0, max: 10 },
};

export type VitalStatus = "normal" | "atencao" | "critico";

export function getValueStatus(type: VitalSignType, value: number): VitalStatus {
  const range = VITAL_RANGES[type];
  if (!range) return "normal";

  if (type === "SATURACAO_O2") {
    if (value < range.minCritical) return "critico";
    if (value < range.minNormal) return "atencao";
    return "normal";
  }

  if (value < range.minCritical || value > range.maxCritical) return "critico";
  if (value < range.minNormal || value > range.maxNormal) return "atencao";
  return "normal";
}

export function getBpStatus(systolic: number, diastolic: number): VitalStatus {
  const range = VITAL_RANGES.PRESSAO_ARTERIAL;
  const systolicCritical = systolic < 80 || systolic > 180;
  const diastolicCritical = diastolic < 50 || diastolic > 110;
  const systolicNormal = systolic >= 90 && systolic <= 140;
  const diastolicNormal = diastolic >= 60 && diastolic <= 90;

  if (systolicCritical || diastolicCritical) return "critico";
  if (!systolicNormal || !diastolicNormal) return "atencao";
  return "normal";
}
