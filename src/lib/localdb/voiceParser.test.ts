import { describe, it, expect } from "vitest";
import { parseTaskFromSpeech } from "./voiceParser";

describe("parseTaskFromSpeech", () => {
  const patients = [
    { id: "p1", name: "João Silva" },
    { id: "p2", name: "Maria de Lurdes" },
    { id: "p3", name: "Carlos Eduardo Oliveira" },
    { id: "p4", name: "Ana Beatriz Santos" },
  ];

  it("extrai paciente, data futura e ação clínica com 'amanhã às 14:30'", () => {
    const text = "Aferir pressão de João Silva amanhã às 14:30";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBe("p1");
    expect(res.patientName).toBe("João Silva");
    expect(res.scheduledAt).not.toBeNull();
    expect(res.scheduledAt!.getHours()).toBe(14);
    expect(res.scheduledAt!.getMinutes()).toBe(30);
    expect(res.description.toLowerCase()).toContain("aferir pressão");
  });

  it("reconhece padrão relativo em minutos 'daqui a 30 minutos'", () => {
    const text = "Dar banho no leito para Maria daqui a 30 minutos";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBe("p2");
    expect(res.patientName).toBe("Maria de Lurdes");
    expect(res.scheduledAt).not.toBeNull();
    expect(res.description.toLowerCase()).toContain("dar banho no leito");
  });

  it("lida com tarefa sem paciente específico (Geral)", () => {
    const text = "Trocar curativo do leito 3 às 16h";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBeNull();
    expect(res.patientName).toBe("");
    expect(res.scheduledAt).not.toBeNull();
    expect(res.scheduledAt!.getHours()).toBe(16);
    expect(res.scheduledAt!.getMinutes()).toBe(0);
    expect(res.description.toLowerCase()).toContain("trocar curativo do leito 3");
  });

  it("reconhece 'hoje às 20:00' e paciente com correspondência de múltiplos nomes", () => {
    const text = "Medicar Carlos Eduardo hoje às 20:00";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBe("p3");
    expect(res.patientName).toBe("Carlos Eduardo Oliveira");
    expect(res.scheduledAt).not.toBeNull();
    expect(res.scheduledAt!.getHours()).toBe(20);
    expect(res.scheduledAt!.getMinutes()).toBe(0);
    expect(res.description.toLowerCase()).toContain("medicar");
  });

  it("reconhece dia da semana com horário", () => {
    const text = "Coletar exames de sangue para Ana Beatriz na sexta-feira às 08:00";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBe("p4");
    expect(res.patientName).toBe("Ana Beatriz Santos");
    expect(res.scheduledAt).not.toBeNull();
    expect(res.scheduledAt!.getHours()).toBe(8);
    expect(res.scheduledAt!.getMinutes()).toBe(0);
    expect(res.description.toLowerCase()).toContain("coletar exames de sangue");
  });

  it("retorna nulo quando texto vazio ou sem data/paciente", () => {
    const text = "";
    const res = parseTaskFromSpeech(text, patients);

    expect(res.patientId).toBeNull();
    expect(res.patientName).toBe("");
    expect(res.description).toBe("");
    expect(res.scheduledAt).toBeNull();
  });
});
