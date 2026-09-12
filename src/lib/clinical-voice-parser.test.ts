import { describe, it, expect } from "vitest";
import {
  parseClinicalVoiceInput,
  parseSpokenDate,
  formatPersonName,
  normalizeSpokenMedication,
  parseSpokenTime,
  parseMedicationVoiceInput,
  convertSpokenPortugueseNumbers,
  parseVitalSignsVoiceInput,
  parseSingleVitalValue,
} from "./clinical-voice-parser";

describe("Clinical Voice Parser", () => {
  it("formats person names correctly", () => {
    expect(formatPersonName("joao carlos da silva")).toBe("Joao Carlos da Silva");
    expect(formatPersonName("MARIA DE SOUZA")).toBe("Maria de Souza");
    expect(formatPersonName("ana beatriz dos santos e silva")).toBe("Ana Beatriz dos Santos e Silva");
  });

  it("parses dates in various formats", () => {
    expect(parseSpokenDate("15 de março de 1980")).toBe("15/03/1980");
    expect(parseSpokenDate("5 de maio de 1995")).toBe("05/05/1995");
    expect(parseSpokenDate("10/05/1982")).toBe("10/05/1982");
    expect(parseSpokenDate("1 de janeiro de 2000")).toBe("01/01/2000");
  });

  it("extracts full clinical dictation with all fields", () => {
    const speech =
      "Paciente Maria Silva de Souza, nascida em 15 de março de 1980, sexo feminino, leito 204, diagnóstico pneumonia comunitária grave, alergia a dipirona e penicilina, estado atenção";

    const parsed = parseClinicalVoiceInput(speech);

    expect(parsed.name).toBe("Maria Silva de Souza");
    expect(parsed.birthDate).toBe("15/03/1980");
    expect(parsed.gender).toBe("Feminino");
    expect(parsed.bed).toBe("204");
    expect(parsed.diagnosis).toBe("Pneumonia comunitária grave");
    expect(parsed.allergies).toBe("Dipirona e penicilina");
    expect(parsed.condition).toBe("ATENCAO");
  });

  it("extracts patient with ICU bed and critical condition", () => {
    const speech =
      "Nome Roberto Carlos Alves, sexo masculino, data de nascimento 10/08/1965, leito UTI-03, hipótese diagnóstica infarto agudo do miocárdio, alergia a contraste iodado, estado crítico";

    const parsed = parseClinicalVoiceInput(speech);

    expect(parsed.name).toBe("Roberto Carlos Alves");
    expect(parsed.birthDate).toBe("10/08/1965");
    expect(parsed.gender).toBe("Masculino");
    expect(parsed.bed).toBe("UTI-03");
    expect(parsed.diagnosis).toBe("Infarto agudo do miocárdio");
    expect(parsed.allergies).toBe("Contraste iodado");
    expect(parsed.condition).toBe("CRITICO");
  });

  it("handles patient with no known allergies", () => {
    const speech =
      "Paciente Carlos Eduardo, nascido em 20 de outubro de 1990, sexo masculino, leito 12, diagnóstico apendicite aguda, nega alergias";

    const parsed = parseClinicalVoiceInput(speech);

    expect(parsed.name).toBe("Carlos Eduardo");
    expect(parsed.birthDate).toBe("20/10/1990");
    expect(parsed.gender).toBe("Masculino");
    expect(parsed.bed).toBe("12");
    expect(parsed.diagnosis).toBe("Apendicite aguda");
    expect(parsed.allergies).toBe("Nega alergias conhecidas");
  });

  it("normalizes spoken medication text properly", () => {
    expect(normalizeSpokenMedication("dipirona quinhentos miligramas")).toBe("Dipirona 500mg");
    expect(normalizeSpokenMedication("uma ampola endovenosa")).toBe("1 ampola EV");
    expect(normalizeSpokenMedication("dois comprimidos via oral")).toBe("2 comp VO");
    expect(normalizeSpokenMedication("dez unidades subcutânea")).toBe("10 UI SC");
  });

  it("parses spoken time in various formats", () => {
    expect(parseSpokenTime("08:00")).toBe("08:00");
    expect(parseSpokenTime("às 8 horas")).toBe("08:00");
    expect(parseSpokenTime("14 horas e 30 minutos")).toBe("14:30");
    expect(parseSpokenTime("às duas da tarde")).toBe("14:00");
    expect(parseSpokenTime("8 da noite")).toBe("20:00");
  });

  it("extracts full medication prescription from voice dictation", () => {
    const speech =
      "Dipirona quinhentos miligramas, uma ampola endovenosa às 08 horas de 8 em 8 horas diluir em 100ml de soro fisiológico";
    const parsed = parseMedicationVoiceInput(speech);

    expect(parsed.name).toContain("Dipirona");
    expect(parsed.dose).toBe("1 ampola EV");
    expect(parsed.schedule).toBe("08:00");
    expect(parsed.frequency).toBe("8");
    expect(parsed.observation).toContain("Diluir em 100ml de soro");
  });

  it("handles PRN (se necessário) medication dictation", () => {
    const speech = "Metoclopramida 10mg EV se necessário se dor ou vômito";
    const parsed = parseMedicationVoiceInput(speech);

    expect(parsed.name).toContain("Metoclopramida");
    expect(parsed.dose).toBe("10mg EV");
    expect(parsed.frequency).toBe("");
    expect(parsed.observation).toContain("Se dor ou vômito");
  });

  describe("Vital Signs Voice Parser", () => {
    it("converts spoken numbers and compound expressions", () => {
      expect(convertSpokenPortugueseNumbers("trinta e seis e meio")).toBe("36.5");
      expect(convertSpokenPortugueseNumbers("doze por oito")).toBe("12 por 8");
      expect(convertSpokenPortugueseNumbers("cento e vinte por oitenta")).toBe("120 por 80");
      expect(convertSpokenPortugueseNumbers("trinta e sete ponto dois")).toBe("37.2");
      expect(convertSpokenPortugueseNumbers("trinta e sete e oito")).toBe("37.8");
    });

    it("parses Temperatura correctly", () => {
      const p1 = parseVitalSignsVoiceInput("temperatura trinta e seis e meio");
      expect(p1.type).toBe("TEMPERATURA");
      expect(p1.value).toBe(36.5);

      const p2 = parseVitalSignsVoiceInput("temperatura 37 e 8");
      expect(p2.type).toBe("TEMPERATURA");
      expect(p2.value).toBe(37.8);
    });

    it("parses Pressão Arterial correctly with Brazilian clinical convention", () => {
      const p1 = parseVitalSignsVoiceInput("pressão 12 por 8");
      expect(p1.type).toBe("PRESSAO_ARTERIAL");
      expect(p1.systolic).toBe(120);
      expect(p1.diastolic).toBe(80);

      const p2 = parseVitalSignsVoiceInput("pa 120 por 80");
      expect(p2.type).toBe("PRESSAO_ARTERIAL");
      expect(p2.systolic).toBe(120);
      expect(p2.diastolic).toBe(80);

      const p3 = parseVitalSignsVoiceInput("pressão arterial 13 por 8 e meio");
      expect(p3.type).toBe("PRESSAO_ARTERIAL");
      expect(p3.systolic).toBe(130);
      expect(p3.diastolic).toBe(85);
    });

    it("parses Frequência Cardíaca correctly", () => {
      const p1 = parseVitalSignsVoiceInput("frequência cardíaca setenta e oito");
      expect(p1.type).toBe("FREQUENCIA_CARDIACA");
      expect(p1.value).toBe(78);

      const p2 = parseVitalSignsVoiceInput("pulso 80 bpm");
      expect(p2.type).toBe("FREQUENCIA_CARDIACA");
      expect(p2.value).toBe(80);
    });

    it("parses Frequência Respiratória correctly", () => {
      const p1 = parseVitalSignsVoiceInput("frequência respiratória dezoito");
      expect(p1.type).toBe("FREQUENCIA_RESPIRATORIA");
      expect(p1.value).toBe(18);

      const p2 = parseVitalSignsVoiceInput("fr 16 irpm");
      expect(p2.type).toBe("FREQUENCIA_RESPIRATORIA");
      expect(p2.value).toBe(16);
    });

    it("parses Saturação O₂ correctly", () => {
      const p1 = parseVitalSignsVoiceInput("saturação noventa e oito por cento");
      expect(p1.type).toBe("SATURACAO_O2");
      expect(p1.value).toBe(98);

      const p2 = parseVitalSignsVoiceInput("spo2 97%");
      expect(p2.type).toBe("SATURACAO_O2");
      expect(p2.value).toBe(97);
    });

    it("parses Glicemia Capilar correctly", () => {
      const p1 = parseVitalSignsVoiceInput("glicemia cento e quinze");
      expect(p1.type).toBe("GLICEMIA");
      expect(p1.value).toBe(115);

      const p2 = parseVitalSignsVoiceInput("hgt 95");
      expect(p2.type).toBe("GLICEMIA");
      expect(p2.value).toBe(95);
    });

    it("parses Escala de Dor correctly", () => {
      const p1 = parseVitalSignsVoiceInput("sem dor");
      expect(p1.type).toBe("ESCALA_DE_DOR");
      expect(p1.value).toBe(0);

      const p2 = parseVitalSignsVoiceInput("dor moderada");
      expect(p2.type).toBe("ESCALA_DE_DOR");
      expect(p2.value).toBe(5);

      const p3 = parseVitalSignsVoiceInput("escala de dor 3");
      expect(p3.type).toBe("ESCALA_DE_DOR");
      expect(p3.value).toBe(3);
    });

    it("parses multiple vital signs in a single spoken phrase", () => {
      const speech = "Pressão 12 por 8 e temperatura 36 e meio e saturação 98%";
      const parsed = parseVitalSignsVoiceInput(speech);

      expect(parsed.detectedVitals.length).toBe(3);
      expect(parsed.detectedVitals.some((v) => v.type === "PRESSAO_ARTERIAL" && v.systolic === 120 && v.diastolic === 80)).toBe(true);
      expect(parsed.detectedVitals.some((v) => v.type === "TEMPERATURA" && v.value === 36.5)).toBe(true);
      expect(parsed.detectedVitals.some((v) => v.type === "SATURACAO_O2" && v.value === 98)).toBe(true);
    });

    it("parses single vital values directly when field type is provided", () => {
      expect(parseSingleVitalValue("TEMPERATURA", "37 e meio")).toEqual({ value: 37.5 });
      expect(parseSingleVitalValue("PRESSAO_ARTERIAL", "14 por 9")).toEqual({ systolic: 140, diastolic: 90 });
      expect(parseSingleVitalValue("SATURACAO_O2", "99")).toEqual({ value: 99 });
      expect(parseSingleVitalValue("ESCALA_DE_DOR", "dor leve")).toEqual({ value: 2 });
    });
  });
});
