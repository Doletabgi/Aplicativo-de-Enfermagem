"use client";

import { getLatestVitalSign } from "./vitalSigns";
import { getValueStatus, getBpStatus } from "@/lib/vital-ranges";
import type { VitalSignType } from "@/types";

export type PatientStatus = "sem_dados" | "estavel" | "atencao" | "critico";

export async function getPatientStatus(patientId: string): Promise<PatientStatus> {
  const types: VitalSignType[] = [
    "TEMPERATURA",
    "PRESSAO_ARTERIAL",
    "FREQUENCIA_CARDIACA",
    "FREQUENCIA_RESPIRATORIA",
    "SATURACAO_O2",
    "GLICEMIA",
    "ESCALA_DE_DOR",
  ];

  let hasData = false;
  let hasAtencao = false;
  let hasCritico = false;

  for (const type of types) {
    const latest = await getLatestVitalSign(patientId, type);
    if (!latest) continue;
    hasData = true;

    if (type === "PRESSAO_ARTERIAL" && latest.systolic != null && latest.diastolic != null) {
      const bpStatus = getBpStatus(latest.systolic, latest.diastolic);
      if (bpStatus === "critico") hasCritico = true;
      else if (bpStatus === "atencao") hasAtencao = true;
    } else {
      const status = getValueStatus(type, latest.value);
      if (status === "critico") hasCritico = true;
      else if (status === "atencao") hasAtencao = true;
    }
  }

  if (!hasData) return "sem_dados";
  if (hasCritico) return "critico";
  if (hasAtencao) return "atencao";
  return "estavel";
}
