import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockPending,
  mockCancel,
  mockSchedule,
  mockCreateChannel,
  mockSyncAllMeds,
  mockListTasks,
} = vi.hoisted(() => ({
  mockPending: vi.fn(),
  mockCancel: vi.fn(),
  mockSchedule: vi.fn(),
  mockCreateChannel: vi.fn(),
  mockSyncAllMeds: vi.fn(),
  mockListTasks: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => "android"),
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: mockPending,
    cancel: mockCancel,
    schedule: mockSchedule,
    createChannel: mockCreateChannel,
  },
}));

vi.mock("@/lib/notifications", () => ({
  syncAllMedicationNotifications: mockSyncAllMeds,
  NOTIFICATION_CHANNEL_ID: "medicacoes",
}));

vi.mock("./tasks", () => ({
  listTasks: mockListTasks,
  ensureTaskNotificationChannel: mockCreateChannel,
  TASK_CHANNEL_ID: "tarefas_clinicas",
}));

import { resyncAllNotifications } from "./notificationSync";
import { Capacitor } from "@capacitor/core";

describe("notificationSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it("should cancel all pending notifications and reschedule only future tasks and medications", async () => {
    // Simula notificações pendentes no sistema (de qualquer área)
    mockPending.mockResolvedValue({
      notifications: [{ id: 101 }, { id: 102 }, { id: 103 }],
    });

    const now = Date.now();
    const futureDate1 = new Date(now + 3600 * 1000).toISOString(); // +1h
    const futureDate2 = new Date(now + 7200 * 1000).toISOString(); // +2h
    const pastDate = new Date(now - 3600 * 1000).toISOString(); // -1h (passado)

    mockListTasks.mockResolvedValue([
      {
        id: "task-1",
        patientId: "p-1",
        patientName: "João Silva",
        description: "Aferir pressão arterial",
        scheduledAt: futureDate1,
        notificationId: 5001,
        completed: false,
      },
      {
        id: "task-2",
        patientId: null,
        patientName: "Geral",
        description: "Passagem de plantão",
        scheduledAt: futureDate2,
        notificationId: 5002,
        completed: false,
      },
      {
        id: "task-3",
        patientId: "p-2",
        patientName: "Maria Souza",
        description: "Curativo de ferida cirúrgica",
        scheduledAt: pastDate,
        notificationId: 5003,
        completed: false,
      },
    ]);

    await resyncAllNotifications();

    // 1. Deve ter cancelado todas as notificações pendentes do sistema
    expect(mockCancel).toHaveBeenCalledWith({
      notifications: [{ id: 101 }, { id: 102 }, { id: 103 }],
    });

    // 2. Deve ter agendado apenas as tarefas futuras (task-1 e task-2), ignorando task-3 (passada)
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const scheduledNotifications = mockSchedule.mock.calls[0][0].notifications;
    expect(scheduledNotifications).toHaveLength(2);
    expect(scheduledNotifications[0].id).toBe(5001);
    expect(scheduledNotifications[0].title).toBe("Lembrete: João Silva");
    expect(scheduledNotifications[1].id).toBe(5002);
    expect(scheduledNotifications[1].title).toBe("Lembrete: Geral");

    // 3. Deve ter chamado a sincronização de medicações da área ativa
    expect(mockSyncAllMeds).toHaveBeenCalledTimes(1);
  });

  it("should not crash or schedule if no tasks or notifications exist", async () => {
    mockPending.mockResolvedValue({ notifications: [] });
    mockListTasks.mockResolvedValue([]);

    await resyncAllNotifications();

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockSyncAllMeds).toHaveBeenCalledTimes(1);
  });

  it("should do nothing when not running on a native platform", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await resyncAllNotifications();

    expect(mockPending).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockSyncAllMeds).not.toHaveBeenCalled();
  });
});
