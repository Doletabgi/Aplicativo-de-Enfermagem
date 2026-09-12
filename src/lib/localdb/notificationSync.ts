"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { listTasks, ensureTaskNotificationChannel, TASK_CHANNEL_ID } from "./tasks";
import { syncAllMedicationNotifications } from "@/lib/notifications";

/**
 * Função central de sincronização de notificações por área de trabalho.
 *
 * 1. Cancela TODAS as notificações pendentes no sistema de alarmes do Android/iOS,
 *    eliminando qualquer notificação agendada pela outra área de trabalho.
 * 2. Reagenda as notificações de TAREFAS pendentes da área de trabalho ATIVA no momento,
 *    reutilizando o notificationId original da tarefa e ignorando horários passados.
 * 3. Reagenda os LEMBRETES DE MEDICAÇÃO da área de trabalho ATIVA,
 *    reutilizando a lógica existente de syncAllMedicationNotifications.
 */
export async function resyncAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Cancela TODAS as notificações pendentes no sistema, não importa de qual área eram
    const pending = await LocalNotifications.getPending();
    if (pending && pending.notifications && pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }

    // 2. Reagenda as notificações de TAREFAS pendentes da área ATIVA no momento
    await ensureTaskNotificationChannel();
    const tasks = await listTasks({ onlyPending: true });
    const now = Date.now();
    const tasksToSchedule = [];

    for (const task of tasks) {
      if (!task.notificationId) continue;
      const scheduledDate = new Date(task.scheduledAt);
      const timeMs = scheduledDate.getTime();

      // Ignora tarefas com horário já passado no momento do resync
      if (!isNaN(timeMs) && timeMs > now) {
        tasksToSchedule.push({
          id: task.notificationId,
          title: "Lembrete: " + (task.patientName || "Geral"),
          body: task.description,
          channelId: TASK_CHANNEL_ID,
          schedule: {
            at: scheduledDate,
            allowWhileIdle: true,
          },
          extra: {
            taskId: task.id,
            patientId: task.patientId || undefined,
          },
        });
      }
    }

    if (tasksToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: tasksToSchedule,
      });
    }

    // 3. Reagenda os LEMBRETES DE MEDICAÇÃO da área ativa
    await syncAllMedicationNotifications();
  } catch (err) {
    console.error("Erro ao executar resyncAllNotifications:", err);
  }
}
