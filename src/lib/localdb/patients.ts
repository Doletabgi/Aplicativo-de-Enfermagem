"use client";

import { getDb, newId, nowIso } from "./client";

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  bed: string;
  diagnosis: string;
  allergies: string;
  emergencyContact: string;
  emergencyPhone: string;
  photo: string;
  admissionDate: string;
  dischargeDate: string | null;
  active: boolean;
  priority: boolean;
  condition: string;
  createdAt: string;
}

function rowToPatient(r: Record<string, unknown>): Patient {
  return {
    id: r.id as string,
    name: r.name as string,
    birthDate: r.birthDate as string,
    gender: r.gender as string,
    bed: r.bed as string,
    diagnosis: r.diagnosis as string,
    allergies: r.allergies as string,
    emergencyContact: r.emergencyContact as string,
    emergencyPhone: r.emergencyPhone as string,
    photo: r.photo as string,
    admissionDate: r.admissionDate as string,
    dischargeDate: (r.dischargeDate as string) ?? null,
    active: !!r.active,
    priority: !!r.priority,
    condition: r.condition as string,
    createdAt: r.createdAt as string,
  };
}

export interface ListPatientsFilters {
  status?: "active" | "discharged" | null;
  priority?: boolean | null;
  search?: string | null;
  sort?: "priority" | null;
}

export async function listPatients(filters: ListPatientsFilters = {}): Promise<Patient[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.status === "active") clauses.push("active = 1");
  if (filters.status === "discharged") clauses.push("active = 0");
  if (filters.priority) clauses.push("priority = 1");
  if (filters.search) {
    clauses.push("(name LIKE ? OR bed LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const orderBy = filters.sort === "priority" ? "ORDER BY priority DESC, createdAt DESC" : "ORDER BY createdAt DESC";

  const res = await db.query(`SELECT * FROM Patient ${where} ${orderBy}`, params);
  return (res.values || []).map(rowToPatient);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM Patient WHERE id = ?`, [id]);
  if (!res.values || res.values.length === 0) return null;
  return rowToPatient(res.values[0]);
}

export interface CreatePatientInput {
  name: string;
  birthDate: string;
  gender: string;
  bed?: string;
  diagnosis?: string;
  allergies?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  photo?: string;
  admissionDate: string;
  condition?: string;
}

export async function createPatient(data: CreatePatientInput): Promise<Patient> {
  const db = await getDb();
  const id = newId();
  const createdAt = nowIso();
  await db.run(
    `INSERT INTO Patient (id, name, birthDate, gender, bed, diagnosis, allergies, emergencyContact, emergencyPhone, photo, admissionDate, active, priority, condition, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
    [
      id,
      data.name,
      data.birthDate,
      data.gender,
      data.bed || "",
      data.diagnosis || "",
      data.allergies || "",
      data.emergencyContact || "",
      data.emergencyPhone || "",
      data.photo || "",
      data.admissionDate,
      data.condition || "",
      createdAt,
    ]
  );
  return (await getPatientById(id))!;
}

export async function updatePatient(id: string, data: Partial<CreatePatientInput> & {
  dischargeDate?: string | null;
  active?: boolean;
  priority?: boolean;
}): Promise<Patient> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];

  const map: Record<string, unknown> = {
    name: data.name,
    birthDate: data.birthDate,
    gender: data.gender,
    bed: data.bed,
    diagnosis: data.diagnosis,
    allergies: data.allergies,
    emergencyContact: data.emergencyContact,
    emergencyPhone: data.emergencyPhone,
    photo: data.photo,
    admissionDate: data.admissionDate,
    dischargeDate: data.dischargeDate,
    condition: data.condition,
  };
  for (const [key, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (data.active !== undefined) {
    fields.push("active = ?");
    params.push(data.active ? 1 : 0);
  }
  if (data.priority !== undefined) {
    fields.push("priority = ?");
    params.push(data.priority ? 1 : 0);
  }

  if (fields.length > 0) {
    params.push(id);
    await db.run(`UPDATE Patient SET ${fields.join(", ")} WHERE id = ?`, params);
  }
  return (await getPatientById(id))!;
}

export async function setPatientPriority(id: string, priority: boolean): Promise<Patient> {
  return updatePatient(id, { priority });
}

export async function deletePatient(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM VitalSign WHERE patientId = ?`, [id]);
  await db.run(`DELETE FROM MedicationAdministration WHERE patientId = ?`, [id]);
  await db.run(`DELETE FROM Medication WHERE patientId = ?`, [id]);
  await db.run(`DELETE FROM NursingNote WHERE patientId = ?`, [id]);
  try {
    await db.run(`DELETE FROM Task WHERE patientId = ?`, [id]);
  } catch {}
  await db.run(`DELETE FROM Patient WHERE id = ?`, [id]);
}

/** Remove pacientes com alta há mais de N dias (equivalente à limpeza automática do backend). */
export const DISCHARGE_RETENTION_DAYS = 7;

export async function purgeDischargedPatients(): Promise<number> {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DISCHARGE_RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const res = await db.run(`DELETE FROM Patient WHERE active = 0 AND dischargeDate <= ?`, [cutoffStr]);
  return res.changes?.changes || 0;
}
