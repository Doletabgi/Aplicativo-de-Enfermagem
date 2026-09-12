export type VitalSignType =
  | "TEMPERATURA"
  | "PRESSAO_ARTERIAL"
  | "FREQUENCIA_CARDIACA"
  | "FREQUENCIA_RESPIRATORIA"
  | "SATURACAO_O2"
  | "GLICEMIA"
  | "ESCALA_DE_DOR";

export const VITAL_SIGN_TYPES: { value: VitalSignType; label: string; unit: string }[] = [
  { value: "TEMPERATURA", label: "Temperatura", unit: "°C" },
  { value: "PRESSAO_ARTERIAL", label: "Pressão Arterial", unit: "mmHg" },
  { value: "FREQUENCIA_CARDIACA", label: "Frequência Cardíaca", unit: "bpm" },
  { value: "FREQUENCIA_RESPIRATORIA", label: "Frequência Respiratória", unit: "irpm" },
  { value: "SATURACAO_O2", label: "Saturação O₂", unit: "%" },
  { value: "GLICEMIA", label: "Glicemia", unit: "mg/dL" },
  { value: "ESCALA_DE_DOR", label: "Escala de Dor", unit: "0-10" },
];

export interface VitalRange {
  minNormal: number;
  maxNormal: number;
  minCritical: number;
  maxCritical: number;
}
