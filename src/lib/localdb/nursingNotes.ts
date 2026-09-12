"use client";

import { getDb, newId, nowIso } from "./client";

export interface NursingNote {
  id: string;
  patientId: string;
  content: string;
  createdAt: string;
}

function rowToNote(r: Record<string, unknown>): NursingNote {
  return {
    id: r.id as string,
    patientId: r.patientId as string,
    content: r.content as string,
    createdAt: r.createdAt as string,
  };
}

export async function listNursingNotes(patientId: string): Promise<NursingNote[]> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM NursingNote WHERE patientId = ? ORDER BY createdAt DESC`, [patientId]);
  return (res.values || []).map(rowToNote);
}

export async function createNursingNote(data: { patientId: string; content: string; createdAt?: string }): Promise<NursingNote> {
  const db = await getDb();
  const id = newId();
  const createdAt = data.createdAt || nowIso();
  await db.run(`INSERT INTO NursingNote (id, patientId, content, createdAt) VALUES (?, ?, ?, ?)`, [
    id,
    data.patientId,
    data.content,
    createdAt,
  ]);
  const res = await db.query(`SELECT * FROM NursingNote WHERE id = ?`, [id]);
  return rowToNote(res.values![0]);
}

export async function updateNursingNote(id: string, content: string): Promise<NursingNote> {
  const db = await getDb();
  await db.run(`UPDATE NursingNote SET content = ? WHERE id = ?`, [content, id]);
  const res = await db.query(`SELECT * FROM NursingNote WHERE id = ?`, [id]);
  return rowToNote(res.values![0]);
}

export async function deleteNursingNote(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM NursingNote WHERE id = ?`, [id]);
}
