"use client";

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { getDb, nowIso } from "./client";
import { getPatientById, type Patient } from "./patients";
import { listVitalSigns, type VitalSign } from "./vitalSigns";
import { listMedications, type Medication } from "./medications";
import { type NursingNote } from "./nursingNotes";

export interface PatientItemBundle {
  patient: Patient;
  vitalSigns: VitalSign[];
  medications: Medication[];
  nursingNotes?: NursingNote[];
}

export interface PatientExportBundle {
  version: 1;
  exportedAt: string;
  patient?: Patient;
  vitalSigns?: VitalSign[];
  medications?: Medication[];
  nursingNotes?: NursingNote[];
  patients?: PatientItemBundle[];
}

export interface ImportResult {
  created: boolean;
  updated: boolean;
  vitalsAdded: number;
  medsAdded: number;
  notesAdded: number;
}

export interface MultiImportResult {
  totalPatients: number;
  createdCount: number;
  updatedCount: number;
  vitalsAdded: number;
  medsAdded: number;
  notesAdded: number;
}

/**
 * Coleta os dados de um paciente individual e monta o objeto JSON de exportação
 */
export async function exportPatientBundle(patientId: string): Promise<PatientExportBundle> {
  const patient = await getPatientById(patientId);
  if (!patient) {
    throw new Error(`Paciente com ID ${patientId} não foi encontrado.`);
  }

  const [vitalSigns, medications] = await Promise.all([
    listVitalSigns({ patientId }),
    listMedications({ patientId }),
  ]);

  return {
    version: 1,
    exportedAt: nowIso(),
    patient,
    vitalSigns,
    medications,
    patients: [
      {
        patient,
        vitalSigns,
        medications,
      },
    ],
  };
}

/**
 * Coleta os dados de múltiplos pacientes selecionados e monta o bundle de exportação em lote
 */
export async function exportMultiplePatientsBundle(patientIds: string[]): Promise<PatientExportBundle> {
  if (!patientIds || patientIds.length === 0) {
    throw new Error("Nenhum paciente selecionado para compartilhamento.");
  }

  const items: PatientItemBundle[] = [];

  for (const id of patientIds) {
    const patient = await getPatientById(id);
    if (!patient) continue;

    const [vitalSigns, medications] = await Promise.all([
      listVitalSigns({ patientId: id }),
      listMedications({ patientId: id }),
    ]);

    items.push({
      patient,
      vitalSigns,
      medications,
    });
  }

  if (items.length === 0) {
    throw new Error("Nenhum paciente válido encontrado para compartilhamento.");
  }

  const first = items[0];

  return {
    version: 1,
    exportedAt: nowIso(),
    patient: first.patient,
    vitalSigns: items.length === 1 ? first.vitalSigns : [],
    medications: items.length === 1 ? first.medications : [],
    patients: items,
  };
}

/**
 * Salva o JSON em cache e abre o menu de compartilhamento nativo do Android
 */
export async function sharePatientBundle(bundle: PatientExportBundle): Promise<void> {
  const isMulti = Array.isArray(bundle.patients) && bundle.patients.length > 1;
  const count = bundle.patients?.length ?? (bundle.patient ? 1 : 0);

  let fileName = "paciente.json";
  let title = "Prontuário";
  let text = "Arquivo de transferência clínica";

  const dateStr = new Date().toISOString().slice(0, 10);

  if (isMulti) {
    fileName = `plantao-${count}-pacientes-${dateStr}.json`;
    title = `Transferência de Plantão (${count} Pacientes)`;
    text = `Arquivo de transferência clínica contendo dados de ${count} pacientes da enfermaria.`;
  } else {
    const single = bundle.patient || bundle.patients?.[0]?.patient;
    const safeName = (single?.name || "paciente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "paciente";

    fileName = `paciente-${safeName}-${dateStr}.json`;
    title = `Prontuário - ${single?.name || "Paciente"}`;
    text = `Arquivo de transferência clínica do paciente ${single?.name || ""} (Leito: ${single?.bed || "—"})`;
  }

  const jsonContent = JSON.stringify(bundle, null, 2);

  if (Capacitor.isNativePlatform()) {
    // 1. Grava no cache do dispositivo Android
    const writeResult = await Filesystem.writeFile({
      path: fileName,
      data: jsonContent,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    // 2. Aciona o menu nativo de compartilhamento
    await Share.share({
      title,
      text,
      url: writeResult.uri,
      dialogTitle: isMulti
        ? `Compartilhar ${count} Pacientes (Transferência de Plantão)`
        : "Compartilhar Paciente (Transferência Clínica)",
    });
  } else {
    // Fallback Web: Tenta Web Share API com arquivo ou download direto do arquivo .json
    const blob = new Blob([jsonContent], { type: "application/json" });

    if (typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([blob], fileName, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title,
          text,
          files: [file],
        });
        return;
      }
    }

    // Download fallback para browser
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Valida a estrutura básica de um arquivo de exportação (individual ou lote)
 */
export function validatePatientBundle(data: unknown): data is PatientExportBundle {
  if (!data || typeof data !== "object") return false;
  const bundle = data as Record<string, unknown>;

  if (bundle.version !== 1) return false;

  // Formato múltiplo
  if (Array.isArray(bundle.patients) && bundle.patients.length > 0) {
    return bundle.patients.every(
      (item) =>
        item &&
        typeof item === "object" &&
        item.patient &&
        typeof item.patient === "object" &&
        typeof item.patient.id === "string" &&
        typeof item.patient.name === "string"
    );
  }

  // Formato individual
  if (bundle.patient && typeof bundle.patient === "object") {
    const patient = bundle.patient as Record<string, unknown>;
    if (!patient.id || typeof patient.id !== "string") return false;
    if (!patient.name || typeof patient.name !== "string") return false;
    return true;
  }

  return false;
}

/**
 * Importa um bundle de paciente no banco local.
 * - Se o paciente não existir: cria com o MESMO ID e insere todos os registros.
 * - Se o paciente já existir e overwrite for true: atualiza dados do paciente e adiciona apenas novos registros (mescla por ID).
 */
export async function importPatientBundle(
  bundle: PatientExportBundle,
  overwrite: boolean = false
): Promise<ImportResult> {
  const targetPatient = bundle.patient || bundle.patients?.[0]?.patient;
  if (!targetPatient) {
    throw new Error("Arquivo não contém dados válidos de paciente.");
  }

  const targetVitals = bundle.vitalSigns || bundle.patients?.[0]?.vitalSigns || [];
  const targetMeds = bundle.medications || bundle.patients?.[0]?.medications || [];
  const targetNotes = bundle.nursingNotes || bundle.patients?.[0]?.nursingNotes || [];

  const db = await getDb();
  const existing = await getPatientById(targetPatient.id);

  if (!existing) {
    // 1. Inserir paciente com o MESMO ID do arquivo
    await db.run(
      `INSERT INTO Patient (
        id, name, birthDate, gender, bed, diagnosis, allergies,
        emergencyContact, emergencyPhone, photo, admissionDate,
        dischargeDate, active, priority, condition, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetPatient.id,
        targetPatient.name,
        targetPatient.birthDate,
        targetPatient.gender,
        targetPatient.bed || "",
        targetPatient.diagnosis || "",
        targetPatient.allergies || "",
        targetPatient.emergencyContact || "",
        targetPatient.emergencyPhone || "",
        targetPatient.photo || "",
        targetPatient.admissionDate,
        targetPatient.dischargeDate ?? null,
        targetPatient.active ? 1 : 0,
        targetPatient.priority ? 1 : 0,
        targetPatient.condition || "",
        targetPatient.createdAt || nowIso(),
      ]
    );

    // 2. Inserir todos os sinais vitais
    let vitalsAdded = 0;
    for (const v of targetVitals) {
      await db.run(
        `INSERT OR IGNORE INTO VitalSign (id, patientId, type, value, systolic, diastolic, unit, recordedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          targetPatient.id,
          v.type,
          v.value,
          v.systolic ?? null,
          v.diastolic ?? null,
          v.unit,
          v.recordedAt,
        ]
      );
      vitalsAdded++;
    }

    // 3. Inserir todas as medicações
    let medsAdded = 0;
    for (const m of targetMeds) {
      await db.run(
        `INSERT OR IGNORE INTO Medication (
          id, patientId, name, dose, schedule, frequencyHours,
          administered, administeredAt, observation, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          targetPatient.id,
          m.name,
          m.dose,
          m.schedule,
          m.frequencyHours ?? null,
          m.administered ? 1 : 0,
          m.administeredAt ?? null,
          m.observation || "",
          m.createdAt || nowIso(),
        ]
      );
      medsAdded++;
    }

    // 4. Inserir todas as anotações / evoluções
    let notesAdded = 0;
    for (const n of targetNotes) {
      await db.run(
        `INSERT OR IGNORE INTO NursingNote (id, patientId, content, createdAt)
         VALUES (?, ?, ?, ?)`,
        [n.id, targetPatient.id, n.content, n.createdAt || nowIso()]
      );
      notesAdded++;
    }

    return {
      created: true,
      updated: false,
      vitalsAdded,
      medsAdded,
      notesAdded,
    };
  }

  // Paciente já existe
  if (!overwrite) {
    throw new Error("Paciente já existe no banco de dados e a substituição não foi autorizada.");
  }

  // Atualizar dados cadastrais do paciente
  await db.run(
    `UPDATE Patient SET
      name = ?, birthDate = ?, gender = ?, bed = ?, diagnosis = ?,
      allergies = ?, emergencyContact = ?, emergencyPhone = ?, photo = ?,
      admissionDate = ?, dischargeDate = ?, active = ?, priority = ?, condition = ?
     WHERE id = ?`,
    [
      targetPatient.name,
      targetPatient.birthDate,
      targetPatient.gender,
      targetPatient.bed || "",
      targetPatient.diagnosis || "",
      targetPatient.allergies || "",
      targetPatient.emergencyContact || "",
      targetPatient.emergencyPhone || "",
      targetPatient.photo || "",
      targetPatient.admissionDate,
      targetPatient.dischargeDate ?? null,
      targetPatient.active ? 1 : 0,
      targetPatient.priority ? 1 : 0,
      targetPatient.condition || "",
      targetPatient.id,
    ]
  );

  // Mesclar registros que ainda não existem (comparar por ID)
  let vitalsAdded = 0;
  for (const v of targetVitals) {
    const check = await db.query(`SELECT id FROM VitalSign WHERE id = ?`, [v.id]);
    if (!check.values || check.values.length === 0) {
      await db.run(
        `INSERT INTO VitalSign (id, patientId, type, value, systolic, diastolic, unit, recordedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id,
          targetPatient.id,
          v.type,
          v.value,
          v.systolic ?? null,
          v.diastolic ?? null,
          v.unit,
          v.recordedAt,
        ]
      );
      vitalsAdded++;
    }
  }

  let medsAdded = 0;
  for (const m of targetMeds) {
    const check = await db.query(`SELECT id FROM Medication WHERE id = ?`, [m.id]);
    if (!check.values || check.values.length === 0) {
      await db.run(
        `INSERT INTO Medication (
          id, patientId, name, dose, schedule, frequencyHours,
          administered, administeredAt, observation, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.id,
          targetPatient.id,
          m.name,
          m.dose,
          m.schedule,
          m.frequencyHours ?? null,
          m.administered ? 1 : 0,
          m.administeredAt ?? null,
          m.observation || "",
          m.createdAt || nowIso(),
        ]
      );
      medsAdded++;
    }
  }

  let notesAdded = 0;
  for (const n of targetNotes) {
    const check = await db.query(`SELECT id FROM NursingNote WHERE id = ?`, [n.id]);
    if (!check.values || check.values.length === 0) {
      await db.run(
        `INSERT INTO NursingNote (id, patientId, content, createdAt)
         VALUES (?, ?, ?, ?)`,
        [n.id, targetPatient.id, n.content, n.createdAt || nowIso()]
      );
      notesAdded++;
    }
  }

  return {
    created: false,
    updated: true,
    vitalsAdded,
    medsAdded,
    notesAdded,
  };
}

/**
 * Importa um bundle que pode conter um ou múltiplos pacientes
 */
export async function importAnyPatientBundle(
  bundle: PatientExportBundle,
  overwrite: boolean = false
): Promise<MultiImportResult> {
  const items: PatientItemBundle[] = Array.isArray(bundle.patients) && bundle.patients.length > 0
    ? bundle.patients
    : bundle.patient
    ? [
        {
          patient: bundle.patient,
          vitalSigns: bundle.vitalSigns || [],
          medications: bundle.medications || [],
          nursingNotes: bundle.nursingNotes || [],
        },
      ]
    : [];

  let createdCount = 0;
  let updatedCount = 0;
  let vitalsAdded = 0;
  let medsAdded = 0;
  let notesAdded = 0;

  for (const item of items) {
    const singleBundle: PatientExportBundle = {
      version: 1,
      exportedAt: bundle.exportedAt,
      patient: item.patient,
      vitalSigns: item.vitalSigns,
      medications: item.medications,
      nursingNotes: item.nursingNotes,
    };
    const res = await importPatientBundle(singleBundle, overwrite);
    if (res.created) createdCount++;
    if (res.updated) updatedCount++;
    vitalsAdded += res.vitalsAdded;
    medsAdded += res.medsAdded;
    notesAdded += res.notesAdded;
  }

  return {
    totalPatients: items.length,
    createdCount,
    updatedCount,
    vitalsAdded,
    medsAdded,
    notesAdded,
  };
}
