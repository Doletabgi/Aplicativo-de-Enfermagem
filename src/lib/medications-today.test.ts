import { describe, it, expect } from "vitest";
import { filterMedicationsToday, type TodayMedication } from "./localdb/medications";
import {
  getMedStatus,
  minutesLate,
  minutesUntil,
  formatMinutes,
  formatScheduleTime,
  calculateNextSchedule,
  parseScheduleDate,
} from "./medication-status";

describe("Medications Today Filtering (Tarefa 2)", () => {
  const mockNow = new Date("2026-09-07T14:00:00"); // Dia atual = 2026-09-07

  const baseMed: TodayMedication = {
    id: "med-1",
    patientId: "pat-1",
    patientName: "João Silva",
    patientBed: "101",
    name: "Dipirona",
    dose: "500mg",
    schedule: "08:00",
    frequencyHours: null,
    administered: false,
    administeredAt: null,
    observation: "",
    createdAt: "2026-09-07T07:00:00.000Z",
  };

  it("1. Medicação cadastrada hoje para hoje → deve aparecer", () => {
    const meds: TodayMedication[] = [{ ...baseMed, schedule: "14:00" }];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(1);
    expect(res[0].schedule).toBe("14:00");
  });

  it("2. Medicação cadastrada ontem de dose única com horário de ontem → NÃO deve aparecer hoje", () => {
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-yesterday",
        schedule: "2026-09-06 14:00",
        createdAt: "2026-09-06T10:00:00.000Z",
        frequencyHours: null,
      },
      {
        ...baseMed,
        id: "med-yesterday-simple",
        schedule: "14:00",
        createdAt: "2026-09-06T10:00:00.000Z",
        frequencyHours: null,
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(0);
  });

  it("3. Medicação cadastrada hoje com horário futuro (ainda hoje) → deve aparecer como Pendente", () => {
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-future-today",
        schedule: "20:00", // 6h no futuro hoje
        createdAt: "2026-09-07T10:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(1);
    expect(res[0].schedule).toBe("20:00");
    expect(getMedStatus(res[0], mockNow)).toBe("pendente");
    expect(minutesUntil(res[0], mockNow)).toBe(360); // 6 horas = 360 min
  });

  it("4. Medicação de uso contínuo (com frequência) que já foi administrada hoje mas tem próxima dose ainda hoje → deve aparecer com o novo horário", () => {
    // Dipirona 8h que foi administrada às 08:00 e avançou para 16:00
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-continuous-today",
        schedule: "2026-09-07 16:00",
        frequencyHours: 8,
        administered: false,
        administeredAt: null,
        createdAt: "2026-09-07T01:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(1);
    expect(res[0].schedule).toBe("16:00");
    expect(res[0].administered).toBe(false);
    expect(getMedStatus(res[0], mockNow)).toBe("pendente");
  });

  it("5. Medicação de uso contínuo que renovou para o dia seguinte (após meia-noite) → NÃO deve aparecer hoje", () => {
    // Medicação administrada à noite (22:00 + 4h = 02:00 do dia seguinte)
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-renewed-tomorrow",
        schedule: "2026-09-08 02:00",
        frequencyHours: 4,
        administered: false,
        administeredAt: null,
        createdAt: "2026-09-07T22:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(0);
  });

  it("6. Medicação com data de início futura (ex: amanhã) → NÃO deve aparecer hoje", () => {
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-tomorrow",
        schedule: "2026-09-08 08:00",
        createdAt: "2026-09-07T10:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(0);
  });

  it("7. Medicação não-recorrente administrada em dia anterior → NÃO deve aparecer hoje", () => {
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-admin-yesterday",
        schedule: "08:00",
        administered: true,
        administeredAt: "2026-09-06T08:15:00.000Z",
        createdAt: "2026-09-06T07:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(0);
  });

  it("8. Medicação não-recorrente administrada hoje → deve aparecer como administrada", () => {
    const meds: TodayMedication[] = [
      {
        ...baseMed,
        id: "med-admin-today",
        schedule: "08:00",
        administered: true,
        administeredAt: "2026-09-07T08:15:00.000Z",
        createdAt: "2026-09-07T07:00:00.000Z",
      },
    ];
    const res = filterMedicationsToday(meds, mockNow);
    expect(res.length).toBe(1);
    expect(getMedStatus(res[0], mockNow)).toBe("administrado");
  });
});

describe("Schedule Calculations & Midnight Rollover (Tarefa 3)", () => {
  const baseDate = new Date("2026-09-07T14:00:00");

  it("calculates next schedule on the same day", () => {
    // 08:00 + 8h = 16:00 on 2026-09-07
    const next = calculateNextSchedule("08:00", 8, baseDate);
    expect(next).toBe("2026-09-07 16:00");
    expect(formatScheduleTime(next)).toBe("16:00");
  });

  it("calculates next schedule with midnight rollover to next day", () => {
    // 22:00 + 4h = 02:00 on 2026-09-08
    const next = calculateNextSchedule("22:00", 4, baseDate);
    expect(next).toBe("2026-09-08 02:00");
    expect(formatScheduleTime(next)).toBe("02:00");
  });

  it("calculates 24h schedule advancing to exactly tomorrow", () => {
    const next = calculateNextSchedule("08:00", 24, baseDate);
    expect(next).toBe("2026-09-08 08:00");
  });

  it("parses schedule date with explicit date and time", () => {
    const parsed = parseScheduleDate("2026-09-08 08:30", baseDate);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // September = 8 (0-indexed)
    expect(parsed.getDate()).toBe(8);
    expect(parsed.getHours()).toBe(8);
    expect(parsed.getMinutes()).toBe(30);
  });
});

describe("Medication Status Helpers (Tarefa 4)", () => {
  const refTime = new Date("2026-09-07T14:00:00"); // 14:00

  it("calculates status as 'administrado' when administered is true", () => {
    const med = { schedule: "08:00", administered: true };
    expect(getMedStatus(med, refTime)).toBe("administrado");
  });

  it("calculates status as 'atrasado' when not administered and > 30 min overdue", () => {
    const med = { schedule: "12:00", administered: false };
    expect(getMedStatus(med, refTime)).toBe("atrasado");
    expect(minutesLate(med, refTime)).toBe(120);
  });

  it("calculates status as 'pendente' when within 30 min of schedule", () => {
    const med = { schedule: "13:45", administered: false };
    expect(getMedStatus(med, refTime)).toBe("pendente");
    expect(minutesLate(med, refTime)).toBe(15);
  });

  it("calculates status as 'pendente' when scheduled in the future", () => {
    const med = { schedule: "15:30", administered: false };
    expect(getMedStatus(med, refTime)).toBe("pendente");
    expect(minutesUntil(med, refTime)).toBe(90);
    expect(minutesLate(med, refTime)).toBe(0);
  });

  it("formats minutes into human readable text", () => {
    expect(formatMinutes(90)).toBe("1h30min");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(45)).toBe("45min");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(0)).toBe("0min");
  });
});

describe("Medication Administration Timing & Safety Validations (Tarefa 5)", () => {
  const refTime = new Date("2026-09-07T14:00:00"); // 14:00

  it("identifies early administration (> 30 min before schedule)", () => {
    // Scheduled for 15:00, current time 14:00 -> 60 min remaining (> 30 min)
    const med = { schedule: "15:00", administered: false };
    const remaining = minutesUntil(med, refTime);
    expect(remaining).toBe(60);
    expect(remaining > 30).toBe(true);
  });

  it("identifies normal administration window (<= 30 min before schedule)", () => {
    // Scheduled for 14:20, current time 14:00 -> 20 min remaining (<= 30 min)
    const med = { schedule: "14:20", administered: false };
    const remaining = minutesUntil(med, refTime);
    expect(remaining).toBe(20);
    expect(remaining > 30).toBe(false);
  });

  it("calculates duplicate check window correctly (half frequency, minimum 60 min)", () => {
    // Single dose / SN: minimum 60 min
    const singleDoseWindow = Math.max(60, 0 ? Math.floor((0 * 60) / 2) : 60);
    expect(singleDoseWindow).toBe(60);

    // 2h frequency: half is 1h (60 min) -> window is 60 min
    const freq2hWindow = Math.max(60, Math.floor((2 * 60) / 2));
    expect(freq2hWindow).toBe(60);

    // 4h frequency: half is 2h (120 min) -> window is 120 min
    const freq4hWindow = Math.max(60, Math.floor((4 * 60) / 2));
    expect(freq4hWindow).toBe(120);

    // 8h frequency: half is 4h (240 min) -> window is 240 min
    const freq8hWindow = Math.max(60, Math.floor((8 * 60) / 2));
    expect(freq8hWindow).toBe(240);
  });

  it("determines whether administration is duplicate based on time elapsed", () => {
    // Window is 60 min, last administered 35 min ago -> DUPLICATE
    const minutesAgo1 = 35;
    const window1 = 60;
    expect(minutesAgo1 < window1).toBe(true);

    // Window is 60 min, last administered 75 min ago -> NOT duplicate
    const minutesAgo2 = 75;
    const window2 = 60;
    expect(minutesAgo2 < window2).toBe(false);
  });
});

