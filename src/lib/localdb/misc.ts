"use client";

import { getDb, newId, nowIso } from "./client";

/* ---------------- Escala 6x1 ---------------- */

export interface Scale6x1Record {
  id: string;
  month: string;
  data: string;
  savedAt: string;
}

function rowToScale(r: Record<string, unknown>): Scale6x1Record {
  return {
    id: r.id as string,
    month: r.month as string,
    data: r.data as string,
    savedAt: r.savedAt as string,
  };
}

export type ScaleType = "6x1" | "12x36" | "5x2" | "personalizada";

export function extractScaleMonth(rawMonth: string): string {
  if (!rawMonth) return "";
  const parts = rawMonth.split(":");
  return parts.length > 1 ? parts[1] : parts[0];
}

export async function listScales(): Promise<Scale6x1Record[]> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM Scale6x1 ORDER BY savedAt DESC`, []);
  return (res.values || []).map(rowToScale);
}

export async function listScalesByType(type: ScaleType): Promise<Scale6x1Record[]> {
  const all = await listScales();
  if (type === "6x1") {
    return all.filter((r) => r.month.startsWith("6x1:") || !r.month.includes(":"));
  }
  return all.filter((r) => r.month.startsWith(`${type}:`));
}

export async function getScale(month: string): Promise<Scale6x1Record | null> {
  const db = await getDb();
  let res = await db.query(`SELECT * FROM Scale6x1 WHERE month = ?`, [month]);
  if ((!res.values || res.values.length === 0) && month.startsWith("6x1:")) {
    const raw = month.replace(/^6x1:/, "");
    res = await db.query(`SELECT * FROM Scale6x1 WHERE month = ?`, [raw]);
  } else if ((!res.values || res.values.length === 0) && !month.includes(":")) {
    res = await db.query(`SELECT * FROM Scale6x1 WHERE month = ?`, [`6x1:${month}`]);
  }
  if (!res.values || res.values.length === 0) return null;
  return rowToScale(res.values[0]);
}

export async function saveScale(month: string, data: string): Promise<Scale6x1Record> {
  const db = await getDb();
  const existing = await getScale(month);
  const savedAt = nowIso();
  if (existing) {
    await db.run(`UPDATE Scale6x1 SET data = ?, savedAt = ?, month = ? WHERE id = ?`, [data, savedAt, month, existing.id]);
  } else {
    await db.run(`INSERT INTO Scale6x1 (id, month, data, savedAt) VALUES (?, ?, ?, ?)`, [newId(), month, data, savedAt]);
  }
  return (await getScale(month))!;
}

export async function deleteScale(month: string): Promise<boolean> {
  const db = await getDb();
  let res = await db.run(`DELETE FROM Scale6x1 WHERE month = ?`, [month]);
  if ((res.changes?.changes || 0) === 0 && month.startsWith("6x1:")) {
    const raw = month.replace(/^6x1:/, "");
    res = await db.run(`DELETE FROM Scale6x1 WHERE month = ?`, [raw]);
  } else if ((res.changes?.changes || 0) === 0 && !month.includes(":")) {
    res = await db.run(`DELETE FROM Scale6x1 WHERE month = ?`, [`6x1:${month}`]);
  }
  return (res.changes?.changes || 0) > 0;
}

/* ---------------- Settings ---------------- */

export interface Settings {
  id: string;
  hospitalName: string;
  defaultWhatsapp: string;
  pin: string;
  groqApiKey: string;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM Settings WHERE id = 'global'`, []);
  if (!res.values || res.values.length === 0) {
    return { id: "global", hospitalName: "", defaultWhatsapp: "", pin: "", groqApiKey: "" };
  }
  const r = res.values[0];
  return {
    id: r.id as string,
    hospitalName: r.hospitalName as string,
    defaultWhatsapp: r.defaultWhatsapp as string,
    pin: r.pin as string,
    groqApiKey: (r.groqApiKey as string) || "",
  };
}

export async function updateSettings(data: Partial<Omit<Settings, "id">>): Promise<Settings> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.hospitalName !== undefined) { fields.push("hospitalName = ?"); params.push(data.hospitalName); }
  if (data.defaultWhatsapp !== undefined) { fields.push("defaultWhatsapp = ?"); params.push(data.defaultWhatsapp); }
  if (data.pin !== undefined) { fields.push("pin = ?"); params.push(data.pin); }
  if (data.groqApiKey !== undefined) { fields.push("groqApiKey = ?"); params.push(data.groqApiKey); }

  if (fields.length > 0) {
    await db.run(`UPDATE Settings SET ${fields.join(", ")} WHERE id = 'global'`, params);
  }
  return getSettings();
}

export async function checkPin(pin: string): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.pin) return true;
  return settings.pin === pin;
}
