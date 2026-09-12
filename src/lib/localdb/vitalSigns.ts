"use client";

import { getDb, newId, nowIso } from "./client";
import type { VitalSignType } from "@/types";

export interface VitalSign {
  id: string;
  patientId: string;
  type: VitalSignType;
  value: number;
  systolic: number | null;
  diastolic: number | null;
  unit: string;
  recordedAt: string;
}

function rowToVital(r: Record<string, unknown>): VitalSign {
  return {
    id: r.id as string,
    patientId: r.patientId as string,
    type: r.type as VitalSignType,
    value: r.value as number,
    systolic: (r.systolic as number) ?? null,
    diastolic: (r.diastolic as number) ?? null,
    unit: r.unit as string,
    recordedAt: r.recordedAt as string,
  };
}

export async function listVitalSigns(filters: { patientId?: string | null; type?: string | null } = {}): Promise<VitalSign[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.patientId) {
    clauses.push("patientId = ?");
    params.push(filters.patientId);
  }
  if (filters.type) {
    clauses.push("type = ?");
    params.push(filters.type);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = filters.patientId ? 100 : 1000;
  const res = await db.query(`SELECT * FROM VitalSign ${where} ORDER BY recordedAt DESC LIMIT ${limit}`, params);
  return (res.values || []).map(rowToVital);
}

export interface CreateVitalSignInput {
  patientId: string;
  type: VitalSignType;
  value: number;
  systolic?: number | null;
  diastolic?: number | null;
  unit: string;
  recordedAt?: string;
}

export async function createVitalSign(data: CreateVitalSignInput): Promise<VitalSign> {
  const db = await getDb();
  const id = newId();
  const recordedAt = data.recordedAt || nowIso();
  const numValue = Number(data.value);
  const safeValue = Number.isFinite(numValue) ? numValue : 0;
  const safeSystolic = data.systolic != null && Number.isFinite(Number(data.systolic)) ? Math.round(Number(data.systolic)) : null;
  const safeDiastolic = data.diastolic != null && Number.isFinite(Number(data.diastolic)) ? Math.round(Number(data.diastolic)) : null;

  await db.run(
    `INSERT INTO VitalSign (id, patientId, type, value, systolic, diastolic, unit, recordedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.patientId, data.type, safeValue, safeSystolic, safeDiastolic, data.unit, recordedAt]
  );
  const res = await db.query(`SELECT * FROM VitalSign WHERE id = ?`, [id]);
  return rowToVital(res.values![0]);
}

export async function getLatestVitalSign(patientId: string, type: VitalSignType): Promise<VitalSign | null> {
  const db = await getDb();
  const res = await db.query(
    `SELECT * FROM VitalSign WHERE patientId = ? AND type = ? ORDER BY recordedAt DESC LIMIT 1`,
    [patientId, type]
  );
  if (!res.values || res.values.length === 0) return null;
  return rowToVital(res.values[0]);
}
