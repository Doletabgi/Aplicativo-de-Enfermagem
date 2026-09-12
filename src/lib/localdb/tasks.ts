"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getDb, newId, nowIso } from "./client";

export interface Task {
  id: string;
  patientId: string | null;
  patientName: string;
  description: string;
  scheduledAt: string;
  notificationId: number;
  completed: boolean;
  createdAt: string;
}

export interface CreateTaskData {
  patientId: string | null;
  patientName: string;
  description: string;
  scheduledAt: string;
}

export interface ListTasksFilters {
  patientId?: string;
  onlyPending?: boolean;
}

export const TASK_CHANNEL_ID = "tarefas_clinicas";

export async function ensureTaskNotificationChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: TASK_CHANNEL_ID,
      name: "Lembretes de Tarefas",
      description: "Notificações de tarefas clínicas e lembretes de plantão",
      importance: 5, // IMPORTANCE_HIGH
      vibration: true,
      lights: true,
      lightColor: "#0f766e",
      visibility: 1,
    });
  } catch (err) {
    console.warn("Erro ao criar canal de notificações de tarefas:", err);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }
    return true;
  }

  try {
    await ensureTaskNotificationChannel();
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;

    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch (err) {
    console.warn("Erro ao solicitar permissão de notificações:", err);
    return false;
  }
}

export async function listTasks(filters?: ListTasksFilters): Promise<Task[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.patientId) {
    clauses.push("patientId = ?");
    params.push(filters.patientId);
  }

  if (filters?.onlyPending) {
    clauses.push("completed = 0");
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.query(
    `SELECT * FROM Task ${where} ORDER BY scheduledAt ASC, createdAt DESC`,
    params
  );

  return (res.values || []).map((r: Record<string, unknown>): Task => ({
    id: r.id as string,
    patientId: (r.patientId as string) || null,
    patientName: (r.patientName as string) || "",
    description: (r.description as string) || "",
    scheduledAt: r.scheduledAt as string,
    notificationId: Number(r.notificationId),
    completed: Boolean(r.completed),
    createdAt: r.createdAt as string,
  }));
}

export async function createTask(data: CreateTaskData): Promise<Task> {
  const db = await getDb();
  const id = newId();
  const createdAt = nowIso();
  const notificationId = Math.floor(Date.now() % 2147483647);

  await db.run(
    `INSERT INTO Task (id, patientId, patientName, description, scheduledAt, notificationId, completed, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      data.patientId || null,
      data.patientName || "Geral",
      data.description,
      data.scheduledAt,
      notificationId,
      createdAt,
    ]
  );

  // Agenda notificação local nativa
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureTaskNotificationChannel();
      const scheduledDate = new Date(data.scheduledAt);
      if (!isNaN(scheduledDate.getTime())) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: notificationId,
              title: "Lembrete: " + (data.patientName || "Geral"),
              body: data.description,
              channelId: TASK_CHANNEL_ID,
              schedule: {
                at: scheduledDate,
                allowWhileIdle: true,
              },
              extra: {
                taskId: id,
                patientId: data.patientId || undefined,
              },
            },
          ],
        });
      }
    } catch (err) {
      console.warn("Erro ao agendar notificação local:", err);
    }
  }

  return {
    id,
    patientId: data.patientId || null,
    patientName: data.patientName || "Geral",
    description: data.description,
    scheduledAt: data.scheduledAt,
    notificationId,
    completed: false,
    createdAt,
  };
}

export async function completeTask(id: string): Promise<void> {
  const db = await getDb();
  await db.run(`UPDATE Task SET completed = 1 WHERE id = ?`, [id]);
}

export async function deleteTask(id: string): Promise<void> {
  const db = await getDb();
  const res = await db.query(`SELECT notificationId FROM Task WHERE id = ?`, [id]);
  if (res.values && res.values.length > 0) {
    const notificationId = Number(res.values[0].notificationId);
    if (notificationId && Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }],
        });
      } catch (err) {
        console.warn("Erro ao cancelar notificação:", err);
      }
    }
  }
  await db.run(`DELETE FROM Task WHERE id = ?`, [id]);
}
