import { describe, it, expect } from "vitest";
import {
  generateLowthianSchedule,
  getCurrentLowthianSlot,
  formatLowthianPrescription,
  formatMinutesToTime,
  parseTimeToMinutes,
  LOWTHIAN_PROTOCOLS,
  LOWTHIAN_POSITIONS,
} from "./lowthian";

describe("Lowthian Turning Clock (Relógio de Lowthian) domain logic", () => {
  it("converts minutes of day to time string correctly", () => {
    expect(formatMinutesToTime(0)).toBe("00:00");
    expect(formatMinutesToTime(480)).toBe("08:00");
    expect(formatMinutesToTime(870)).toBe("14:30");
    expect(formatMinutesToTime(1439)).toBe("23:59");
    expect(formatMinutesToTime(1440)).toBe("00:00");
  });

  it("parses time string to minutes correctly", () => {
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("08:00")).toBe(480);
    expect(parseTimeToMinutes("14:30")).toBe(870);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
  });

  it("generates classic 2-hour schedule with 12 slots for 24h starting at 08:00", () => {
    const schedule = generateLowthianSchedule({
      startHour: 8,
      startMinute: 0,
      intervalHours: 2,
      protocolId: "classic",
      totalHours: 24,
    });

    expect(schedule).toHaveLength(12);

    // Slot 0: 08:00 - 10:00 -> DLD
    expect(schedule[0].startTime).toBe("08:00");
    expect(schedule[0].endTime).toBe("10:00");
    expect(schedule[0].position.code).toBe("DLD");

    // Slot 1: 10:00 - 12:00 -> DD
    expect(schedule[1].startTime).toBe("10:00");
    expect(schedule[1].endTime).toBe("12:00");
    expect(schedule[1].position.code).toBe("DD");

    // Slot 2: 12:00 - 14:00 -> DLE
    expect(schedule[2].startTime).toBe("12:00");
    expect(schedule[2].endTime).toBe("14:00");
    expect(schedule[2].position.code).toBe("DLE");

    // Slot 3: 14:00 - 16:00 -> DD
    expect(schedule[3].startTime).toBe("14:00");
    expect(schedule[3].endTime).toBe("16:00");
    expect(schedule[3].position.code).toBe("DD");

    // Slot 4: 16:00 - 18:00 -> DLD
    expect(schedule[4].startTime).toBe("16:00");
    expect(schedule[4].endTime).toBe("18:00");
    expect(schedule[4].position.code).toBe("DLD");

    // Slot 11 (last slot): 06:00 - 08:00 -> DD
    expect(schedule[11].startTime).toBe("06:00");
    expect(schedule[11].endTime).toBe("08:00");
  });

  it("generates 3-hour schedule correctly with 8 slots", () => {
    const schedule = generateLowthianSchedule({
      startHour: 7,
      startMinute: 0,
      intervalHours: 3,
      protocolId: "classic",
      totalHours: 24,
    });

    expect(schedule).toHaveLength(8);
    expect(schedule[0].startTime).toBe("07:00");
    expect(schedule[0].endTime).toBe("10:00");
    expect(schedule[1].startTime).toBe("10:00");
    expect(schedule[1].endTime).toBe("13:00");
  });

  it("supports lateral-only strict protocol for active sacral lesions", () => {
    const schedule = generateLowthianSchedule({
      startHour: 8,
      startMinute: 0,
      intervalHours: 2,
      protocolId: "lateral_strict",
      totalHours: 24,
    });

    expect(schedule[0].position.code).toBe("DLD");
    expect(schedule[1].position.code).toBe("DLE");
    expect(schedule[2].position.code).toBe("DLD");
    expect(schedule[3].position.code).toBe("DLE");
  });

  it("correctly identifies active slot and time remaining in daytime", () => {
    const schedule = generateLowthianSchedule({
      startHour: 8,
      startMinute: 0,
      intervalHours: 2,
      protocolId: "classic",
    });

    // Simulated time: 09:15
    const mockNow = new Date("2026-09-08T09:15:00");
    const status = getCurrentLowthianSlot(schedule, mockNow);

    expect(status).not.toBeNull();
    expect(status?.currentSlot.startTime).toBe("08:00");
    expect(status?.currentSlot.endTime).toBe("10:00");
    expect(status?.currentSlot.position.code).toBe("DLD");
    expect(status?.nextSlot.startTime).toBe("10:00");
    expect(status?.nextSlot.position.code).toBe("DD");
    expect(status?.minutesElapsed).toBe(75);
    expect(status?.minutesRemaining).toBe(45);
  });

  it("correctly identifies active slot across midnight", () => {
    const schedule = generateLowthianSchedule({
      startHour: 22,
      startMinute: 0,
      intervalHours: 2,
      protocolId: "classic",
    });

    // Slot 0: 22:00 -> 00:00
    // Slot 1: 00:00 -> 02:00
    const mockNow = new Date("2026-09-08T23:30:00");
    const status = getCurrentLowthianSlot(schedule, mockNow);

    expect(status).not.toBeNull();
    expect(status?.currentSlot.startTime).toBe("22:00");
    expect(status?.currentSlot.endTime).toBe("00:00");
    expect(status?.minutesRemaining).toBe(30);
  });

  it("formats clinical nursing prescription text with essential safety guidelines", () => {
    const schedule = generateLowthianSchedule({
      startHour: 8,
      intervalHours: 2,
      protocolId: "classic",
    });

    const prescription = formatLowthianPrescription({
      patientName: "João Silva",
      bed: "102-B",
      intervalHours: 2,
      protocolName: "Clássico de Lowthian",
      schedule,
      notes: "Alergia a adesivos. Manter calcâneos flutuantes.",
    });

    expect(prescription).toContain("RELÓGIO DE LOWTHIAN");
    expect(prescription).toContain("João Silva");
    expect(prescription).toContain("102-B");
    expect(prescription).toContain("Regra dos 30°");
    expect(prescription).toContain("08:00 às 10:00");
    expect(prescription).toContain("Alergia a adesivos");
  });
});
