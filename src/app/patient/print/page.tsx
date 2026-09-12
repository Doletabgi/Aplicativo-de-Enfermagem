"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import { STATUS_CONFIG } from "@/lib/statusConfig";
import { getValueStatus, getBpStatus } from "@/lib/vital-ranges";
import { VITAL_SIGN_TYPES } from "@/types";
import type { VitalSignType } from "@/types";
import { getPatientById, getSettings, getPatientStatus, listVitalSigns, listMedications, listNursingNotes } from "@/lib/localdb";
import { printDocument } from "@/lib/print";

interface Patient {
  id: string; name: string; birthDate: string; gender: string; bed: string;
  diagnosis: string; allergies: string; emergencyContact: string; emergencyPhone: string;
  photo: string; admissionDate: string; dischargeDate: string | null; active: boolean;
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Carregando...</div>}>
      <PrintContent />
    </Suspense>
  );
}

function PrintContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitalSigns, setVitalSigns] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [status, setStatus] = useState("sem_dados");
  const [loading, setLoading] = useState(true);
  const [hospitalName, setHospitalName] = useState("");
  const [report, setReport] = useState("");

  useEffect(() => {
    (async () => {
      const [patientData, settings, vitals, meds, patientNotes, statusValue] = await Promise.all([
        getPatientById(id),
        getSettings(),
        listVitalSigns({ patientId: id }),
        listMedications({ patientId: id }),
        listNursingNotes(id),
        getPatientStatus(id),
      ]);
      setPatient(patientData);
      setVitalSigns(vitals);
      setMedications(meds);
      setNotes(patientNotes);
      setHospitalName(settings.hospitalName || "");
      setReport(sessionStorage.getItem(`ai_report_${id}`) || "");
      setStatus(statusValue);
      setLoading(false);
    })();
  }, [id]);

  const handlePrint = () => {
    const safeName = patient?.name
      ? patient.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_")
      : "Paciente";
    const dateStr = new Date().toISOString().slice(0, 10);
    printDocument(`Ficha_${safeName}_${dateStr}`);
  };

  useEffect(() => {
    if (!loading && patient) {
      const timer = setTimeout(() => handlePrint(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, patient]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Carregando...</div>;
  }

  if (!patient) return null;

  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const todayMeds = medications.filter((m: any) => {
    const [h, min] = (m.schedule || "00:00").split(":").map(Number);
    const sched = new Date();
    sched.setHours(h, min, 0, 0);
    const now = new Date();
    return sched <= now;
  });

  const calcAge = (birthDate: string) => {
    if (!birthDate) return "";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} anos`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <style>{`
        @page { size: A4; margin: 9mm; }
        @media print {
          .no-print { display: none !important; }
          .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .print-section { margin-bottom: 8px !important; }
          .print-section h3 { font-size: 11px !important; margin-bottom: 3px !important; }
          .print-sheet table { font-size: 9.5px !important; }
          .print-sheet table td { padding-top: 1px !important; padding-bottom: 1px !important; }
          .print-header { margin-bottom: 10px !important; padding-bottom: 8px !important; }
          .print-header h1, .print-header h2 { margin: 0 !important; }
          .report-text { font-size: 9.5px !important; line-height: 1.3 !important; }
          .print-footer { display: none !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer"
          title="Abrir diálogo de impressão do Android (selecionar impressora ou salvar em PDF)"
        >
          <Printer size={16} /> Imprimir / Salvar em PDF
        </button>
      </div>

      <div className="print-sheet bg-white rounded-2xl border p-8 shadow-sm" style={{ fontFamily: "system-ui, sans-serif" }}>
        <div className="print-header text-center mb-8 border-b pb-6">
          {hospitalName && <h1 className="text-xl font-bold">{hospitalName}</h1>}
          <h2 className="text-lg font-semibold mt-1">Resumo de Enfermagem</h2>
          <p className="text-sm text-gray-500">Emitido em {new Date().toLocaleString("pt-BR")}</p>
        </div>

        <div className="print-section mb-8">
          <h3 className="font-bold text-base mb-3">Dados do Paciente</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 pr-4 text-gray-500 w-40">Nome</td><td className="font-medium">{patient.name}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Idade</td><td>{calcAge(patient.birthDate)}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Sexo</td><td>{patient.gender}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Leito</td><td>{patient.bed || "-"}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Diagnóstico</td><td>{patient.diagnosis || "-"}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Alergias</td><td>{patient.allergies || "Nenhuma"}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Internação</td><td>{new Date(patient.admissionDate).toLocaleDateString("pt-BR")}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Status Clínico</td><td><span className="font-semibold">{cfg.label}</span></td></tr>
            </tbody>
          </table>
        </div>

        {todayMeds.length > 0 && (
          <div className="print-section mb-8">
            <h3 className="font-bold text-base mb-3">Medicações do Dia</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-500">Medicamento</th>
                  <th className="text-left py-2 font-medium text-gray-500">Dose</th>
                  <th className="text-left py-2 font-medium text-gray-500">Horário</th>
                  <th className="text-left py-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayMeds.map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-100">
                    <td className="py-1.5">{m.name}</td>
                    <td>{m.dose}</td>
                    <td>{m.schedule}</td>
                    <td>{m.administered ? "✓ Administrado" : "— Pendente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {report && (
          <div className="print-section mb-8">
            <h3 className="font-bold text-base mb-3">Relatório de Enfermagem</h3>
            <p className="report-text text-sm whitespace-pre-line leading-relaxed">{report}</p>
          </div>
        )}

        {vitalSigns.length > 0 && (
          <div className="print-section mb-8">
            <h3 className="font-bold text-base mb-3">Sinais Vitais Recentes</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-500">Tipo</th>
                  <th className="text-left py-2 font-medium text-gray-500">Valor</th>
                  <th className="text-left py-2 font-medium text-gray-500">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {vitalSigns.slice(0, 10).map((v: any) => {
                  const vt = VITAL_SIGN_TYPES.find(t => t.value === v.type);
                  return (
                    <tr key={v.id} className="border-b border-gray-100">
                      <td className="py-1.5">{vt?.label}</td>
                      <td className="font-medium">
                        {v.type === "PRESSAO_ARTERIAL" && v.systolic != null
                          ? `${v.systolic}/${v.diastolic} mmHg`
                          : `${v.value} ${vt?.unit || ""}`}
                      </td>
                      <td className="text-gray-500">{new Date(v.recordedAt).toLocaleString("pt-BR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {notes.length > 0 && (
          <div className="print-section mb-8">
            <h3 className="font-bold text-base mb-3">Últimas Evoluções</h3>
            {notes.slice(0, 3).map((n: any) => (
              <div key={n.id} className="mb-3 pb-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{new Date(n.createdAt).toLocaleString("pt-BR")}</p>
                <p className="text-sm whitespace-pre-line">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        <div className="print-footer text-center text-xs text-gray-400 mt-8 pt-4 border-t">
          Documento gerado em {new Date().toLocaleString("pt-BR")}
        </div>
      </div>
    </div>
  );
}
