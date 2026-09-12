import { describe, it, expect } from "vitest";
import { validatePatientBundle, type PatientExportBundle } from "./share";

describe("validatePatientBundle", () => {
  it("should validate a valid single-patient bundle", () => {
    const mockPatient = {
      id: "pat-1",
      name: "Maria Silva",
      birthDate: "1990-01-01",
      gender: "F",
      bed: "101",
      diagnosis: "",
      allergies: "",
      emergencyContact: "",
      emergencyPhone: "",
      photo: "",
      admissionDate: "2026-09-01",
      dischargeDate: null,
      active: true,
      priority: false,
      condition: "",
      createdAt: "2026-09-01T00:00:00.000Z",
    };

    const bundle: PatientExportBundle = {
      version: 1,
      exportedAt: "2026-09-06T20:00:00.000Z",
      patient: mockPatient,
      vitalSigns: [],
      medications: [],
      nursingNotes: [],
    };

    expect(validatePatientBundle(bundle)).toBe(true);
  });

  it("should validate a valid multi-patient bundle", () => {
    const mockPatient1 = {
      id: "pat-1",
      name: "Maria Silva",
      birthDate: "1990-01-01",
      gender: "F",
      bed: "101",
      diagnosis: "",
      allergies: "",
      emergencyContact: "",
      emergencyPhone: "",
      photo: "",
      admissionDate: "2026-09-01",
      dischargeDate: null,
      active: true,
      priority: false,
      condition: "",
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const mockPatient2 = {
      ...mockPatient1,
      id: "pat-2",
      name: "João Santos",
      admissionDate: "2026-09-02",
    };

    const bundle: PatientExportBundle = {
      version: 1,
      exportedAt: "2026-09-06T20:00:00.000Z",
      patients: [
        {
          patient: mockPatient1,
          vitalSigns: [],
          medications: [],
          nursingNotes: [],
        },
        {
          patient: mockPatient2,
          vitalSigns: [],
          medications: [],
          nursingNotes: [],
        },
      ],
    };

    expect(validatePatientBundle(bundle)).toBe(true);
  });

  it("should reject an invalid bundle with missing version or patient data", () => {
    expect(validatePatientBundle(null)).toBe(false);
    expect(validatePatientBundle({})).toBe(false);
    expect(validatePatientBundle({ version: 2, patient: { id: "1", name: "A" } })).toBe(false);
    expect(validatePatientBundle({ version: 1, patient: { id: "" } })).toBe(false);
    expect(validatePatientBundle({ version: 1, patients: [] })).toBe(false);
    expect(
      validatePatientBundle({
        version: 1,
        patients: [{ patient: { id: "p1" } }], // missing name
      })
    ).toBe(false);
  });
});
