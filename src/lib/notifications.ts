"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { getDb } from "./localdb/client";

export const NOTIFICATION_CHANNEL_ID = "medicacoes";

/**
 * Gera um ID numérico inteiro determinístico (31-bit positivo) a partir do ID da medicação e do índice da dose.
 */
export function getNotificationId(medId: string, index: number = 0): number {
  const str = `med_${medId}_${index}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

let isInitialized = false;

/**
 * Inicializa os canais de notificação e os ouvintes de clique no Android.
 */
export async function initNotifications(onNavigate?: (url: string) => void): Promise<void> {
  if (!Capacitor.isNativePlatform() || isInitialized) return;

  try {
    // Cria o canal de notificações de alta prioridade no Android (com som e heads-up)
    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: "Lembretes de Medicação",
      description: "Avisos dos horários de administração de medicamentos aos pacientes",
      importance: 5, // IMPORTANCE_HIGH
      vibration: true,
      lights: true,
      lightColor: "#2563eb",
      visibility: 1, // VISIBILITY_PUBLIC
    });

    // Registra ouvinte para quando o usuário toca na notificação
    await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const extra = action.notification.extra;
      const targetUrl = extra && extra.taskId ? "/tasks" : "/medications";
      if (onNavigate) {
        onNavigate(targetUrl);
      } else if (typeof window !== "undefined") {
        window.location.href = targetUrl;
      }
    });

    isInitialized = true;
  } catch (err) {
    console.warn("Erro ao inicializar notificações:", err);
  }
}

/**
 * Solicita permissão para exibir notificações (especialmente necessário no Android 13+).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      return perm === "granted";
    }
    return true;
  }

  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;

    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch (err) {
    console.error("Erro ao solicitar permissão de notificações:", err);
    return false;
  }
}

/**
 * Calcula as próximas datas de administração para uma medicação.
 */
export function calculateUpcomingDoses(
  schedule: string,
  frequencyHours: number | null,
  maxDoses: number = 4
): Date[] {
  const [hStr, mStr] = (schedule || "00:00").split(":");
  const hour = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;

  const now = new Date();
  const baseToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);

  const doses: Date[] = [];
  const freq = frequencyHours && frequencyHours > 0 ? frequencyHours : 24;

  // Se a primeira dose de hoje já passou há mais de 10 minutos, avança pelo intervalo
  let candidate = new Date(baseToday);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  while (candidate <= tenMinutesAgo) {
    candidate = new Date(candidate.getTime() + freq * 60 * 60 * 1000);
  }

  for (let i = 0; i < maxDoses; i++) {
    doses.push(new Date(candidate.getTime() + i * freq * 60 * 60 * 1000));
  }

  return doses;
}

export interface MedicationReminderData {
  id: string;
  patientId: string;
  name: string;
  dose: string;
  schedule: string;
  frequencyHours?: number | null;
  administered?: boolean;
}

export interface PatientReminderData {
  id: string;
  name: string;
  bed?: string;
  active?: boolean;
}

/**
 * Cancela qualquer notificação agendada para uma medicação.
 */
export async function cancelMedicationNotification(medId: string, maxDoses: number = 6): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const idsToCancel = Array.from({ length: maxDoses }, (_, i) => ({
      id: getNotificationId(medId, i),
    }));
    await LocalNotifications.cancel({ notifications: idsToCancel });
  } catch (err) {
    console.warn(`Erro ao cancelar notificações da medicação ${medId}:`, err);
  }
}

/**
 * Agenda lembretes locais para uma medicação.
 */
export async function scheduleMedicationNotification(
  med: MedicationReminderData,
  patient?: PatientReminderData
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  // Se a medicação já foi administrada, garante que não há lembretes pendentes
  if (med.administered) {
    await cancelMedicationNotification(med.id);
    return;
  }

  // Busca dados do paciente se não fornecidos
  let p = patient;
  if (!p) {
    try {
      const db = await getDb();
      const res = await db.query(`SELECT id, name, bed, active FROM Patient WHERE id = ?`, [med.patientId]);
      if (res.values && res.values.length > 0) {
        const row = res.values[0];
        p = {
          id: row.id as string,
          name: row.name as string,
          bed: row.bed as string,
          active: !!row.active,
        };
      }
    } catch (e) {
      console.error("Erro ao buscar dados do paciente para notificação:", e);
    }
  }

  if (p && p.active === false) {
    // Paciente inativo/com alta: não envia notificação
    await cancelMedicationNotification(med.id);
    return;
  }

  const patientName = p ? p.name : "Paciente";
  const bedText = p && p.bed ? ` • Leito ${p.bed}` : "";

  // Primeiro remove agendamentos anteriores para evitar duplicatas
  await cancelMedicationNotification(med.id);

  // Calcula próximas doses
  const upcomingDoses = calculateUpcomingDoses(med.schedule, med.frequencyHours ?? null, 4);
  const now = Date.now();
  const futureDoses = upcomingDoses.filter((doseDate) => doseDate.getTime() > now);

  if (futureDoses.length === 0) return;

  const notificationsToSchedule = futureDoses.map((doseDate, index) => {
    const timeFormatted = doseDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return {
      id: getNotificationId(med.id, index),
      title: `⏰ Medicação${bedText}`,
      body: `Administrar ${med.name} (${med.dose}) para ${patientName} às ${timeFormatted}`,
      channelId: NOTIFICATION_CHANNEL_ID,
      schedule: {
        at: doseDate,
        allowWhileIdle: true,
      },
      extra: {
        medicationId: med.id,
        patientId: med.patientId,
      },
    };
  });

  try {
    await LocalNotifications.schedule({
      notifications: notificationsToSchedule,
    });
  } catch (err) {
    console.error("Erro ao agendar notificações de medicação:", err);
  }
}

/**
 * Dispara uma notificação de teste em poucos segundos para validação imediata no emulador/dispositivo.
 */
export async function testMedicationNotification(): Promise<boolean> {
  const hasPerm = await requestNotificationPermission();
  if (!hasPerm) return false;

  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== "undefined" && "Notification" in window) {
      new Notification("⏰ Teste de Notificação", {
        body: "Lembrete de medicação funcionando com sucesso!",
      });
      return true;
    }
    alert("Notificação de teste executada (modo Web).");
    return true;
  }

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999999,
          title: "⏰ Teste de Lembrete • Leito 01",
          body: "Dipirona 500mg - Horário de administração agora",
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: {
            at: new Date(Date.now() + 3000), // 3 segundos a partir de agora
            allowWhileIdle: true,
          },
        },
      ],
    });
    return true;
  } catch (err) {
    console.error("Erro ao enviar notificação de teste:", err);
    return false;
  }
}

/**
 * Re-sincroniza todos os lembretes de todas as medicações ativas e não administradas.
 */
export async function syncAllMedicationNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const db = await getDb();
    const res = await db.query(`
      SELECT m.*, p.name as patientName, p.bed as patientBed, p.active as patientActive
      FROM Medication m
      JOIN Patient p ON p.id = m.patientId
      WHERE m.administered = 0 AND p.active = 1
    `);

    if (!res.values) return;

    for (const row of res.values) {
      await scheduleMedicationNotification(
        {
          id: row.id as string,
          patientId: row.patientId as string,
          name: row.name as string,
          dose: row.dose as string,
          schedule: row.schedule as string,
          frequencyHours: (row.frequencyHours as number) ?? null,
          administered: !!row.administered,
        },
        {
          id: row.patientId as string,
          name: row.patientName as string,
          bed: row.patientBed as string,
          active: !!row.patientActive,
        }
      );
    }
  } catch (err) {
    console.error("Erro ao sincronizar todas as notificações de medicação:", err);
  }
}
