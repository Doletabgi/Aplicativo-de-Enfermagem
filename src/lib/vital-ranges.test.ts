import { describe, it, expect } from "vitest";
import { getValueStatus, getBpStatus } from "./vital-ranges";

describe("vital-ranges logic", () => {
  describe("getValueStatus", () => {
    it("evaluates temperature correctly", () => {
      expect(getValueStatus("TEMPERATURA", 36.5)).toBe("normal");
      expect(getValueStatus("TEMPERATURA", 37.8)).toBe("atencao");
      expect(getValueStatus("TEMPERATURA", 39.5)).toBe("atencao");
      expect(getValueStatus("TEMPERATURA", 40.5)).toBe("critico");
      expect(getValueStatus("TEMPERATURA", 34.0)).toBe("critico");
    });

    it("evaluates heart rate (FREQUENCIA_CARDIACA) correctly", () => {
      expect(getValueStatus("FREQUENCIA_CARDIACA", 75)).toBe("normal");
      expect(getValueStatus("FREQUENCIA_CARDIACA", 110)).toBe("atencao");
      expect(getValueStatus("FREQUENCIA_CARDIACA", 55)).toBe("atencao");
      expect(getValueStatus("FREQUENCIA_CARDIACA", 150)).toBe("critico");
      expect(getValueStatus("FREQUENCIA_CARDIACA", 35)).toBe("critico");
    });

    it("evaluates O2 saturation (SATURACAO_O2) correctly", () => {
      expect(getValueStatus("SATURACAO_O2", 98)).toBe("normal");
      expect(getValueStatus("SATURACAO_O2", 92)).toBe("atencao");
      expect(getValueStatus("SATURACAO_O2", 88)).toBe("critico");
    });

    it("evaluates blood glucose (GLICEMIA) correctly", () => {
      expect(getValueStatus("GLICEMIA", 90)).toBe("normal");
      expect(getValueStatus("GLICEMIA", 160)).toBe("atencao");
      expect(getValueStatus("GLICEMIA", 60)).toBe("atencao");
      expect(getValueStatus("GLICEMIA", 300)).toBe("critico");
      expect(getValueStatus("GLICEMIA", 40)).toBe("critico");
    });

    it("evaluates pain scale (ESCALA_DE_DOR) correctly", () => {
      expect(getValueStatus("ESCALA_DE_DOR", 0)).toBe("normal");
      expect(getValueStatus("ESCALA_DE_DOR", 2)).toBe("normal");
      expect(getValueStatus("ESCALA_DE_DOR", 5)).toBe("atencao");
    });
  });

  describe("getBpStatus", () => {
    it("evaluates normal blood pressure", () => {
      expect(getBpStatus(120, 80)).toBe("normal");
      expect(getBpStatus(110, 70)).toBe("normal");
    });

    it("evaluates attention blood pressure", () => {
      expect(getBpStatus(145, 85)).toBe("atencao");
      expect(getBpStatus(120, 95)).toBe("atencao");
    });

    it("evaluates critical blood pressure", () => {
      expect(getBpStatus(190, 100)).toBe("critico");
      expect(getBpStatus(70, 40)).toBe("critico");
      expect(getBpStatus(130, 115)).toBe("critico");
    });
  });
});
