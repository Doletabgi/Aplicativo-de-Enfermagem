"use client";

import { getDb, newId, nowIso } from "./client";
import {
  parseScheduleDate,
  formatScheduleTime,
  calculateNextSchedule,
} from "@/lib/medication-status";

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string;
  schedule: string;
  frequencyHours: number | null;
  administered: boolean;
  administeredAt: string | null;
  observation: string;
  createdAt: string;
}

function rowToMed(r: Record<string, unknown>): Medication {
  return {
    id: r.id as string,
    patientId: r.patientId as string,
    name: r.name as string,
    dose: r.dose as string,
    schedule: r.schedule as string,
    frequencyHours: (r.frequencyHours as number) ?? null,
    administered: !!r.administered,
    administeredAt: (r.administeredAt as string) ?? null,
    observation: r.observation as string,
    createdAt: r.createdAt as string,
  };
}

export async function listMedications(filters: { patientId?: string | null } = {}): Promise<Medication[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.patientId) {
    clauses.push("patientId = ?");
    params.push(filters.patientId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.query(`SELECT * FROM Medication ${where} ORDER BY schedule ASC, createdAt DESC`, params);
  return (res.values || []).map(rowToMed);
}

export interface TodayMedication extends Medication {
  patientName: string;
  patientBed: string;
}

export interface AdministrationRecord {
  medicationId: string;
  scheduleTime: string;
  administeredAt: string;
}

export interface MedicationAdministrationRecord {
  id: string;
  medicationId: string;
  patientId: string;
  scheduledTime: string;
  administeredAt: string;
  observation?: string;
  earlyAdministration?: boolean;
  duplicateOverride?: boolean;
  medicationName?: string;
  patientName?: string;
  patientBed?: string;
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Filtra medicações do dia atual:
 * 1. Retorna apenas medicações cuja próxima dose programada seja HOJE (00:00–23:59 local).
 * 2. Se a medicação foi cadastrada com data futura (ex: amanhã), NÃO aparece hoje.
 * 3. Se dose única de ontem/passado já passou, NÃO aparece hoje.
 * 4. Se dose única já foi administrada em dia anterior, NÃO aparece hoje.
 * 5. Se recorrente foi administrada e renovou para ainda hoje, aparece com o novo horário.
 * 6. Se recorrente renovou para o dia seguinte, NÃO aparece hoje.
 */
export function filterMedicationsToday(
  meds: TodayMedication[],
  now: Date = new Date()
): TodayMedication[] {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const result: TodayMedication[] = [];

  for (const m of meds) {
    let schedDate: Date;
    const isRecurring = typeof m.frequencyHours === "number" && m.frequencyHours > 0;

    // Se m.schedule contém apenas horário (ex: "14:00") e temos createdAt com data diferente
    if (!m.schedule.includes("-") && !m.schedule.includes("/") && m.createdAt) {
      const cDate = new Date(m.createdAt);
      if (!isNaN(cDate.getTime())) {
        const timePart = m.schedule || "00:00";
        const [hStr, mStr] = timePart.split(":");
        const h = parseInt(hStr, 10) || 0;
        const mi = parseInt(mStr, 10) || 0;
        schedDate = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate(), h, mi, 0, 0);
      } else {
        schedDate = parseScheduleDate(m.schedule, now);
      }
    } else {
      schedDate = parseScheduleDate(m.schedule, now);
    }

    // Regra 1: Agendamento para dia futuro (> hoje 23:59:59) não aparece hoje
    if (schedDate.getTime() > todayEnd.getTime()) {
      continue;
    }

    // Regra 2: Agendamento anterior a hoje (< hoje 00:00:00)
    if (schedDate.getTime() < todayStart.getTime()) {
      if (!isRecurring) {
        // Dose única de dias anteriores já passou
        continue;
      } else {
        // Medicação recorrente de dias anteriores: avança pelo intervalo até hoje
        const freqMs = m.frequencyHours! * 3600 * 1000;
        let candidate = new Date(schedDate.getTime());
        while (candidate.getTime() < todayStart.getTime()) {
          candidate = new Date(candidate.getTime() + freqMs);
        }
        if (candidate.getTime() > todayEnd.getTime()) {
          continue;
        }
        schedDate = candidate;
      }
    }

    // Regra 3: Se medicação não recorrente já foi administrada em dia anterior, não reaparece hoje
    if (!isRecurring && m.administered && m.administeredAt) {
      const adminDate = new Date(m.administeredAt);
      if (!isNaN(adminDate.getTime()) && adminDate.getTime() < todayStart.getTime()) {
        continue;
      }
    }

    const timeFormatted = `${String(schedDate.getHours()).padStart(2, "0")}:${String(schedDate.getMinutes()).padStart(2, "0")}`;

    result.push({
      ...m,
      schedule: timeFormatted,
    });
  }

  // Ordena por horário ascendente, depois createdAt decrescente
  result.sort((a, b) => {
    const cmp = (a.schedule || "00:00").localeCompare(b.schedule || "00:00");
    if (cmp !== 0) return cmp;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return result;
}

// Alias para compatibilidade com código existente
export const filterAndExpandMedicationsToday = filterMedicationsToday;

export async function listMedicationsToday(): Promise<TodayMedication[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT m.*, p.name as patientName, p.bed as patientBed FROM Medication m
     JOIN Patient p ON p.id = m.patientId
     WHERE p.active = 1
     ORDER BY m.schedule ASC, m.createdAt DESC`
  );

  const rawMeds = (res.values || []).map((r) => ({
    ...rowToMed(r),
    patientName: (r.patientName as string) || "Paciente",
    patientBed: (r.patientBed as string) || "",
  }));

  const now = new Date();
  return filterMedicationsToday(rawMeds, now);
}

export interface CreateMedicationInput {
  patientId: string;
  name: string;
  dose: string;
  schedule: string;
  frequencyHours?: number | null;
  administered?: boolean;
  administeredAt?: string | null;
  observation?: string;
}

export async function createMedication(data: CreateMedicationInput): Promise<Medication> {
  const db = await getDb();
  const id = newId();
  const createdAt = nowIso();
  const freq = data.frequencyHours != null && Number.isFinite(Number(data.frequencyHours)) ? Math.round(Number(data.frequencyHours)) : null;
  await db.run(
    `INSERT INTO Medication (id, patientId, name, dose, schedule, frequencyHours, administered, administeredAt, observation, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.patientId,
      data.name,
      data.dose,
      data.schedule,
      freq,
      data.administered ? 1 : 0,
      data.administeredAt ?? null,
      data.observation || "",
      createdAt,
    ]
  );
  const res = await db.query(`SELECT * FROM Medication WHERE id = ?`, [id]);
  return rowToMed(res.values![0]);
}

export async function updateMedication(
  id: string,
  data: Partial<Omit<CreateMedicationInput, "patientId">>
): Promise<Medication> {
  const db = await getDb();
  const baseId = id.includes("__") ? id.split("__")[0] : id;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
  if (data.dose !== undefined) { fields.push("dose = ?"); params.push(data.dose); }
  if (data.schedule !== undefined) { fields.push("schedule = ?"); params.push(data.schedule); }
  if (data.frequencyHours !== undefined) {
    const freq = data.frequencyHours != null && Number.isFinite(Number(data.frequencyHours)) ? Math.round(Number(data.frequencyHours)) : null;
    fields.push("frequencyHours = ?");
    params.push(freq);
  }
  if (data.administered !== undefined) { fields.push("administered = ?"); params.push(data.administered ? 1 : 0); }
  if (data.administeredAt !== undefined) { fields.push("administeredAt = ?"); params.push(data.administeredAt); }
  if (data.observation !== undefined) { fields.push("observation = ?"); params.push(data.observation); }

  if (fields.length > 0) {
    params.push(baseId);
    await db.run(`UPDATE Medication SET ${fields.join(", ")} WHERE id = ?`, params);
  }
  const res = await db.query(`SELECT * FROM Medication WHERE id = ?`, [baseId]);
  const row = res.values?.[0];
  if (!row) {
    throw new Error(`Medication with id ${baseId} not found`);
  }

  const updated = rowToMed(row);
  return {
    ...updated,
    id,
    administered: data.administered !== undefined ? data.administered : updated.administered,
    administeredAt: data.administeredAt !== undefined ? data.administeredAt : updated.administeredAt,
  };
}

export async function recordMedicationAdministration(data: {
  medicationId: string;
  patientId?: string;
  scheduledTime: string;
  administeredAt?: string;
  observation?: string;
  earlyAdministration?: boolean;
  duplicateOverride?: boolean;
}): Promise<MedicationAdministrationRecord> {
  const db = await getDb();
  const id = newId();
  const now = new Date();
  const administeredAt = data.administeredAt || now.toISOString();
  const date = formatLocalDate(new Date(administeredAt));
  const patientId = data.patientId || "";
  const scheduledTime = data.scheduledTime || "";
  const observation = data.observation || "";
  const earlyAdministration = data.earlyAdministration ? 1 : 0;
  const duplicateOverride = data.duplicateOverride ? 1 : 0;

  await db.run(
    `INSERT INTO MedicationAdministration (id, medicationId, patientId, date, scheduleTime, scheduledTime, administered, administeredAt, observation, earlyAdministration, duplicateOverride)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    [id, data.medicationId, patientId, date, scheduledTime, scheduledTime, administeredAt, observation, earlyAdministration, duplicateOverride]
  );

  return {
    id,
    medicationId: data.medicationId,
    patientId,
    scheduledTime,
    administeredAt,
    observation,
    earlyAdministration: !!data.earlyAdministration,
    duplicateOverride: !!data.duplicateOverride,
  };
}

export async function listMedicationAdministrations(filters: {
  medicationId?: string;
  patientId?: string;
} = {}): Promise<MedicationAdministrationRecord[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.medicationId) {
    clauses.push("ma.medicationId = ?");
    params.push(filters.medicationId);
  }
  if (filters.patientId) {
    clauses.push("ma.patientId = ?");
    params.push(filters.patientId);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT ma.*, m.name as medicationName, p.name as patientName, p.bed as patientBed
     FROM MedicationAdministration ma
     LEFT JOIN Medication m ON m.id = ma.medicationId
     LEFT JOIN Patient p ON p.id = ma.patientId
     ${where}
     ORDER BY ma.administeredAt DESC`,
    params
  );

  return (res.values || []).map((r) => ({
    id: r.id as string,
    medicationId: r.medicationId as string,
    patientId: (r.patientId as string) || "",
    scheduledTime: (r.scheduledTime as string) || (r.scheduleTime as string) || "",
    administeredAt: r.administeredAt as string,
    observation: (r.observation as string) || "",
    earlyAdministration: !!r.earlyAdministration,
    duplicateOverride: !!r.duplicateOverride,
    medicationName: (r.medicationName as string) || undefined,
    patientName: (r.patientName as string) || undefined,
    patientBed: (r.patientBed as string) || undefined,
  }));
}

/**
 * Verifica se já existe administração recente da mesma medicação (janela de segurança):
 * Metade do intervalo da frequência (mínimo de 60 minutos); para dose única, mínimo de 60 minutos.
 */
export async function checkDuplicateAdministration(
  medicationId: string,
  frequencyHours: number | null,
  now: Date = new Date()
): Promise<{
  isDuplicate: boolean;
  lastAdministeredAt: string;
  minutesAgo: number;
  windowMinutes: number;
} | null> {
  const db = await getDb();
  const baseId = medicationId.includes("__") ? medicationId.split("__")[0] : medicationId;
  const res = await db.query(
    `SELECT administeredAt FROM MedicationAdministration
     WHERE medicationId = ?
     ORDER BY administeredAt DESC LIMIT 1`,
    [baseId]
  );
  if (!res.values || res.values.length === 0) return null;
  const lastAdminAt = res.values[0].administeredAt as string;
  if (!lastAdminAt) return null;

  const lastDate = new Date(lastAdminAt);
  if (isNaN(lastDate.getTime())) return null;

  const diffMs = now.getTime() - lastDate.getTime();
  const minutesAgo = Math.floor(diffMs / 60000);

  const windowMinutes = Math.max(
    60,
    frequencyHours && frequencyHours > 0 ? Math.floor((frequencyHours * 60) / 2) : 60
  );

  if (minutesAgo >= 0 && minutesAgo < windowMinutes) {
    return {
      isDuplicate: true,
      lastAdministeredAt: lastAdminAt,
      minutesAgo,
      windowMinutes,
    };
  }

  return null;
}

export interface AdministerMedicationResult {
  updatedMedication: Medication;
  toastMessage: string;
  nextSchedule: string | null;
}

/**
 * Registra a administração de uma medicação:
 * 1. Grava no histórico permanente (MedicationAdministration)
 * 2. Se recorrente (frequencyHours > 0): calcula novoSchedule = schedule + frequencyHours,
 *    reseta administered para false e salva o novo horário.
 * 3. Se dose única: marca administered = true com administeredAt = now.
 */
export async function administerMedication(
  med: TodayMedication | Medication,
  options?: {
    observation?: string;
    administeredAt?: string;
    earlyAdministration?: boolean;
    duplicateOverride?: boolean;
  }
): Promise<AdministerMedicationResult> {
  const now = new Date();
  const administeredAt = options?.administeredAt || now.toISOString();
  const schedTimeFormatted = formatScheduleTime(med.schedule);

  // 1. Gravar registro permanente no histórico
  await recordMedicationAdministration({
    medicationId: med.id,
    patientId: med.patientId,
    scheduledTime: schedTimeFormatted,
    administeredAt,
    observation: options?.observation || "",
    earlyAdministration: options?.earlyAdministration,
    duplicateOverride: options?.duplicateOverride,
  });

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // 2. Se medicação for recorrente (frequencyHours > 0), renovar horário
  if (med.frequencyHours && med.frequencyHours > 0) {
    const nextSchedule = calculateNextSchedule(med.schedule, med.frequencyHours, now);
    const updated = await updateMedication(med.id, {
      schedule: nextSchedule,
      administered: false,
      administeredAt: null,
      observation: options?.observation !== undefined ? options.observation : med.observation,
    });

    const nextTimeStr = formatScheduleTime(nextSchedule);
    const nextSchedDate = parseScheduleDate(nextSchedule, now);
    const isTomorrow =
      nextSchedDate.getDate() !== now.getDate() ||
      nextSchedDate.getMonth() !== now.getMonth() ||
      nextSchedDate.getFullYear() !== now.getFullYear();

    const nextLabel = isTomorrow ? `amanhã às ${nextTimeStr}` : `às ${nextTimeStr}`;
    const toastMessage = `${med.name} administrada às ${timeStr} — próxima dose ${nextLabel}`;

    return {
      updatedMedication: updated,
      toastMessage,
      nextSchedule,
    };
  } else {
    // Dose única / Se necessário (não recorrente)
    const updated = await updateMedication(med.id, {
      administered: true,
      administeredAt,
      observation: options?.observation !== undefined ? options.observation : med.observation,
    });

    const toastMessage = `${med.name} administrada às ${timeStr}`;

    return {
      updatedMedication: updated,
      toastMessage,
      nextSchedule: null,
    };
  }
}

/**
 * Desmarca uma administração (ex: dose única marcada por engano).
 */
export async function unadministerMedication(
  med: TodayMedication | Medication
): Promise<{ updatedMedication: Medication; toastMessage: string }> {
  const updated = await updateMedication(med.id, {
    administered: false,
    administeredAt: null,
  });

  return {
    updatedMedication: updated,
    toastMessage: `Administração de ${med.name} desmarcada.`,
  };
}

export async function deleteMedication(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM Medication WHERE id = ?`, [id]);
}
