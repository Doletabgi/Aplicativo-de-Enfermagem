"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, Save, Camera, User, X, Calendar, Bed, HeartPulse, Sparkles, Check,
  Mic, MicOff, Volume2, RefreshCw, AlertCircle, MessageSquare
} from "lucide-react";
import { createPatient, uploadPhoto } from "@/lib/localdb";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";
import {
  parseClinicalVoiceInput,
  parseSpokenDate,
  formatPersonName,
} from "@/lib/clinical-voice-parser";

const CONDITION_OPTIONS = [
  { value: "", label: "Normal (Estável)", color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", bgLight: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800" },
  { value: "ATENCAO", label: "Atenção", color: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", bgLight: "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800" },
  { value: "CRITICO", label: "Estado Crítico", color: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", bgLight: "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800" },
];

const patientSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  birthDate: z.string().min(1, "Data de nascimento obrigatória"),
  gender: z.string().min(1, "Selecione o sexo"),
  bed: z.string().optional(),
  diagnosis: z.string().optional(),
  allergies: z.string().optional(),
  admissionDate: z.string().min(1, "Data de internação obrigatória"),
});
type PatientForm = z.infer<typeof patientSchema>;

function NewPatientForm() {
  const router = useRouter();
  const [photo, setPhoto] = useState("");
  const [saving, setSaving] = useState(false);
  const [condition, setCondition] = useState("");

  // Voz / Microfone
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [activeFieldListening, setActiveFieldListening] = useState<string | null>(null);
  const [appliedFieldsCount, setAppliedFieldsCount] = useState<number | null>(null);

  const fullSpeech = useSpeechRecognition({ continuous: true, interimResults: true });
  const fieldSpeech = useSpeechRecognition({ continuous: false, interimResults: true });

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      name: "",
      birthDate: "",
      gender: "",
      bed: "",
      diagnosis: "",
      allergies: "",
      admissionDate: new Date().toISOString().split("T")[0],
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUri = await uploadPhoto(file);
      setPhoto(dataUri);
    } catch (err) {
      console.error("Erro no upload da foto:", err);
    }
  };

  const parseDate = (value: string) => {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    return trimmed;
  };

  const onSubmit = async (data: PatientForm) => {
    setSaving(true);
    try {
      const patient = await createPatient({ ...data, birthDate: parseDate(data.birthDate), photo, condition });
      if (patient.id) {
        router.push(`/patient?id=${patient.id}`);
      } else {
        router.push("/patients");
      }
    } catch (e) {
      console.error("Erro ao salvar paciente:", e);
      setSaving(false);
    }
  };

  // Preenchimento completo por voz
  const liveTranscript = (fullSpeech.transcript + " " + fullSpeech.interimTranscript).trim();
  const liveParsed = parseClinicalVoiceInput(liveTranscript);

  const handleStartFullVoice = () => {
    fullSpeech.resetTranscript();
    fullSpeech.startListening();
  };

  const handleApplyVoiceData = () => {
    fullSpeech.stopListening();
    let count = 0;

    if (liveParsed.name) {
      setValue("name", liveParsed.name, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.birthDate) {
      setValue("birthDate", liveParsed.birthDate, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.gender) {
      setValue("gender", liveParsed.gender, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.bed) {
      setValue("bed", liveParsed.bed, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.diagnosis) {
      setValue("diagnosis", liveParsed.diagnosis, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.allergies) {
      setValue("allergies", liveParsed.allergies, { shouldValidate: true, shouldDirty: true });
      count++;
    }
    if (liveParsed.condition !== undefined && liveParsed.condition !== null) {
      setCondition(liveParsed.condition);
      count++;
    }

    setAppliedFieldsCount(count);
    setVoiceModalOpen(false);
    setTimeout(() => setAppliedFieldsCount(null), 5000);
  };

  // Microfone por campo individual
  const toggleFieldListening = (fieldName: keyof PatientForm) => {
    if (activeFieldListening === fieldName) {
      fieldSpeech.stopListening();
      setActiveFieldListening(null);
      return;
    }

    setActiveFieldListening(fieldName);
    fieldSpeech.resetTranscript();
    fieldSpeech.startListening({
      onFinalText: (spokenText) => {
        let text = spokenText.trim();
        if (fieldName === "name") {
          text = formatPersonName(text);
        } else if (fieldName === "birthDate") {
          const parsed = parseSpokenDate(text);
          if (parsed) text = parsed;
        } else if (fieldName === "bed") {
          text = text.replace(/\b(?:leito|quarto|box)\b/gi, "").trim().toUpperCase();
        } else if (fieldName === "allergies") {
          if (/^(sem|nega|nenhuma|n[ãa]o\s+tem)/i.test(text)) {
            text = "Nega alergias conhecidas";
          }
        }
        setValue(fieldName, text, { shouldValidate: true, shouldDirty: true });
        setActiveFieldListening(null);
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60 transition-all duration-200"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Novo Paciente</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Cadastre a ficha clínica manual ou usando a voz</p>
          </div>
        </div>

        {/* Botão de Preenchimento por Voz */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setVoiceModalOpen(true);
              handleStartFullVoice();
            }}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white text-xs font-bold shadow-md shadow-teal-900/10 active:scale-95 transition-all min-h-[44px]"
          >
            <Mic size={16} className="animate-pulse" />
            Preencher por Voz
          </button>
        </div>
      </div>

      {/* Banner de Sucesso ao Aplicar Dados por Voz */}
      {appliedFieldsCount !== null && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-600 shrink-0" />
            <span>
              {appliedFieldsCount > 0
                ? `✓ ${appliedFieldsCount} campos foram preenchidos automaticamente por voz! Revise e ajuste o que desejar.`
                : "Nenhum campo específico foi reconhecido com certeza. Você pode usar os microfones em cada campo ou digitar."}
            </span>
          </div>
          <button
            onClick={() => setAppliedFieldsCount(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Section: Identificação & Foto */}
        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <User size={18} className="text-teal-700 dark:text-teal-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Identificação do Paciente
              </h2>
            </div>
            <span className="text-[11px] text-slate-400">Toque no microfone de cada campo para ditar</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-2 ring-slate-200 dark:ring-slate-700 shadow-xs">
                {photo ? (
                  <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-xs active:scale-95">
                <Camera size={14} />
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
              </label>
              {photo && (
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="absolute -top-1 -left-1 w-6 h-6 bg-slate-800/80 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Remover foto"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex-1 w-full space-y-3">
              {/* Campo: Nome Completo */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nome Completo *
                  </label>
                  <div className="flex items-center gap-2.5">
                    {activeFieldListening === "name" && (
                      <span className="text-[11px] font-semibold text-rose-600 animate-pulse flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                        Ouvindo nome...
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <input
                    {...register("name")}
                    placeholder="Nome do paciente (ou use o microfone)"
                    className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => toggleFieldListening("name")}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                      activeFieldListening === "name"
                        ? "bg-rose-500 text-white animate-pulse"
                        : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title="Ditar nome completo"
                  >
                    <Mic size={16} />
                  </button>
                </div>
                {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Campo: Data de Nascimento */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Data de Nascimento *
                    </label>
                    {activeFieldListening === "birthDate" && (
                      <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                        Diga ex: 15 de maio de 1980
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      {...register("birthDate")}
                      placeholder="DD/MM/AAAA"
                      className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all placeholder:text-slate-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => toggleFieldListening("birthDate")}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                        activeFieldListening === "birthDate"
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                      title="Ditar data de nascimento"
                    >
                      <Mic size={16} />
                    </button>
                  </div>
                  {errors.birthDate && <p className="text-rose-500 text-xs mt-1">{errors.birthDate.message}</p>}
                </div>

                {/* Campo: Sexo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sexo *
                  </label>
                  <select
                    {...register("gender")}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all min-h-[42px]"
                  >
                    <option value="">Selecione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                  {errors.gender && <p className="text-rose-500 text-xs mt-1">{errors.gender.message}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Internação & Leito */}
        <div className="glass-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Bed size={18} className="text-teal-700 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Dados da Internação
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo: Leito / Quarto */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Leito / Quarto
                </label>
                {activeFieldListening === "bed" && (
                  <span className="text-[10px] font-semibold text-rose-600 animate-pulse">
                    Diga o leito ou quarto...
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  {...register("bed")}
                  placeholder="Ex: 201A, UTI-04, Leito 12"
                  className="w-full pl-4 pr-11 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all placeholder:text-slate-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => toggleFieldListening("bed")}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
                    activeFieldListening === "bed"
                      ? "bg-rose-500 text-white animate-pulse"
                      : "text-slate-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                  title="Ditar leito"
                >
                  <Mic size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Data de Internação *
              </label>
              <input
                type="date"
                {...register("admissionDate")}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all font-mono min-h-[42px]"
              />
              {errors.admissionDate && <p className="text-rose-500 text-xs mt-1">{errors.admissionDate.message}</p>}
            </div>

            {/* Campo: Diagnóstico Principal */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Diagnóstico Principal / Hipótese Diagnóstica
                </label>
                <button
                  type="button"
                  onClick={() => toggleFieldListening("diagnosis")}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    activeFieldListening === "diagnosis"
                      ? "bg-rose-500 text-white animate-pulse"
                      : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100"
                  }`}
                  title="Ditar diagnóstico"
                >
                  <Mic size={13} />
                  {activeFieldListening === "diagnosis" ? "Ouvindo..." : "Ditar Diagnóstico"}
                </button>
              </div>
              <textarea
                {...register("diagnosis")}
                rows={2}
                placeholder="Ex: Pneumonia comunitária grave, DM2 descompensada..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Campo: Alergias Conhecidas */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Alergias Conhecidas
                </label>
                <button
                  type="button"
                  onClick={() => toggleFieldListening("allergies")}
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    activeFieldListening === "allergies"
                      ? "bg-rose-500 text-white animate-pulse"
                      : "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100"
                  }`}
                  title="Ditar alergias"
                >
                  <Mic size={13} />
                  {activeFieldListening === "allergies" ? "Ouvindo..." : "Ditar Alergias"}
                </button>
              </div>
              <textarea
                {...register("allergies")}
                rows={2}
                placeholder="Ex: Dipirona, Penicilina, Látex (ou 'Nega alergias conhecidas')"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Section: Triagem Inicial */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <HeartPulse size={18} className="text-rose-600 dark:text-rose-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Classificação Inicial de Risco
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CONDITION_OPTIONS.map((opt) => {
              const active = condition === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCondition(opt.value)}
                  className={`p-3.5 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
                    active
                      ? `${opt.bgLight} ring-2 ring-offset-1 ring-teal-700/30`
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-3 h-3 rounded-full ${opt.color}`} />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{opt.label}</span>
                  </div>
                  {active && <Check size={16} className="text-teal-700 dark:text-teal-400" />}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A situação de risco será combinada automaticamente com os sinais vitais aferidos nas evoluções.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 min-h-[44px] py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[44px] py-2.5 bg-teal-700 hover:bg-teal-600 active:bg-teal-800 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
          >
            <Save size={18} />
            {saving ? "Salvando ficha..." : "Salvar e Abrir Prontuário"}
          </button>
        </div>
      </form>

      {/* Modal / Painel: Preencher Ficha Completa por Voz */}
      {voiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#111927] rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                  <Mic size={20} className={fullSpeech.isListening ? "animate-pulse" : ""} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Ditado Clínico por Voz
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fale os dados do paciente para preencher a ficha
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  fullSpeech.stopListening();
                  setVoiceModalOpen(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mic Status & Pulsing Button */}
            <div className="flex flex-col items-center justify-center py-4 space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 p-4">
              <button
                type="button"
                onClick={() => {
                  if (fullSpeech.isListening) {
                    fullSpeech.stopListening();
                  } else {
                    handleStartFullVoice();
                  }
                }}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  fullSpeech.isListening
                    ? "bg-rose-500 text-white shadow-rose-500/30 ring-4 ring-rose-500/30 animate-pulse"
                    : "bg-teal-700 hover:bg-teal-600 text-white shadow-teal-700/20"
                }`}
              >
                {fullSpeech.isListening ? <MicOff size={26} /> : <Mic size={26} />}
              </button>

              <div className="text-center">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fullSpeech.isListening
                    ? "Ouvindo você... Fale pausadamente"
                    : "Microfone pausado. Toque para falar"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Reconhecimento de fala em Português (Brasil)
                </p>
              </div>

              {fullSpeech.error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{fullSpeech.error}</span>
                </div>
              )}
            </div>

            {/* Guia de Exemplo */}
            <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 p-3 rounded-xl text-xs text-teal-900 dark:text-teal-200 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <Sparkles size={13} className="text-teal-600" />
                Exemplo de como ditar:
              </p>
              <p className="text-[11px] italic text-slate-600 dark:text-slate-300">
                &quot;Paciente Carlos Alberto Silva, nascido em 10 de maio de 1980, sexo masculino, leito 302, diagnóstico pneumonia bacteriana, alergia a dipirona, estado atenção&quot;
              </p>
            </div>

            {/* Transcrição em Tempo Real */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Transcrição da sua fala:
                </span>
                {liveTranscript && (
                  <button
                    type="button"
                    onClick={() => fullSpeech.resetTranscript()}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 min-h-[60px] max-h-[90px] overflow-y-auto">
                {liveTranscript ? (
                  <span>{liveTranscript}</span>
                ) : (
                  <span className="text-slate-400 italic">
                    Sua fala aparecerá aqui em tempo real...
                  </span>
                )}
              </div>
            </div>

            {/* Prévia dos Campos Reconhecidos */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Campos identificados automaticamente:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded-xl border ${liveParsed.name ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Nome:</span>
                  <span className="font-semibold truncate block">{liveParsed.name || "—"}</span>
                </div>

                <div className={`p-2 rounded-xl border ${liveParsed.birthDate ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Nascimento:</span>
                  <span className="font-semibold font-mono block">{liveParsed.birthDate || "—"}</span>
                </div>

                <div className={`p-2 rounded-xl border ${liveParsed.gender ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Sexo:</span>
                  <span className="font-semibold block">{liveParsed.gender || "—"}</span>
                </div>

                <div className={`p-2 rounded-xl border ${liveParsed.bed ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Leito:</span>
                  <span className="font-semibold font-mono block">{liveParsed.bed || "—"}</span>
                </div>

                <div className={`col-span-2 p-2 rounded-xl border ${liveParsed.diagnosis ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Diagnóstico:</span>
                  <span className="font-semibold block truncate">{liveParsed.diagnosis || "—"}</span>
                </div>

                <div className={`col-span-2 p-2 rounded-xl border ${liveParsed.allergies ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200" : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Alergias:</span>
                  <span className="font-semibold block truncate">{liveParsed.allergies || "—"}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  fullSpeech.stopListening();
                  setVoiceModalOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[42px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyVoiceData}
                disabled={!liveTranscript}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all shadow-xs min-h-[42px] disabled:opacity-50 inline-flex items-center gap-2 active:scale-95"
              >
                <Check size={16} />
                Aplicar à Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewPatientPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto space-y-6 animate-pulse pb-16">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-48" />
          <div className="h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        </div>
      }
    >
      <NewPatientForm />
    </Suspense>
  );
}


