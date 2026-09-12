"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Activity, Pill, FileText, Printer, Star,
  HeartPulse, Phone, AlertTriangle, Trash2, LogOut, Edit3,
  Plus, Check, Clock, X, Send, Camera, Sparkles, RefreshCw, Bot,
  ClipboardList, Copy, Save, ChevronRight, Bed, Calendar, CheckCircle2,
  AlertCircle, ShieldAlert, Bell, Share2, Mic, MicOff
} from "lucide-react";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import {
  normalizeSpokenMedication,
  parseSpokenTime,
  parseMedicationVoiceInput,
  parseVitalSignsVoiceInput,
  parseSingleVitalValue,
} from "@/lib/clinical-voice-parser";
import { checkMedicationAllergyConflict } from "@/lib/clinical-allergy-checker";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { getValueStatus, getBpStatus } from "@/lib/vital-ranges";
import { VITAL_SIGN_TYPES } from "@/types";
import type { VitalSignType } from "@/types";
import VitalSignsChart from "@/components/VitalSignsChart";
import {
  scheduleMedicationNotification,
  cancelMedicationNotification,
  requestNotificationPermission,
} from "@/lib/notifications";
import {
  getPatientById,
  getPatientStatus,
  setPatientPriority,
  updatePatient,
  deletePatient as deletePatientDb,
  listVitalSigns,
  createVitalSign,
  listMedications,
  createMedication,
  updateMedication,
  deleteMedication as deleteMedicationDb,
  listNursingNotes,
  createNursingNote,
  updateNursingNote,
  deleteNursingNote,
  getCareSuggestions,
  getNursingReport,
  getSettings,
  uploadPhoto,
  exportPatientBundle,
  sharePatientBundle,
} from "@/lib/localdb";

type Tab = "dados" | "sinais" | "medicacoes" | "evolucoes" | "cuidados" | "relatorio";

interface Patient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  bed: string;
  diagnosis: string;
  allergies: string;
  emergencyContact: string;
  emergencyPhone: string;
  photo: string;
  admissionDate: string;
  dischargeDate: string | null;
  active: boolean;
  priority: boolean;
  condition: string;
}

interface VitalSign {
  id: string;
  type: string;
  value: number;
  systolic: number | null;
  diastolic: number | null;
  unit: string;
  recordedAt: string;
}

interface Medication {
  id: string;
  name: string;
  dose: string;
  schedule: string;
  frequencyHours: number | null;
  administered: boolean;
  administeredAt: string | null;
  observation: string;
}

interface NursingNote {
  id: string;
  content: string;
  createdAt: string;
}

export default function PatientDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Carregando...</div>}>
      <PatientDetailContent />
    </Suspense>
  );
}

function PatientDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const router = useRouter();
  const tabParam = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(() => {
    const validTabs: Tab[] = ["dados", "sinais", "medicacoes", "evolucoes", "cuidados", "relatorio"];
    return tabParam && validTabs.includes(tabParam) ? tabParam : "dados";
  });

  useEffect(() => {
    const t = searchParams.get("tab") as Tab | null;
    const validTabs: Tab[] = ["dados", "sinais", "medicacoes", "evolucoes", "cuidados", "relatorio"];
    if (t && validTabs.includes(t)) {
      setTab(t);
    }
  }, [searchParams]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [status, setStatus] = useState("sem_dados");
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [medLoading, setMedLoading] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    birthDate: "",
    gender: "",
    bed: "",
    diagnosis: "",
    allergies: "",
    emergencyContact: "",
    emergencyPhone: "",
    admissionDate: "",
  });
  const [careSuggestions, setCareSuggestions] = useState<string[] | null>(null);
  const [careLoading, setCareLoading] = useState(false);
  const [careError, setCareError] = useState("");
  const [report, setReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportDiagnosis, setReportDiagnosis] = useState("");
  const [reportCopied, setReportCopied] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedReport, setEditedReport] = useState("");
  const [reportMicActive, setReportMicActive] = useState(false);

  const loadPatient = useCallback(async () => {
    try {
      const data = await getPatientById(id as string);
      setPatient(data);
      if (data?.diagnosis) {
        setReportDiagnosis((prev) => prev || data.diagnosis || "");
      }
      const [vitals, meds, patientNotes, statusValue] = await Promise.all([
        listVitalSigns({ patientId: id as string }),
        listMedications({ patientId: id as string }),
        listNursingNotes(id as string),
        getPatientStatus(id as string),
      ]);
      setVitalSigns(vitals as any);
      setMedications(meds as any);
      setNotes(patientNotes as any);
      setStatus(statusValue);
    } catch (e) {
      console.error("Erro ao carregar paciente:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
  }, [loadPatient]);

  const calcAge = (birthDate: string) => {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  };

  const togglePriority = async () => {
    if (!patient) return;
    await setPatientPriority(id as string, !patient.priority);
    setPatient({ ...patient, priority: !patient.priority });
  };

  const setCondition = async (condition: string) => {
    if (!patient) return;
    await updatePatient(id as string, { condition });
    setPatient({ ...patient, condition });
    loadPatient();
  };

  const dischargePatient = async () => {
    await updatePatient(id as string, { active: false, dischargeDate: new Date().toISOString().split("T")[0] });
    loadPatient();
    setShowDischargeConfirm(false);
  };

  const deletePatient = async () => {
    if (!confirm("Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.")) return;
    await deletePatientDb(id as string);
    router.push("/patients");
  };

  const enterEditMode = () => {
    if (!patient) return;
    setEditForm({
      name: patient.name,
      birthDate: patient.birthDate,
      gender: patient.gender,
      bed: patient.bed,
      diagnosis: patient.diagnosis,
      allergies: patient.allergies,
      emergencyContact: patient.emergencyContact,
      emergencyPhone: patient.emergencyPhone,
      admissionDate: patient.admissionDate,
    });
    setEditing(true);
  };

  const savePatient = async () => {
    if (!patient) return;
    await updatePatient(id as string, editForm);
    setEditing(false);
    loadPatient();
  };

  // Vital Signs
  const [showVitalForm, setShowVitalForm] = useState(false);
  const [vitalType, setVitalType] = useState<VitalSignType>("TEMPERATURA");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalSystolic, setVitalSystolic] = useState("");
  const [vitalDiastolic, setVitalDiastolic] = useState("");
  const [vitalDate, setVitalDate] = useState(new Date().toISOString().slice(0, 16));
  const [vitalError, setVitalError] = useState("");

  const handleQuickAddVital = (type: VitalSignType) => {
    setVitalType(type);
    setVitalValue("");
    setVitalSystolic("");
    setVitalDiastolic("");
    setVitalDate(new Date().toISOString().slice(0, 16));
    setVitalError("");
    setShowVitalForm(true);

    setTimeout(() => {
      const formEl = document.getElementById("patient-vital-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      const firstInput = document.getElementById("patient-vital-first-input") as HTMLInputElement | null;
      if (firstInput) {
        firstInput.focus();
      }
    }, 60);
  };

  const handleAddVital = async (e: React.FormEvent) => {
    e.preventDefault();
    setVitalError("");

    if (vitalType === "PRESSAO_ARTERIAL") {
      if (!vitalSystolic || !vitalDiastolic) {
        setVitalError("Preencha pressão sistólica e diastólica");
        return;
      }
    } else if (!vitalValue) {
      setVitalError("Preencha o valor");
      return;
    }

    const vt = VITAL_SIGN_TYPES.find((v) => v.value === vitalType);
    const val =
      vitalType === "PRESSAO_ARTERIAL"
        ? (parseInt(vitalSystolic) + parseInt(vitalDiastolic)) / 2
        : parseFloat(vitalValue);

    await createVitalSign({
      patientId: id as string,
      type: vitalType,
      value: val,
      systolic: vitalType === "PRESSAO_ARTERIAL" ? parseInt(vitalSystolic) : null,
      diastolic: vitalType === "PRESSAO_ARTERIAL" ? parseInt(vitalDiastolic) : null,
      unit: vt?.unit || "",
      recordedAt: vitalDate,
    });

    setVitalValue("");
    setVitalSystolic("");
    setVitalDiastolic("");
    setShowVitalForm(false);
    loadPatient();
  };

  // Voz / Microfone para sinais vitais
  const [isVitalVoiceActive, setIsVitalVoiceActive] = useState(false);
  const [activeVitalFieldVoice, setActiveVitalFieldVoice] = useState<"value" | "pressure" | null>(null);
  const [vitalVoiceSuccessMessage, setVitalVoiceSuccessMessage] = useState<string | null>(null);

  const fullVitalSpeech = useSpeechRecognition({ continuous: true, interimResults: true });
  const fieldVitalSpeech = useSpeechRecognition({ continuous: false, interimResults: true });

  const liveVitalTranscript = (fullVitalSpeech.transcript + " " + fullVitalSpeech.interimTranscript).trim();
  const liveVitalParsed = parseVitalSignsVoiceInput(liveVitalTranscript, vitalType);

  const toggleFullVitalVoice = () => {
    if (isVitalVoiceActive) {
      fullVitalSpeech.stopListening();
      setIsVitalVoiceActive(false);
    } else {
      setIsVitalVoiceActive(true);
      fullVitalSpeech.resetTranscript();
      fullVitalSpeech.startListening();
    }
  };

  const handleApplyVitalVoice = () => {
    fullVitalSpeech.stopListening();
    if (liveVitalParsed.detectedVitals.length > 0) {
      const primary = liveVitalParsed.detectedVitals[0];
      setVitalType(primary.type);
      if (primary.type === "PRESSAO_ARTERIAL" && primary.systolic != null && primary.diastolic != null) {
        setVitalSystolic(String(primary.systolic));
        setVitalDiastolic(String(primary.diastolic));
        setVitalValue("");
      } else if (primary.value != null) {
        setVitalValue(String(primary.value));
        setVitalSystolic("");
        setVitalDiastolic("");
      }
      setShowVitalForm(true);
      setVitalVoiceSuccessMessage(
        primary.type === "PRESSAO_ARTERIAL"
          ? `Pressão Arterial ${primary.systolic}/${primary.diastolic} mmHg preenchida!`
          : `${primary.label} ${primary.value} ${primary.unit} preenchido!`
      );
      setTimeout(() => setVitalVoiceSuccessMessage(null), 4000);
    }
    setIsVitalVoiceActive(false);
  };

  const handleApplySpecificVital = (item: {
    type: VitalSignType;
    label: string;
    value?: number;
    systolic?: number;
    diastolic?: number;
    unit: string;
  }) => {
    fullVitalSpeech.stopListening();
    setVitalType(item.type);
    if (item.type === "PRESSAO_ARTERIAL" && item.systolic != null && item.diastolic != null) {
      setVitalSystolic(String(item.systolic));
      setVitalDiastolic(String(item.diastolic));
      setVitalValue("");
    } else if (item.value != null) {
      setVitalValue(String(item.value));
      setVitalSystolic("");
      setVitalDiastolic("");
    }
    setShowVitalForm(true);
    setIsVitalVoiceActive(false);
    setVitalVoiceSuccessMessage(
      item.type === "PRESSAO_ARTERIAL"
        ? `Pressão Arterial ${item.systolic}/${item.diastolic} mmHg preenchida!`
        : `${item.label} ${item.value} ${item.unit} preenchido!`
    );
    setTimeout(() => setVitalVoiceSuccessMessage(null), 4000);
  };

  const toggleVitalFieldVoice = (field: "value" | "pressure") => {
    if (activeVitalFieldVoice === field) {
      fieldVitalSpeech.stopListening();
      setActiveVitalFieldVoice(null);
      return;
    }
    setActiveVitalFieldVoice(field);
    fieldVitalSpeech.resetTranscript();
    fieldVitalSpeech.startListening({
      onFinalText: (spokenText) => {
        const text = spokenText.trim();
        if (field === "pressure") {
          const parsed = parseSingleVitalValue("PRESSAO_ARTERIAL", text);
          if (parsed && parsed.systolic && parsed.diastolic) {
            setVitalSystolic(String(parsed.systolic));
            setVitalDiastolic(String(parsed.diastolic));
            setVitalVoiceSuccessMessage(`PA ${parsed.systolic}/${parsed.diastolic} mmHg preenchida!`);
            setTimeout(() => setVitalVoiceSuccessMessage(null), 3000);
          }
        } else if (field === "value") {
          const parsed = parseSingleVitalValue(vitalType, text);
          if (parsed && parsed.value !== undefined) {
            setVitalValue(String(parsed.value));
            const vt = VITAL_SIGN_TYPES.find((v) => v.value === vitalType);
            setVitalVoiceSuccessMessage(`${vt?.label || "Valor"} ${parsed.value} ${vt?.unit || ""} preenchido!`);
            setTimeout(() => setVitalVoiceSuccessMessage(null), 3000);
          }
        }
        setActiveVitalFieldVoice(null);
      },
    });
  };

  useEffect(() => {
    if (tab !== "sinais") {
      fullVitalSpeech.stopListening();
      fieldVitalSpeech.stopListening();
      setIsVitalVoiceActive(false);
      setActiveVitalFieldVoice(null);
    }
  }, [tab]);

  // Medications
  const [showMedForm, setShowMedForm] = useState(false);
  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medSchedule, setMedSchedule] = useState("");
  const [medFreq, setMedFreq] = useState("");
  const [medObs, setMedObs] = useState("");

  // Bloqueio de Medicação por Alergia / Quadro Clínico
  const [allergyBlockModal, setAllergyBlockModal] = useState<{
    open: boolean;
    medName: string;
    matchedTerm: string;
    rawAllergy: string;
    patientName: string;
    source: "allergies" | "diagnosis";
  } | null>(null);

  const medAllergyConflict = checkMedicationAllergyConflict(medName, patient);

  // Voz / Microfone para cadastro de medicação
  const [activeMedVoiceField, setActiveMedVoiceField] = useState<"name" | "dose" | "schedule" | "observation" | null>(null);
  const [isFullMedVoiceActive, setIsFullMedVoiceActive] = useState(false);
  const [medVoiceSuccessCount, setMedVoiceSuccessCount] = useState<number | null>(null);

  const fullMedSpeech = useSpeechRecognition({ continuous: true, interimResults: true });
  const fieldMedSpeech = useSpeechRecognition({ continuous: false, interimResults: true });

  const liveMedTranscript = (fullMedSpeech.transcript + " " + fullMedSpeech.interimTranscript).trim();
  const liveMedParsed = parseMedicationVoiceInput(liveMedTranscript);

  const handleApplyFullMedVoice = () => {
    fullMedSpeech.stopListening();
    let count = 0;
    if (liveMedParsed.name) {
      setMedName(liveMedParsed.name);
      count++;
    }
    if (liveMedParsed.dose) {
      setMedDose(liveMedParsed.dose);
      count++;
    }
    if (liveMedParsed.schedule) {
      setMedSchedule(liveMedParsed.schedule);
      count++;
    }
    if (liveMedParsed.frequency !== undefined && liveMedParsed.frequency !== null) {
      setMedFreq(liveMedParsed.frequency);
      count++;
    }
    if (liveMedParsed.observation) {
      setMedObs(liveMedParsed.observation);
      count++;
    }
    setIsFullMedVoiceActive(false);
    setMedVoiceSuccessCount(count);
    setTimeout(() => setMedVoiceSuccessCount(null), 4000);
  };

  const toggleMedFieldVoice = (field: "name" | "dose" | "schedule" | "observation") => {
    if (activeMedVoiceField === field) {
      fieldMedSpeech.stopListening();
      setActiveMedVoiceField(null);
      return;
    }
    setActiveMedVoiceField(field);
    fieldMedSpeech.resetTranscript();
    fieldMedSpeech.startListening({
      onFinalText: (spokenText) => {
        const text = spokenText.trim();
        if (field === "name") {
          setMedName(normalizeSpokenMedication(text));
        } else if (field === "dose") {
          setMedDose(normalizeSpokenMedication(text));
        } else if (field === "schedule") {
          const parsedTime = parseSpokenTime(text);
          if (parsedTime) setMedSchedule(parsedTime);
        } else if (field === "observation") {
          setMedObs(normalizeSpokenMedication(text));
        }
        setActiveMedVoiceField(null);
      },
    });
  };

  useEffect(() => {
    if (!showMedForm) {
      fullMedSpeech.stopListening();
      fieldMedSpeech.stopListening();
      setIsFullMedVoiceActive(false);
      setActiveMedVoiceField(null);
    }
  }, [showMedForm]);

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName || !medDose || !medSchedule) return;

    // Verificação de Segurança Clínica: Alergia no Quadro Clínico
    const conflict = checkMedicationAllergyConflict(medName, patient);
    if (conflict.hasConflict) {
      setAllergyBlockModal({
        open: true,
        medName: medName.trim(),
        matchedTerm: conflict.matchedTerm || medName.trim(),
        rawAllergy: conflict.rawAllergyText || patient?.allergies || "Alergia registrada",
        patientName: patient?.name || "Paciente",
        source: conflict.source || "allergies",
      });
      return;
    }

    setMedLoading(true);
    const newMed = await createMedication({
      patientId: id as string,
      name: medName,
      dose: medDose,
      schedule: medSchedule,
      frequencyHours: medFreq ? parseInt(medFreq) : null,
      observation: medObs,
    });
    // Solicita permissão e agenda a notificação para a medicação
    await requestNotificationPermission();
    if (patient) {
      await scheduleMedicationNotification(newMed, {
        id: patient.id,
        name: patient.name,
        bed: patient.bed,
        active: patient.active,
      });
    }
    setMedName("");
    setMedDose("");
    setMedSchedule("");
    setMedFreq("");
    setMedObs("");
    setShowMedForm(false);
    setMedLoading(false);
    loadPatient();
  };

  const toggleAdministered = async (med: Medication) => {
    const now = new Date();
    const administered = !med.administered;
    const updated = await updateMedication(med.id, {
      administered,
      administeredAt: administered ? now.toISOString() : null,
    });
    if (administered) {
      // Se foi administrada, cancela a notificação da dose pendente
      await cancelMedicationNotification(med.id);
    } else if (patient) {
      // Se desmarcou, reagenda
      await scheduleMedicationNotification(updated, {
        id: patient.id,
        name: patient.name,
        bed: patient.bed,
        active: patient.active,
      });
    }
    loadPatient();
  };

  const deleteMedication = async (medId: string) => {
    if (!confirm("Excluir esta medicação?")) return;
    await cancelMedicationNotification(medId);
    await deleteMedicationDb(medId);
    loadPatient();
  };

  const getMedStatus = (schedule: string, administered: boolean) => {
    if (administered)
      return {
        label: "Administrado",
        color: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40",
      };
    const now = new Date();
    const [h, m] = schedule.split(":").map(Number);
    const sched = new Date();
    sched.setHours(h, m, 0, 0);
    const diff = (now.getTime() - sched.getTime()) / 60000;
    if (diff < 0)
      return {
        label: "Pendente",
        color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60",
      };
    if (diff > 30)
      return {
        label: "Atrasado",
        color: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40 animate-pulse",
      };
    return {
      label: "No horário",
      color: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40",
    };
  };

  // Nursing Notes
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setNoteLoading(true);
    await createNursingNote({ patientId: id as string, content: noteContent });
    setNoteContent("");
    setNoteLoading(false);
    loadPatient();
  };

  const handleEditNote = async (noteId: string) => {
    if (!editNoteContent.trim()) return;
    await updateNursingNote(noteId, editNoteContent);
    setEditingNote(null);
    setEditNoteContent("");
    loadPatient();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Excluir esta evolução?")) return;
    await deleteNursingNote(noteId);
    loadPatient();
  };

  const generateCare = async () => {
    if (!patient || !patient.diagnosis) return;
    setCareLoading(true);
    setCareError("");
    setCareSuggestions(null);
    try {
      const suggestions = await getCareSuggestions({
        diagnosis: patient.diagnosis,
        patientName: patient.name,
        gender: patient.gender,
        age: calcAge(patient.birthDate),
      });
      setCareSuggestions(suggestions);
    } catch (e: any) {
      setCareError(e.message || "Erro ao conectar com o servidor de IA");
    }
    setCareLoading(false);
  };

  const generateReport = async () => {
    const targetDiag = (reportDiagnosis || patient?.diagnosis || "").trim();
    if (!targetDiag) return;
    setReportLoading(true);
    setReportError("");
    setReport(null);
    setReportCopied(false);
    try {
      const vitals = vitalSigns.slice(-6).map((v) => {
        const vt = VITAL_SIGN_TYPES.find((t) => t.value === v.type);
        const value =
          v.type === "PRESSAO_ARTERIAL" && v.systolic != null
            ? `${v.systolic}/${v.diastolic} mmHg`
            : `${v.value} ${vt?.unit || ""}`;
        return { label: vt?.label || v.type, value };
      });
      const meds = medications.map((m) => ({ name: m.name, dose: m.dose, schedule: m.schedule }));
      const reportText = await getNursingReport({
        diagnosis: targetDiag,
        patientName: patient?.name,
        gender: patient?.gender,
        age: patient?.birthDate ? calcAge(patient.birthDate) : undefined,
        vitalSigns: vitals,
        medications: meds,
      });
      setReport(reportText);
      setEditedReport(reportText);
      setIsEditingReport(false);
      try {
        sessionStorage.setItem(`ai_report_${id}`, reportText);
      } catch {}
    } catch (e: any) {
      setReportError(e.message || "Erro ao conectar com o servidor de IA");
    }
    setReportLoading(false);
  };

  const copyReport = async () => {
    const textToCopy = isEditingReport ? editedReport : report;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const saveReportAsNote = async () => {
    const contentToSave = (isEditingReport ? editedReport : report || "").trim();
    if (!contentToSave) return;
    await createNursingNote({ patientId: id as string, content: contentToSave });
    setReport(contentToSave);
    setEditedReport(contentToSave);
    setIsEditingReport(false);
    try {
      sessionStorage.setItem(`ai_report_${id}`, contentToSave);
    } catch {}
    loadPatient();
    setTab("evolucoes");
  };

  const toggleReportMic = () => {
    if (reportMicActive) {
      fieldMedSpeech.stopListening();
      setReportMicActive(false);
      return;
    }
    setReportMicActive(true);
    fieldMedSpeech.resetTranscript();
    fieldMedSpeech.startListening({
      onFinalText: (spokenText) => {
        const text = spokenText.trim();
        if (text) {
          setEditedReport((curr) => (curr ? `${curr}\n\n${text}` : text));
        }
        setReportMicActive(false);
      },
    });
  };

  const sendPatientViaWhatsApp = async () => {
    if (!patient) return;
    try {
      const settings = await getSettings();
      const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados;

      let reportText = report || "";
      if (!reportText) {
        try {
          reportText = sessionStorage.getItem(`ai_report_${id}`) || "";
        } catch {}
      }

      // Sinais vitais mais recentes por tipo
      const latestVitalsMap = new Map<string, VitalSign>();
      vitalSigns.forEach((v) => {
        if (!latestVitalsMap.has(v.type)) {
          latestVitalsMap.set(v.type, v);
        }
      });

      let vitalsText = "";
      if (latestVitalsMap.size > 0) {
        const lines = Array.from(latestVitalsMap.values()).map((v) => {
          const vt = VITAL_SIGN_TYPES.find((t) => t.value === v.type);
          const label = vt ? vt.label : v.type;
          const val =
            v.type === "PRESSAO_ARTERIAL" && v.systolic && v.diastolic
              ? `${v.systolic}/${v.diastolic} ${v.unit}`
              : `${v.value} ${v.unit}`;
          return `• ${label}: *${val}*`;
        });
        vitalsText = `\n\n📊 *SINAIS VITAIS RECENTES:*\n${lines.join("\n")}`;
      }

      // Medicações
      let medsText = "";
      if (medications.length > 0) {
        const lines = medications.map((m) => {
          const st = m.administered ? "✓ Administrado" : "⏳ Pendente";
          return `• ${m.name} ${m.dose || ""}${m.schedule ? ` (${m.schedule})` : ""} — ${st}`;
        });
        medsText = `\n\n💊 *MEDICAÇÕES / PRESCRIÇÃO:*\n${lines.join("\n")}`;
      }

      // Última anotação de enfermagem
      let noteText = "";
      if (notes.length > 0) {
        const lastNote = notes[0];
        noteText = `\n\n📝 *ÚLTIMA EVOLUÇÃO DE ENFERMAGEM:*\n"${lastNote.content}"\n_(${new Date(lastNote.createdAt).toLocaleString("pt-BR")})_`;
      }

      // Relatório de IA se existir
      let aiReportText = "";
      if (reportText) {
        aiReportText = `\n\n🤖 *RELATÓRIO CLÍNICO (IA):*\n${reportText}`;
      }

      // Contato de emergência
      let emergencyText = "";
      if (patient.emergencyContact || patient.emergencyPhone) {
        emergencyText = `\n📞 *Contato de Emergência:* ${patient.emergencyContact || ""}${patient.emergencyPhone ? ` (${patient.emergencyPhone})` : ""}`;
      }

      const hospitalHeader = settings.hospitalName ? `🏥 *${settings.hospitalName.toUpperCase()}*\n` : "";

      const fullMessage =
        `${hospitalHeader}📋 *FICHA DO PACIENTE — ENFERMAGEM*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Nome:* ${patient.name}\n` +
        (patient.bed ? `🛏️ *Leito:* ${patient.bed}\n` : "") +
        `🎂 *Idade:* ${calcAge(patient.birthDate)}${patient.birthDate ? ` (${new Date(patient.birthDate).toLocaleDateString("pt-BR")})` : ""}\n` +
        `⚧ *Sexo:* ${patient.gender || "N/I"}\n` +
        `📅 *Admissão:* ${new Date(patient.admissionDate).toLocaleDateString("pt-BR")}\n` +
        (patient.dischargeDate ? `🚪 *Alta:* ${new Date(patient.dischargeDate).toLocaleDateString("pt-BR")}\n` : "") +
        `🩺 *Diagnóstico:* ${patient.diagnosis || "Não informado"}\n` +
        `⚠️ *Alergias:* ${patient.allergies ? patient.allergies.toUpperCase() : "Nenhuma relatada"}\n` +
        `🚨 *Status Clínico:* *${cfg.label.toUpperCase()}*` +
        emergencyText +
        vitalsText +
        medsText +
        noteText +
        aiReportText +
        `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Ficha emitida em ${new Date().toLocaleString("pt-BR")}_`;

      let rawPhone = (patient.emergencyPhone || settings.defaultWhatsapp || "").replace(/\D/g, "");
      if (rawPhone && (rawPhone.length === 10 || rawPhone.length === 11) && !rawPhone.startsWith("55")) {
        rawPhone = `55${rawPhone}`;
      }

      const encodedText = encodeURIComponent(fullMessage);
      const whatsappUrl = rawPhone
        ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodedText}`
        : `https://api.whatsapp.com/send?text=${encodedText}`;

      // No Capacitor/Android, navegar para a URL externa dispara o Bridge.launchIntent para abrir o WhatsApp
      window.location.href = whatsappUrl;
    } catch (err) {
      console.error("Erro ao enviar por WhatsApp:", err);
    }
  };

  const [sharing, setSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const handleSharePatient = async () => {
    if (!id) return;
    setSharing(true);
    setShareFeedback(null);
    try {
      const bundle = await exportPatientBundle(id as string);
      await sharePatientBundle(bundle);
      setShareFeedback("Arquivo gerado com sucesso!");
      setTimeout(() => setShareFeedback(null), 3500);
    } catch (err: any) {
      console.error("Erro ao compartilhar paciente:", err);
      alert(err?.message || "Não foi possível compartilhar os dados do paciente.");
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse pb-12">
        <div className="h-44 rounded-3xl skeleton-shimmer" />
        <div className="h-12 rounded-2xl skeleton-shimmer" />
        <div className="h-64 rounded-3xl skeleton-shimmer" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-20 glass-panel rounded-3xl">
        <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Paciente não encontrado</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">O paciente pode ter sido removido ou não existe.</p>
        <Link href="/patients" className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline">
          Voltar para a lista de pacientes
        </Link>
      </div>
    );
  }

  const effectiveStatus = patient.condition === "CRITICO" ? "critico" : patient.condition === "ATENCAO" ? "atencao" : status;
  const cfg = STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.sem_dados;
  const pendingMedsCount = medications.filter((m) => !m.administered).length;

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: "dados", label: "Dados Clínicos", icon: User },
    { key: "sinais", label: "Sinais Vitais", icon: Activity, count: vitalSigns.length },
    { key: "medicacoes", label: "Medicações", icon: Pill, count: pendingMedsCount },
    { key: "evolucoes", label: "Evoluções", icon: FileText, count: notes.length },
    { key: "cuidados", label: "Cuidados IA", icon: Bot },
    { key: "relatorio", label: "Relatório IA", icon: ClipboardList },
  ];

  // Latest vital sign per type for quick summary chips
  const latestVitalsMap = new Map<string, VitalSign>();
  vitalSigns.forEach((v) => {
    if (!latestVitalsMap.has(v.type)) {
      latestVitalsMap.set(v.type, v);
    }
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Top Bar Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/patients")}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 transition-all duration-200"
          aria-label="Voltar para Pacientes"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Pacientes / <span className="text-slate-900 dark:text-white font-medium">{patient.name}</span>
        </span>
      </div>

      {/* Patient Hero Header Card */}
      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            {/* Bed & Photo / Avatar */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                {patient.photo ? (
                  <img src={patient.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-xl font-bold font-mono">
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {effectiveStatus === "critico" && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-600 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Prominent Bed Badge */}
                <span className="px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-mono font-bold text-xs flex items-center gap-1 shrink-0">
                  <Bed size={13} /> Leito {patient.bed || "—"}
                </span>

                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                  {patient.name}
                </h1>

                <button
                  onClick={togglePriority}
                  className={`p-1 rounded-lg transition-colors ${
                    patient.priority ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40" : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                  }`}
                  title={patient.priority ? "Remover prioridade" : "Marcar prioritário"}
                >
                  <Star size={18} className={patient.priority ? "fill-amber-500" : ""} />
                </button>
              </div>

              {/* Patient Demographics */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>{calcAge(patient.birthDate)}</span>
                <span>·</span>
                <span>{patient.gender}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} /> Admissão: {new Date(patient.admissionDate).toLocaleDateString("pt-BR")}
                </span>
                {!patient.active && patient.dischargeDate && (
                  <span className="text-amber-700 dark:text-amber-300 font-semibold font-sans">
                    (Alta: {new Date(patient.dischargeDate).toLocaleDateString("pt-BR")})
                  </span>
                )}
              </div>

              {/* Patient Allergies Alert Strip (Crucial for clinical safety) */}
              {patient.allergies && patient.allergies !== "Nenhuma relatada" && patient.allergies.trim() !== "" && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800 text-xs font-semibold">
                  <ShieldAlert size={14} className="text-rose-600 shrink-0" />
                  <span>Alergias: {patient.allergies}</span>
                </div>
              )}

              {/* Clinical Condition Selector */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${effectiveStatus === "critico" ? "animate-pulse" : ""}`} />
                  {cfg.label}
                </span>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-semibold text-slate-500 px-1.5">Risco:</span>
                  {[
                    { value: "", label: "Normal", activeCls: "bg-emerald-600 text-white" },
                    { value: "ATENCAO", label: "Atenção", activeCls: "bg-amber-600 text-white" },
                    { value: "CRITICO", label: "Crítico", activeCls: "bg-rose-600 text-white" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setCondition(opt.value)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                        (patient.condition || "") === opt.value
                          ? opt.activeCls
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Header */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
            <button
              onClick={sendPatientViaWhatsApp}
              className="flex items-center gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
              title="Enviar Ficha do Paciente por WhatsApp"
            >
              <Send size={15} /> WhatsApp
            </button>
            <button
              onClick={() => router.push(`/patient/print?id=${id}`)}
              className="flex items-center gap-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
            >
              <Printer size={15} /> Imprimir Ficha
            </button>
            <button
              onClick={handleSharePatient}
              disabled={sharing}
              className="flex items-center gap-2 text-xs font-semibold bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-3.5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Compartilhar dados completos do paciente (arquivo JSON offline)"
            >
              {sharing ? <RefreshCw size={15} className="animate-spin" /> : <Share2 size={15} />}
              Compartilhar paciente
            </button>
            {patient.active && (
              <button
                onClick={() => setShowDischargeConfirm(true)}
                className="flex items-center gap-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 px-3.5 py-2.5 rounded-xl hover:bg-amber-100 transition-all"
              >
                <LogOut size={15} /> Dar Alta
              </button>
            )}
            <button
              onClick={deletePatient}
              className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 transition-colors"
              title="Excluir paciente"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Discharge Confirmation Modal */}
      {showDischargeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-md mx-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
              <LogOut size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirmar Alta do Paciente</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Deseja registrar alta para <strong className="text-slate-800 dark:text-slate-200">{patient.name}</strong>? Os registros ficarão salvos por 30 dias na aba de altas antes da limpeza automática.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDischargeConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={dischargePatient}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs"
              >
                Confirmar Alta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Tabs Bar (Scrollable on mobile with high contrast) */}
      <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1 overflow-x-auto scrollbar-none no-print border border-slate-200 dark:border-slate-700 min-h-[46px] items-center">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[38px] ${
                active
                  ? "bg-white dark:bg-[#111927] text-teal-800 dark:text-teal-200 shadow-xs border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <t.icon size={15} strokeWidth={active ? 2.5 : 2} className={active ? "text-teal-700 dark:text-teal-400" : ""} />
              <span>{t.label}</span>
              {typeof t.count === "number" && t.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    active
                      ? "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Dados */}
      {tab === "dados" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Ficha de Dados do Paciente</h3>
            {!editing && (
              <button
                onClick={enterEditMode}
                className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98]"
              >
                <Edit3 size={15} /> Editar Ficha
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
                    Identificação Pessoal
                  </h4>
                  <EditField label="Nome Completo" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
                  <EditField label="Data de Nascimento" type="date" value={editForm.birthDate} onChange={(v) => setEditForm({ ...editForm, birthDate: v })} />
                  <EditField label="Sexo" value={editForm.gender} onChange={(v) => setEditForm({ ...editForm, gender: v })} />
                  <EditField label="Leito / Quarto" value={editForm.bed} onChange={(v) => setEditForm({ ...editForm, bed: v })} />
                </div>
                <div className="glass-panel rounded-2xl p-6 space-y-4">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
                    Histórico
                  </h4>
                  <EditField label="Diagnóstico Principal" value={editForm.diagnosis} onChange={(v) => setEditForm({ ...editForm, diagnosis: v })} />
                  <EditField label="Alergias" value={editForm.allergies} onChange={(v) => setEditForm({ ...editForm, allergies: v })} />
                  <EditField label="Data de Internação" type="date" value={editForm.admissionDate} onChange={(v) => setEditForm({ ...editForm, admissionDate: v })} />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={savePatient}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  <Check size={16} /> Salvar Alterações
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="glass-panel rounded-2xl p-6 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
                  Dados do Paciente
                </h4>
                <InfoRow label="Nome" value={patient.name} />
                <InfoRow label="Nascimento" value={new Date(patient.birthDate).toLocaleDateString("pt-BR")} />
                <InfoRow label="Idade" value={calcAge(patient.birthDate)} />
                <InfoRow label="Sexo" value={patient.gender} />
                <InfoRow label="Leito" value={patient.bed || "—"} />
              </div>
              <div className="glass-panel rounded-2xl p-6 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm pb-2 border-b border-slate-100 dark:border-slate-800">
                  Quadro Clínico
                </h4>
                <InfoRow label="Diagnóstico" value={patient.diagnosis || "Não informado"} />
                <InfoRow label="Alergias" value={patient.allergies || "Nenhuma relatada"} />
                <InfoRow label="Internação" value={new Date(patient.admissionDate).toLocaleDateString("pt-BR")} />
                {patient.dischargeDate && (
                  <InfoRow label="Alta" value={new Date(patient.dischargeDate).toLocaleDateString("pt-BR")} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Sinais Vitais */}
      {tab === "sinais" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Painel de Sinais Vitais</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Toque em qualquer quadro abaixo ou dite por voz para aferir
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={toggleFullVitalVoice}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                  isVitalVoiceActive
                    ? "bg-rose-500 text-white animate-pulse"
                    : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                }`}
                title="Ditar sinais vitais por voz"
              >
                <Mic size={15} className={isVitalVoiceActive ? "animate-bounce" : ""} />
                {isVitalVoiceActive ? "Ouvindo Sinais..." : "Ditar por Voz"}
              </button>

              <button
                onClick={() => setShowVitalForm(!showVitalForm)}
                className="flex items-center gap-1.5 bg-teal-700 hover:bg-teal-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs min-h-[40px]"
              >
                <Plus size={15} /> Aferir Sinal Vital
              </button>
            </div>
          </div>

          {/* Banner de Sucesso ao Aplicar Voz */}
          {vitalVoiceSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>{vitalVoiceSuccessMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setVitalVoiceSuccessMessage(null)}
                className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Painel de Escuta de Sinais Vitais por Voz */}
          {isVitalVoiceActive && (
            <div className="p-4 rounded-2xl bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-3 animate-fade-in shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>{fullVitalSpeech.isListening ? "Ouvindo sinais vitais..." : "Microfone pausado"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fullVitalSpeech.stopListening();
                    setIsVitalVoiceActive(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Fechar
                </button>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                Exemplos: &quot;Temperatura 36 e meio&quot;, &quot;Pressão 12 por 8&quot;, &quot;Frequência cardíaca 78 bpm&quot;, &quot;Saturação 98%&quot;, &quot;Sem dor&quot;, &quot;Glicemia 110&quot;
              </p>

              {liveVitalTranscript && (
                <div className="p-2.5 bg-white dark:bg-slate-900/80 rounded-xl border border-teal-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono">
                  &quot;{liveVitalTranscript}&quot;
                </div>
              )}

              {liveVitalParsed.detectedVitals.length > 0 ? (
                <div className="space-y-2 pt-1 border-t border-teal-200/60 dark:border-teal-900/60">
                  <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 block">
                    Parâmetros detectados na fala:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {liveVitalParsed.detectedVitals.map((item, idx) => {
                      const displayVal =
                        item.type === "PRESSAO_ARTERIAL"
                          ? `${item.systolic}/${item.diastolic} mmHg`
                          : `${item.value} ${item.unit}`;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleApplySpecificVital(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                        >
                          <Check size={13} />
                          <span>{item.label}: <strong>{displayVal}</strong></span>
                          <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded ml-1">Aplicar</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : liveVitalTranscript ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  Falando... Diga o nome do sinal e o valor (ex: &quot;Pressão 12 por 8&quot; ou &quot;Temperatura 37 e meio&quot;)
                </p>
              ) : null}
            </div>
          )}

          {/* Quick parameter cards for the patient (Multiparameter Monitor Style) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {VITAL_SIGN_TYPES.map((vt) => {
              const latest = latestVitalsMap.get(vt.value);
              let valDisplay = "—";
              let statusLabel = "Sem dados";
              let statusCls = "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
              let borderCard = "border-slate-200 dark:border-slate-800";
              let dotColor = "bg-slate-400";

              if (latest) {
                let s = "normal";
                if (vt.value === "PRESSAO_ARTERIAL" && latest.systolic != null) {
                  valDisplay = `${latest.systolic}/${latest.diastolic}`;
                  s = getBpStatus(latest.systolic, latest.diastolic ?? 0);
                } else {
                  valDisplay = `${latest.value}`;
                  s = getValueStatus(vt.value, latest.value);
                }

                if (s === "critico") {
                  statusLabel = "Crítico";
                  statusCls = "bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200 border-rose-200 dark:border-rose-800";
                  borderCard = "border-rose-300 dark:border-rose-900 bg-rose-50/15 dark:bg-rose-950/10";
                  dotColor = "bg-rose-600 animate-pulse";
                } else if (s === "atencao") {
                  statusLabel = "Atenção";
                  statusCls = "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border-amber-200 dark:border-amber-800";
                  borderCard = "border-amber-300 dark:border-amber-900/80 bg-amber-50/15 dark:bg-amber-950/10";
                  dotColor = "bg-amber-500";
                } else {
                  statusLabel = "Normal";
                  statusCls = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800";
                  borderCard = "border-slate-200 dark:border-slate-800";
                  dotColor = "bg-emerald-600";
                }
              }

              const isCurrentSelected = showVitalForm && vitalType === vt.value;

              return (
                <div
                  key={vt.value}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleQuickAddVital(vt.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleQuickAddVital(vt.value);
                    }
                  }}
                  title={`Toque para aferir ${vt.label}`}
                  aria-label={`Aferir ${vt.label}`}
                  className={`border rounded-xl p-3 flex flex-col justify-between cursor-pointer active:scale-[0.97] hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-xs transition-all select-none group/vitalcard ${
                    isCurrentSelected
                      ? "ring-2 ring-teal-500 border-teal-500 bg-teal-50/40 dark:bg-teal-950/30 shadow-xs"
                      : `${borderCard} bg-white dark:bg-[#111927]`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 group-hover/vitalcard:text-teal-700 dark:group-hover/vitalcard:text-teal-300 transition-colors truncate">
                        {vt.label}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Plus size={12} className="text-teal-600 dark:text-teal-400 opacity-60 sm:opacity-0 group-hover/vitalcard:opacity-100 transition-opacity" />
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      </div>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <p className="text-lg font-bold font-mono text-slate-900 dark:text-white tabular-nums">{valDisplay}</p>
                      {latest && <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{vt.unit}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border text-center ${statusCls}`}>
                      {statusLabel}
                    </span>
                    {isCurrentSelected ? (
                      <span className="text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/60 px-1.5 py-0.5 rounded">
                        Em registro
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 opacity-90 sm:opacity-0 group-hover/vitalcard:opacity-100 transition-opacity">
                        + Toque
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form for recording vitals */}
          {showVitalForm && (
            <form
              id="patient-vital-form"
              onSubmit={handleAddVital}
              className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4 animate-fade-in border-2 border-teal-500/30 dark:border-teal-500/20"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    Registrar Aferição de {VITAL_SIGN_TYPES.find((v) => v.value === vitalType)?.label || "Sinal Vital"}
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFullVitalVoice}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                      isVitalVoiceActive
                        ? "bg-rose-500 text-white animate-pulse"
                        : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                    }`}
                    title="Ditar sinal vital por voz"
                  >
                    <Mic size={14} className={isVitalVoiceActive ? "animate-bounce" : ""} />
                    {isVitalVoiceActive ? "Ouvindo Voz..." : "Ditar por Voz"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVitalForm(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tipo de Sinal Vital</label>
                  <select
                    value={vitalType}
                    onChange={(e) => setVitalType(e.target.value as VitalSignType)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white"
                  >
                    {VITAL_SIGN_TYPES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label} ({v.unit})</option>
                    ))}
                  </select>
                </div>

                {vitalType === "PRESSAO_ARTERIAL" ? (
                  <>
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Pressão Arterial (mmHg)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleVitalFieldVoice("pressure")}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                            activeVitalFieldVoice === "pressure"
                              ? "bg-rose-500 text-white animate-pulse"
                              : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-200 dark:border-teal-800"
                          }`}
                          title="Ditar PA por voz (ex: 12 por 8)"
                        >
                          <Mic size={12} className={activeVitalFieldVoice === "pressure" ? "animate-bounce" : ""} />
                          {activeVitalFieldVoice === "pressure" ? "Ouvindo PA..." : "Ditar PA (ex: 12 por 8)"}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Sistólica</label>
                          <input
                            id="patient-vital-first-input"
                            type="number"
                            autoFocus
                            value={vitalSystolic}
                            onChange={(e) => setVitalSystolic(e.target.value)}
                            placeholder="Ex: 120"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Diastólica</label>
                          <input
                            type="number"
                            value={vitalDiastolic}
                            onChange={(e) => setVitalDiastolic(e.target.value)}
                            placeholder="Ex: 80"
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Valor ({VITAL_SIGN_TYPES.find((t) => t.value === vitalType)?.unit})
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleVitalFieldVoice("value")}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                          activeVitalFieldVoice === "value"
                            ? "bg-rose-500 text-white animate-pulse"
                            : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-200 dark:border-teal-800"
                        }`}
                        title="Ditar valor por voz"
                      >
                        <Mic size={12} className={activeVitalFieldVoice === "value" ? "animate-bounce" : ""} />
                        {activeVitalFieldVoice === "value" ? "Ouvindo..." : "Ditar"}
                      </button>
                    </div>
                    <input
                      id="patient-vital-first-input"
                      type="number"
                      step="0.1"
                      autoFocus
                      value={vitalValue}
                      onChange={(e) => setVitalValue(e.target.value)}
                      placeholder={
                        vitalType === "TEMPERATURA"
                          ? "Ex: 36.5"
                          : vitalType === "GLICEMIA"
                          ? "Ex: 110"
                          : vitalType === "SATURACAO_O2"
                          ? "Ex: 98"
                          : vitalType === "ESCALA_DE_DOR"
                          ? "0 a 10"
                          : "Ex: 75"
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Data e Horário</label>
                  <input
                    type="datetime-local"
                    value={vitalDate}
                    onChange={(e) => setVitalDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {vitalError && <p className="text-rose-500 text-xs font-semibold">{vitalError}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowVitalForm(false)}
                  className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                >
                  Registrar Sinal
                </button>
              </div>
            </form>
          )}

          {vitalSigns.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-3xl">
              <Activity size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum sinal vital registrado</p>
              <p className="text-xs text-slate-500 mt-1">Clique em "Aferir Sinal Vital" acima para iniciar os registros.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <VitalSignsChart vitalSigns={vitalSigns} />

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Histórico de Aferições</h4>
                  <span className="text-xs font-mono text-slate-400">{vitalSigns.length} aferições</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {vitalSigns.map((v) => {
                    const vt = VITAL_SIGN_TYPES.find((t) => t.value === v.type);
                    let statusColor = "text-slate-500";
                    if (v.type === "PRESSAO_ARTERIAL" && v.systolic != null) {
                      const s = getBpStatus(v.systolic, v.diastolic ?? 0);
                      statusColor = s === "normal" ? "text-emerald-600" : s === "atencao" ? "text-amber-600" : "text-rose-600 font-bold";
                    } else {
                      const s = getValueStatus(v.type as VitalSignType, v.value);
                      statusColor = s === "normal" ? "text-emerald-600" : s === "atencao" ? "text-amber-600" : "text-rose-600 font-bold";
                    }
                    return (
                      <div key={v.id} className="px-5 py-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 dark:text-white">{vt?.label || v.type}</span>
                          <span className={`font-mono text-sm font-bold ${statusColor}`}>
                            {v.type === "PRESSAO_ARTERIAL" && v.systolic != null
                              ? `${v.systolic}/${v.diastolic} mmHg`
                              : `${v.value} ${vt?.unit || ""}`}
                          </span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500 font-mono">
                          {new Date(v.recordedAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Medicações */}
      {tab === "medicacoes" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Prescrição e Administração de Medicações</h3>
              <p className="text-xs text-slate-500 mt-0.5">{pendingMedsCount} pendente(s)</p>
            </div>
            <button
              onClick={() => setShowMedForm(!showMedForm)}
              className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors shadow-xs active:scale-[0.98]"
            >
              <Plus size={16} /> Prescrever Medicamento
            </button>
          </div>

          {showMedForm && (
            <form onSubmit={handleAddMedication} className="glass-panel rounded-2xl p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Adicionar Medicação</h4>
                <button
                  type="button"
                  onClick={() => {
                    if (isFullMedVoiceActive) {
                      fullMedSpeech.stopListening();
                      setIsFullMedVoiceActive(false);
                    } else {
                      setIsFullMedVoiceActive(true);
                      fullMedSpeech.resetTranscript();
                      fullMedSpeech.startListening();
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 ${
                    isFullMedVoiceActive
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                  }`}
                  title="Ditar prescrição completa por voz"
                >
                  <Mic size={14} className={isFullMedVoiceActive ? "animate-bounce" : ""} />
                  {isFullMedVoiceActive ? "Ouvindo Prescrição..." : "Ditar por Voz"}
                </button>
              </div>

              {/* Banner de Sucesso ao Aplicar Voz */}
              {medVoiceSuccessCount !== null && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <Check size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      {medVoiceSuccessCount > 0
                        ? `✓ ${medVoiceSuccessCount} campos preenchidos automaticamente por voz! Revise e ajuste o que desejar.`
                        : "Nenhum campo específico identificado. Você pode tocar no microfone de cada campo."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMedVoiceSuccessCount(null)}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Painel de Ditar Prescrição Completa */}
              {isFullMedVoiceActive && (
                <div className="p-3.5 rounded-2xl bg-teal-50/80 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                      <span>{fullMedSpeech.isListening ? "Ouvindo prescrição médica..." : "Microfone pausado"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        fullMedSpeech.stopListening();
                        setIsFullMedVoiceActive(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Fechar
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                    Ex: &quot;Dipirona quinhentos miligramas, uma ampola endovenosa às 08 horas de 8 em 8 horas diluir em 100ml de soro&quot;
                  </p>

                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs min-h-[48px] max-h-[75px] overflow-y-auto">
                    {liveMedTranscript ? (
                      <span className="text-slate-900 dark:text-white font-medium">{liveMedTranscript}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sua fala aparecerá aqui em tempo real...</span>
                    )}
                  </div>

                  {/* Prévia dos Campos Identificados */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                    <div className={`p-1.5 rounded-lg border ${liveMedParsed.name ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Remédio:</span>
                      <span className="truncate block">{liveMedParsed.name || "—"}</span>
                    </div>

                    <div className={`p-1.5 rounded-lg border ${liveMedParsed.dose ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Dose / Via:</span>
                      <span className="truncate block">{liveMedParsed.dose || "—"}</span>
                    </div>

                    <div className={`p-1.5 rounded-lg border ${liveMedParsed.schedule ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Horário:</span>
                      <span className="font-mono block">{liveMedParsed.schedule || "—"}</span>
                    </div>

                    <div className={`p-1.5 rounded-lg border ${liveMedParsed.frequency !== undefined ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold" : "bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-400"}`}>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Intervalo:</span>
                      <span className="block">
                        {liveMedParsed.frequency ? `A cada ${liveMedParsed.frequency}h` : liveMedParsed.frequency === "" ? "Se Necessário" : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {liveMedTranscript ? (
                      <button
                        type="button"
                        onClick={() => fullMedSpeech.resetTranscript()}
                        className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                      >
                        Limpar fala
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      onClick={handleApplyFullMedVoice}
                      disabled={!liveMedTranscript}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 inline-flex items-center gap-1.5"
                    >
                      <Check size={14} /> Aplicar na Prescrição
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nome do Medicamento *
                    </label>
                    {activeMedVoiceField === "name" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Ouvindo nome...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={medName}
                      onChange={(e) => setMedName(e.target.value)}
                      required
                      placeholder="Ex: Dipirona 500mg/mL"
                      className={`w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border rounded-xl text-sm text-slate-900 dark:text-white ${
                        medAllergyConflict.hasConflict
                          ? "border-rose-500 ring-2 ring-rose-500/30"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleMedFieldVoice("name")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeMedVoiceField === "name"
                          ? "bg-rose-500 text-white animate-pulse shadow-xs"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar nome do medicamento"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Dose / Via *
                    </label>
                    {activeMedVoiceField === "dose" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Ouvindo dose...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={medDose}
                      onChange={(e) => setMedDose(e.target.value)}
                      required
                      placeholder="Ex: 1 ampola EV, 1 cp VO"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => toggleMedFieldVoice("dose")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeMedVoiceField === "dose"
                          ? "bg-rose-500 text-white animate-pulse shadow-xs"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar dose e via"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Horário Previsto *
                    </label>
                    {activeMedVoiceField === "schedule" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Diga ex: 14 horas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={medSchedule}
                      onChange={(e) => setMedSchedule(e.target.value)}
                      required
                      className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleMedFieldVoice("schedule")}
                      className={`p-2.5 rounded-xl border min-h-[42px] min-w-[42px] flex items-center justify-center transition-colors ${
                        activeMedVoiceField === "schedule"
                          ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-xs"
                          : "border-slate-200 dark:border-slate-700 text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar horário"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Intervalo / Frequência (Horas)</label>
                  <input
                    type="number"
                    value={medFreq}
                    onChange={(e) => setMedFreq(e.target.value)}
                    placeholder="Ex: 8 (a cada 8h)"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Observações / Recomendações
                    </label>
                    {activeMedVoiceField === "observation" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Ouvindo observações...
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={medObs}
                      onChange={(e) => setMedObs(e.target.value)}
                      placeholder="Ex: Diluir em 100mL SF0.9% e infundir em 30 min"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => toggleMedFieldVoice("observation")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeMedVoiceField === "observation"
                          ? "bg-rose-500 text-white animate-pulse shadow-xs"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar observações"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Banner de Bloqueio por Alergia / Quadro Clínico */}
              {medAllergyConflict.hasConflict && (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-500 text-rose-800 dark:text-rose-200 space-y-1.5 animate-fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="font-bold text-xs uppercase tracking-wide text-rose-700 dark:text-rose-300">
                      Bloqueio de Segurança: Alergia Conhecida!
                    </span>
                  </div>
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed pl-6">
                    Esta medicação coincide com o registro de alergia do paciente: <strong>&quot;{medAllergyConflict.matchedTerm}&quot;</strong> no Quadro Clínico ({medAllergyConflict.source === "allergies" ? "Alergias" : "Diagnóstico"}).
                    A prescrição desta medicação está <strong>bloqueada pelo sistema</strong>.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMedForm(false)}
                  className="px-6 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={medLoading || medAllergyConflict.hasConflict}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-2 ${
                    medAllergyConflict.hasConflict
                      ? "bg-rose-700 text-white cursor-not-allowed opacity-90 shadow-none"
                      : "bg-teal-700 hover:bg-teal-600 active:bg-teal-800 disabled:opacity-50 text-white"
                  }`}
                >
                  {medAllergyConflict.hasConflict ? (
                    <>
                      <ShieldAlert size={15} />
                      Bloqueado por Alergia
                    </>
                  ) : medLoading ? (
                    "Salvando..."
                  ) : (
                    "Salvar Medicação"
                  )}
                </button>
              </div>
            </form>
          )}

          {medications.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-3xl">
              <Pill size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma medicação cadastrada</p>
              <p className="text-xs text-slate-500 mt-1">Prescreva as medicações para organizar o horário das doses.</p>
            </div>
          ) : (
            <div>
              {/* Mobile Cards (md:hidden) */}
              <div className="md:hidden space-y-3">
                {medications.map((med) => {
                  const ms = getMedStatus(med.schedule, med.administered);
                  return (
                    <div
                      key={med.id}
                      className={`p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-xs transition-colors ${
                        med.administered
                          ? "border-slate-200 dark:border-slate-800 opacity-80"
                          : "border-slate-200/90 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{med.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{med.dose}</p>
                          {med.observation && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{med.observation}</p>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold shrink-0 ${ms.color}`}>
                          {med.administered ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {ms.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Clock size={13} className="text-slate-400" />
                          <span>{med.schedule}</span>
                          {!med.administered && (
                            <span title="Notificação ativa">
                              <Bell size={12} className="text-teal-600 dark:text-teal-400" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAdministered(med)}
                            className={`min-h-[40px] px-3.5 py-2 rounded-lg font-bold transition-all text-xs flex items-center gap-1.5 active:scale-[0.98] ${
                              med.administered
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-teal-700 hover:bg-teal-600 text-white shadow-xs"
                            }`}
                          >
                            <Check size={14} />
                            {med.administered ? "Administrado" : "Dar Dose"}
                          </button>
                          <button
                            onClick={() => deleteMedication(med.id)}
                            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (hidden md:block) */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Medicamento</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Dose</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Horário</th>
                        <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-right px-5 py-3 font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {medications.map((med) => {
                        const ms = getMedStatus(med.schedule, med.administered);
                        return (
                          <tr key={med.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{med.name}</p>
                              {med.observation && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{med.observation}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300 font-medium">
                              {med.dose}
                            </td>
                            <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                              <span className="inline-flex items-center gap-1.5">
                                {med.schedule}
                                {!med.administered && (
                                  <span title="Lembrete de notificação ativo">
                                    <Bell size={12} className="text-teal-600 dark:text-teal-400" />
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${ms.color}`}>
                                {med.administered ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                {ms.label}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => toggleAdministered(med)}
                                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs flex items-center gap-1.5 active:scale-[0.98] ${
                                    med.administered
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : "bg-teal-700 hover:bg-teal-600 text-white shadow-xs"
                                  }`}
                                >
                                  <Check size={13} />
                                  {med.administered ? "Administrado" : "Dar Dose"}
                                </button>
                                <button
                                  onClick={() => deleteMedication(med.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Evoluções */}
      {tab === "evolucoes" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Evoluções de Enfermagem (SOAP / Anotações)</h3>
            <span className="text-xs text-slate-400 font-mono">{notes.length} anotação(ões)</span>
          </div>

          <form onSubmit={handleAddNote} className="glass-panel rounded-2xl p-5 space-y-3">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={3}
              placeholder="Descreva a evolução do paciente (Ex: Paciente calmo, eupneico em ar ambiente, afebril, aceitando dieta...)"
              maxLength={2000}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 resize-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{noteContent.length}/2000 caracteres</span>
              <button
                type="submit"
                disabled={!noteContent.trim() || noteLoading}
                className="flex items-center gap-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-xs active:scale-[0.98]"
              >
                <FileText size={15} /> {noteLoading ? "Salvando..." : "Registrar Evolução"}
              </button>
            </div>
          </form>

          {notes.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-3xl">
              <FileText size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma evolução registrada</p>
              <p className="text-xs text-slate-500 mt-1">Registre anotações do plantão para documentar os cuidados prestados.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {notes.map((note) => (
                <div key={note.id} className="glass-panel rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
                  {editingNote === note.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        rows={3}
                        maxLength={2000}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 resize-none text-slate-900 dark:text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingNote(null)}
                          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleEditNote(note.id)}
                          className="px-4 py-2 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-mono">
                          {new Date(note.createdAt).toLocaleString("pt-BR")}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingNote(note.id);
                              setEditNoteContent(note.content);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Editar"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 mt-2.5 whitespace-pre-line leading-relaxed">
                        {note.content}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Cuidados (IA) */}
      {tab === "cuidados" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Plano de Cuidados Assistenciais (IA)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Baseado no diagnóstico e perfil do paciente</p>
            </div>
            <button
              onClick={generateCare}
              disabled={careLoading || !patient?.diagnosis}
              className="flex items-center gap-2 bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-xs active:scale-[0.98]"
            >
              {careLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {careLoading ? "Analisando com IA..." : "Gerar Sugestões de Cuidados"}
            </button>
          </div>

          {!patient?.diagnosis && (
            <div className="text-center py-12 glass-panel rounded-2xl">
              <Bot size={32} className="mx-auto text-teal-600 dark:text-teal-400 mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Paciente sem diagnóstico registrado</p>
              <p className="text-xs text-slate-500 mt-1">Adicione o diagnóstico na aba Dados Clínicos para gerar o plano com IA.</p>
            </div>
          )}

          {careError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              <p className="font-bold">Não foi possível gerar os cuidados:</p>
              <p className="mt-1 font-mono">{careError}</p>
            </div>
          )}

          {careSuggestions && careSuggestions.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                <Sparkles size={16} className="text-teal-700 dark:text-teal-400" />
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Cuidados Sugeridos · {patient.diagnosis}
                </h4>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {careSuggestions.map((suggestion, i) => (
                  <div key={i} className="px-5 py-4 flex items-start gap-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <span className="w-6 h-6 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Relatório (IA) */}
      {tab === "relatorio" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Relatório Clínico Consolidado (IA)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Resumo estruturado do quadro para passagem de plantão</p>
            </div>
          </div>

          {/* Campo de Diagnóstico Clínico Base (editável para direcionar a IA) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Diagnóstico Clínico Base:
              </label>
              <span className="text-[10px] text-slate-400">
                (Editável para direcionar a IA)
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={reportDiagnosis}
                onChange={(e) => setReportDiagnosis(e.target.value)}
                placeholder="Ex: Pneumonia comunitária grave, HAS, DPOC exacerbado, Pós-op..."
                className="flex-1 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/50"
              />
              <button
                type="button"
                onClick={generateReport}
                disabled={reportLoading || !reportDiagnosis.trim()}
                className="flex items-center justify-center gap-2 bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 shadow-xs shrink-0"
              >
                {reportLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {reportLoading ? "Consolidando dados..." : "Gerar Relatório de Plantão"}
              </button>
            </div>
          </div>

          {reportError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              <p className="font-bold">Erro ao gerar relatório:</p>
              <p className="mt-1 font-mono">{reportError}</p>
            </div>
          )}

          {report && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-teal-700 dark:text-teal-400" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                    Relatório para Passagem de Plantão
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingReport) {
                        setReport(editedReport);
                        setIsEditingReport(false);
                        try {
                          sessionStorage.setItem(`ai_report_${id}`, editedReport);
                        } catch {}
                      } else {
                        setEditedReport(report || "");
                        setIsEditingReport(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border ${
                      isEditingReport
                        ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {isEditingReport ? <Check size={13} /> : <Edit3 size={13} />}
                    {isEditingReport ? "Concluir Edição" : "Editar Relatório"}
                  </button>
                  <button
                    type="button"
                    onClick={copyReport}
                    className="flex items-center gap-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Copy size={13} /> {reportCopied ? "Copiado!" : "Copiar Texto"}
                  </button>
                  <button
                    type="button"
                    onClick={saveReportAsNote}
                    className="flex items-center gap-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
                  >
                    <Save size={13} /> Salvar como Evolução
                  </button>
                </div>
              </div>

              {isEditingReport ? (
                <div className="p-4 sm:p-6 space-y-3 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                      <Edit3 size={14} /> Modo de Edição Ativo — Ajuste ou complemente os dados clínicos:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleReportMic}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          reportMicActive
                            ? "bg-rose-500 text-white animate-pulse"
                            : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-900"
                        }`}
                        title="Ditar texto ao final do relatório"
                      >
                        <Mic size={13} className={reportMicActive ? "animate-bounce" : ""} />
                        {reportMicActive ? "Ouvindo fala..." : "Ditar ao Relatório"}
                      </button>
                      <span className="text-[11px] font-mono text-slate-400">{editedReport.length} caracteres</span>
                    </div>
                  </div>

                  <textarea
                    value={editedReport}
                    onChange={(e) => setEditedReport(e.target.value)}
                    rows={14}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800/80 border-2 border-teal-600/40 dark:border-teal-500/40 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-600 shadow-inner resize-y"
                    placeholder="Escreva ou edite o relatório clínico aqui..."
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setEditedReport(report || "");
                        setIsEditingReport(false);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium py-1 px-2"
                    >
                      Cancelar edição
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReport(editedReport);
                          setIsEditingReport(false);
                          try {
                            sessionStorage.setItem(`ai_report_${id}`, editedReport);
                          } catch {}
                        }}
                        className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 transition-all"
                      >
                        Confirmar Edição
                      </button>
                      <button
                        type="button"
                        onClick={saveReportAsNote}
                        className="flex items-center gap-1.5 text-xs font-bold bg-teal-700 hover:bg-teal-600 text-white px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
                      >
                        <Save size={13} /> Salvar como Evolução
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      Toque em <strong className="text-teal-700 dark:text-teal-400">Editar Relatório</strong> para fazer alterações antes de salvar.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditedReport(report || "");
                        setIsEditingReport(true);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline"
                    >
                      <Edit3 size={13} /> Editar texto
                    </button>
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-mono">
                    {report}
                  </p>
                </div>
              )}

              <div className="px-6 pb-4">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                  Revise as informações antes de salvar definitivamente no prontuário.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Modal de Bloqueio por Alergia / Quadro Clínico */}
      {allergyBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-3xl border-2 border-rose-500 max-w-md w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert size={32} />
            </div>
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                Bloqueio de Segurança do Paciente
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Prescrição Bloqueada por Alergia
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                A prescrição da medicação <strong>&quot;{allergyBlockModal.medName}&quot;</strong> foi bloqueada pelo sistema porque colide com o histórico clínico de alergia do paciente:
              </p>
            </div>

            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900 space-y-1">
              <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
                Paciente: {allergyBlockModal.patientName}
              </div>
              <div className="text-xs text-rose-700 dark:text-rose-200">
                ⚠️ Alergia Registrada: <strong>{allergyBlockModal.matchedTerm}</strong>
              </div>
              {allergyBlockModal.rawAllergy && (
                <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 italic">
                  Quadro Clínico / Alergias: {allergyBlockModal.rawAllergy}
                </div>
              )}
            </div>

            <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
              Administrar este fármaco pode causar choque anafilático ou reações adversas graves.
            </p>

            <button
              type="button"
              onClick={() => setAllergyBlockModal(null)}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-98"
            >
              Entendido, fechar aviso
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100/60 dark:border-slate-800/40 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <span className="text-slate-900 dark:text-white font-bold text-right max-w-[65%] truncate">{value}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="text-xs py-1">
      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">{label}</label>
      {type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white font-mono"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 text-slate-900 dark:text-white"
        />
      )}
    </div>
  );
}
