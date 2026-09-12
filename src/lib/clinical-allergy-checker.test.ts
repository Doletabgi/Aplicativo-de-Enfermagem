import { describe, it, expect } from "vitest";
import {
  checkMedicationAllergyConflict,
  extractAllergyTerms,
  extractAllergiesFromDiagnosis,
} from "./clinical-allergy-checker";

describe("clinical-allergy-checker", () => {
  it("deve extrair termos de alergias ignorando negações", () => {
    expect(extractAllergyTerms("Nega alergias conhecidas")).toEqual([]);
    expect(extractAllergyTerms("Nenhuma relatada")).toEqual([]);
    expect(extractAllergyTerms("Sem alergias")).toEqual([]);
    expect(extractAllergyTerms("Dipirona, Penicilina")).toEqual(["Dipirona", "Penicilina"]);
    expect(extractAllergyTerms("Alergia a Dipirona e AAS")).toEqual(["Dipirona", "AAS"]);
    expect(extractAllergyTerms("Alergica a Ceftriaxona / Plasil")).toEqual(["Ceftriaxona", "Plasil"]);
  });

  it("deve extrair alergias mencionadas no diagnóstico", () => {
    expect(extractAllergiesFromDiagnosis("Pneumonia comunitária grave")).toEqual([]);
    expect(extractAllergiesFromDiagnosis("Pneumonia bacteriana, alergia a dipirona")).toEqual(["dipirona"]);
    expect(extractAllergiesFromDiagnosis("Quadro infeccioso, choque anafilático por penicilina")).toEqual(["penicilina"]);
  });

  it("deve bloquear medicação que colide exatamente com alergia registrada", () => {
    const patient = {
      allergies: "Dipirona",
      diagnosis: "Laparotomia exploradora",
    };
    const result = checkMedicationAllergyConflict("Dipirona", patient);
    expect(result.hasConflict).toBe(true);
    expect(result.matchedTerm).toBe("Dipirona");
  });

  it("deve bloquear medicação com dosagem quando o princípio ativo está nas alergias", () => {
    const patient = {
      allergies: "Dipirona, Penicilina, Tramadol",
      diagnosis: "Apendicite aguda",
    };
    const result = checkMedicationAllergyConflict("Dipirona 500mg IV", patient);
    expect(result.hasConflict).toBe(true);
    expect(result.matchedTerm).toBe("Dipirona");
  });

  it("deve bloquear com variação de acentos e maiúsculas/minúsculas", () => {
    const patient = {
      allergies: "Dipirona Sódica",
      diagnosis: "Dor lombar",
    };
    const result = checkMedicationAllergyConflict("dipirona sodica 1g", patient);
    expect(result.hasConflict).toBe(true);
  });

  it("deve bloquear siglas curtas como AAS com segurança sem falsos positivos", () => {
    const patient = {
      allergies: "AAS e Ibuprofeno",
      diagnosis: "HAS",
    };
    const resultAAS = checkMedicationAllergyConflict("AAS 100mg", patient);
    expect(resultAAS.hasConflict).toBe(true);

    const resultSafe = checkMedicationAllergyConflict("Paracetamol 750mg", patient);
    expect(resultSafe.hasConflict).toBe(false);
  });

  it("não deve bloquear se o paciente nega alergias conhecidas", () => {
    const patient = {
      allergies: "Nega alergias conhecidas",
      diagnosis: "Pneumonia",
    };
    const result = checkMedicationAllergyConflict("Dipirona 500mg", patient);
    expect(result.hasConflict).toBe(false);
  });

  it("não deve bloquear se o paciente não possui alergias relatadas", () => {
    const patient = {
      allergies: "Nenhuma relatada",
      diagnosis: "Gastroenterite",
    };
    const result = checkMedicationAllergyConflict("Ceftriaxona 1g", patient);
    expect(result.hasConflict).toBe(false);
  });

  it("deve bloquear se a alergia estiver descrita no quadro clínico / diagnóstico", () => {
    const patient = {
      allergies: "",
      diagnosis: "Pneumonia comunitária, alergia a penicilina",
    };
    const result = checkMedicationAllergyConflict("Penicilina Benzatina", patient);
    expect(result.hasConflict).toBe(true);
    expect(result.source).toBe("diagnosis");
  });

  it("não deve bloquear medicações não relacionadas", () => {
    const patient = {
      allergies: "Dipirona, Plasil",
      diagnosis: "Pós-operatório",
    };
    const result = checkMedicationAllergyConflict("Ondansetrona 8mg", patient);
    expect(result.hasConflict).toBe(false);
  });
});
