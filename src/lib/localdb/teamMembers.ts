"use client";

import { getDb, newId, nowIso } from "./client";

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  shift: string;
  team: string;
  isCover: boolean;
  gender: string;
  horarioFixo: string;
  active: boolean;
  createdAt: string;
}

function rowToMember(r: Record<string, unknown>): TeamMember {
  return {
    id: r.id as string,
    name: r.name as string,
    role: r.role as string,
    color: r.color as string,
    shift: r.shift as string,
    team: r.team as string,
    isCover: !!r.isCover,
    gender: r.gender as string,
    horarioFixo: r.horarioFixo as string,
    active: !!r.active,
    createdAt: r.createdAt as string,
  };
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM TeamMember ORDER BY name ASC`, []);
  return (res.values || []).map(rowToMember);
}

export interface CreateTeamMemberInput {
  name: string;
  role?: string;
  color?: string;
  shift?: string;
  team?: string;
  isCover?: boolean;
  gender?: string;
  horarioFixo?: string;
}

export async function createTeamMember(data: CreateTeamMemberInput): Promise<TeamMember> {
  const db = await getDb();
  const id = newId();
  const createdAt = nowIso();
  await db.run(
    `INSERT INTO TeamMember (id, name, role, color, shift, team, isCover, gender, horarioFixo, active, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      data.name,
      data.role || "Enfermeiro",
      data.color || "#3b82f6",
      data.shift || "MANHA",
      data.team || "",
      data.isCover ? 1 : 0,
      data.gender || "",
      data.horarioFixo || "",
      createdAt,
    ]
  );
  const res = await db.query(`SELECT * FROM TeamMember WHERE id = ?`, [id]);
  return rowToMember(res.values![0]);
}

export async function updateTeamMember(id: string, data: Partial<CreateTeamMemberInput> & { active?: boolean }): Promise<TeamMember> {
  const db = await getDb();
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) { fields.push("name = ?"); params.push(data.name); }
  if (data.role !== undefined) { fields.push("role = ?"); params.push(data.role); }
  if (data.color !== undefined) { fields.push("color = ?"); params.push(data.color); }
  if (data.active !== undefined) { fields.push("active = ?"); params.push(data.active ? 1 : 0); }
  if (data.shift !== undefined) { fields.push("shift = ?"); params.push(data.shift); }
  if (data.team !== undefined) { fields.push("team = ?"); params.push(data.team); }
  if (data.isCover !== undefined) { fields.push("isCover = ?"); params.push(data.isCover ? 1 : 0); }
  if (data.gender !== undefined) { fields.push("gender = ?"); params.push(data.gender); }
  if (data.horarioFixo !== undefined) { fields.push("horarioFixo = ?"); params.push(data.horarioFixo); }

  if (fields.length > 0) {
    params.push(id);
    await db.run(`UPDATE TeamMember SET ${fields.join(", ")} WHERE id = ?`, params);
  }
  const res = await db.query(`SELECT * FROM TeamMember WHERE id = ?`, [id]);
  return rowToMember(res.values![0]);
}

export async function deleteTeamMember(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`DELETE FROM TeamMember WHERE id = ?`, [id]);
}
