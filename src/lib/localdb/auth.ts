"use client";

import bcrypt from "bcryptjs";
import { Preferences } from "@capacitor/preferences";
import { getGlobalDb, newId, nowIso } from "./client";

const SESSION_KEY = "session_token";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

function rowToUser(r: Record<string, unknown>): AuthUser {
  return { id: r.id as string, name: r.name as string, email: r.email as string };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hasAnyUser(): Promise<boolean> {
  const db = await getGlobalDb();
  const res = await db.query(`SELECT COUNT(*) as count FROM User`, []);
  return ((res.values?.[0]?.count as number) || 0) > 0;
}

export async function register(name: string, email: string, password: string): Promise<AuthUser> {
  if (!name || !email || !password) throw new Error("Todos os campos são obrigatórios");
  if (password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");

  const db = await getGlobalDb();
  const existingRes = await db.query(`SELECT id FROM User WHERE email = ?`, [email]);
  if (existingRes.values && existingRes.values.length > 0) {
    throw new Error("Email já cadastrado");
  }

  const id = newId();
  const hashed = await hashPassword(password);
  await db.run(`INSERT INTO User (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)`, [
    id,
    name,
    email,
    hashed,
    nowIso(),
  ]);

  await createSession(id);
  return { id, name, email };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const db = await getGlobalDb();
  const res = await db.query(`SELECT * FROM User WHERE email = ?`, [email]);
  if (!res.values || res.values.length === 0) throw new Error("Credenciais inválidas");

  const user = res.values[0];
  const valid = await verifyPassword(password, user.password as string);
  if (!valid) throw new Error("Credenciais inválidas");

  await createSession(user.id as string);
  return rowToUser(user);
}

async function createSession(userId: string): Promise<void> {
  const db = await getGlobalDb();
  const token = newId();
  await db.run(`INSERT INTO Session (id, token, userId, createdAt) VALUES (?, ?, ?, ?)`, [
    newId(),
    token,
    userId,
    nowIso(),
  ]);
  await Preferences.set({ key: SESSION_KEY, value: token });
}

export async function logout(): Promise<void> {
  const { value: token } = await Preferences.get({ key: SESSION_KEY });
  if (token) {
    const db = await getGlobalDb();
    await db.run(`DELETE FROM Session WHERE token = ?`, [token]);
  }
  await Preferences.remove({ key: SESSION_KEY });
}

export async function getCurrentUser(): Promise<{ user: AuthUser | null; hasUsers: boolean }> {
  const hasUsers = await hasAnyUser();
  const { value: token } = await Preferences.get({ key: SESSION_KEY });
  if (!token) return { user: null, hasUsers };

  const db = await getGlobalDb();
  const res = await db.query(
    `SELECT u.* FROM Session s JOIN User u ON u.id = s.userId WHERE s.token = ?`,
    [token]
  );
  if (!res.values || res.values.length === 0) return { user: null, hasUsers };
  return { user: rowToUser(res.values[0]), hasUsers };
}

export async function updateProfile(data: { name?: string; email?: string; password?: string }): Promise<void> {
  const { user } = await getCurrentUser();
  if (!user) throw new Error("Usuário não encontrado");

  const db = await getGlobalDb();
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.name) { fields.push("name = ?"); params.push(data.name); }
  if (data.email) { fields.push("email = ?"); params.push(data.email); }
  if (data.password) {
    fields.push("password = ?");
    params.push(await hashPassword(data.password));
  }
  if (fields.length === 0) return;
  params.push(user.id);
  await db.run(`UPDATE User SET ${fields.join(", ")} WHERE id = ?`, params);
}
