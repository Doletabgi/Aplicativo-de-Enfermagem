"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import {
  Mic,
  MicOff,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  FileEdit,
  Sparkles,
  AlertCircle,
  Save,
  RotateCcw,
  Volume2,
  Check,
  X,
} from "lucide-react";
import {
  listPatients,
  createTask,
  parseTaskFromSpeech,
  requestNotificationPermission,
  type Patient,
} from "@/lib/localdb";

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function NewTaskPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  // Estados de gravação
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // Estados do formulário de confirmação
  const [mode, setMode] = useState<"initial" | "recording" | "confirm">("initial");
  const [patientId, setPatientId] = useState<string>("");
  const [patientName, setPatientName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    // Padrão: 30 minutos à frente
    const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
    return toDatetimeLocal(defaultDate);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [detectedByVoice, setDetectedByVoice] = useState(false);

  // Web Speech API fallback ref e flags de controle
  const webRecognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const isStoppingRef = useRef<boolean>(false);

  useEffect(() => {
    async function loadPatients() {
      try {
        const active = await listPatients({ status: "active" });
        setPatients(active);
      } catch (err) {
        console.error("Erro ao listar pacientes:", err);
      } finally {
        setLoadingPatients(false);
      }
    }
    loadPatients();

    // Solicita permissão de notificação silenciosamente
    requestNotificationPermission();

    return () => {
      // Limpeza ao desmontar
      isStoppingRef.current = true;
      if (Capacitor.isNativePlatform()) {
        SpeechRecognition.stop().catch(() => {});
        SpeechRecognition.removeAllListeners().catch(() => {});
      } else if (webRecognitionRef.current) {
        try {
          webRecognitionRef.current.onerror = null;
          webRecognitionRef.current.onend = null;
          webRecognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleApplySpeechResult = useCallback(
    (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!trimmed) {
        setRecordingError("Nenhum áudio detectado. Tente falar mais próximo ao microfone.");
        setMode("initial");
        return;
      }

      // Converte a fala com o parser inteligente
      const parsed = parseTaskFromSpeech(
        trimmed,
        patients.map((p) => ({ id: p.id, name: p.name }))
      );

      if (parsed.patientId) {
        setPatientId(parsed.patientId);
        setPatientName(parsed.patientName);
      } else if (parsed.patientName) {
        setPatientName(parsed.patientName);
      }

      setDescription(parsed.description || trimmed);

      if (parsed.scheduledAt) {
        setScheduledAt(toDatetimeLocal(parsed.scheduledAt));
      } else {
        // Horário padrão caso a voz não tenha mencionado
        const defaultDate = new Date(Date.now() + 30 * 60 * 1000);
        setScheduledAt(toDatetimeLocal(defaultDate));
      }

      setDetectedByVoice(true);
      setMode("confirm");
      setIsRecording(false);
    },
    [patients]
  );

  const startVoiceRecording = async () => {
    setRecordingError(null);
    setLiveTranscript("");
    transcriptRef.current = "";
    isStoppingRef.current = false;
    setIsRecording(true);
    setMode("recording");

    if (Capacitor.isNativePlatform()) {
      try {
        // 1. Permissões de gravação
        const permCheck = await SpeechRecognition.checkPermissions();
        if (permCheck.speechRecognition !== "granted") {
          const permReq = await SpeechRecognition.requestPermissions();
          if (permReq.speechRecognition !== "granted") {
            setRecordingError("Permissão de microfone negada no aparelho.");
            setIsRecording(false);
            setMode("initial");
            return;
          }
        }

        // 2. Ouvinte de transcrição parcial
        let accumulatedText = "";
        await SpeechRecognition.removeAllListeners();
        await SpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            accumulatedText = data.matches[0];
            transcriptRef.current = accumulatedText;
            setLiveTranscript(accumulatedText);
          }
        });

        // 3. Ouvinte de mudança de estado de escuta
        await SpeechRecognition.addListener("listeningState", (data: { status: "started" | "stopped" }) => {
          if (data.status === "stopped" && !isStoppingRef.current) {
            // Silêncio detectado pelo dispositivo - texto pronto
          }
        });

        // 4. Iniciar gravação nativa
        await SpeechRecognition.start({
          language: "pt-BR",
          maxResults: 2,
          prompt: "Fale a tarefa clínica (ex: Aferir pressão de Carlos amanhã às 14h)",
          partialResults: true,
          popup: false,
        });
      } catch (err: any) {
        console.error("Erro ao iniciar SpeechRecognition:", err);
        setRecordingError("Erro ao acessar reconhecimento de voz: " + (err.message || String(err)));
        setIsRecording(false);
        setMode("initial");
      }
    } else {
      // Fallback para navegador web (Web Speech API)
      const WebSpeech =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!WebSpeech) {
        setRecordingError("Reconhecimento de fala não suportado neste navegador. Use a entrada manual.");
        setIsRecording(false);
        setMode("initial");
        return;
      }

      try {
        const recognition = new WebSpeech();
        recognition.lang = "pt-BR";
        recognition.continuous = true;
        recognition.interimResults = true;

        let finalCaptured = "";

        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            const text = item[0]?.transcript || "";
            if (item.isFinal) {
              finalCaptured += text + " ";
            } else {
              interim += text;
            }
          }
          const currentText = (finalCaptured + " " + interim).trim();
          transcriptRef.current = currentText;
          setLiveTranscript(currentText);
        };

        recognition.onerror = (event: any) => {
          console.warn("Web Speech error:", event.error);
          if (event.error === "no-speech" || event.error === "aborted") {
            return;
          }
          if (!isStoppingRef.current) {
            setRecordingError(`Erro de microfone (${event.error}).`);
            setIsRecording(false);
            setMode("initial");
          }
        };

        recognition.onend = () => {
          // Finalização de fala no Web Speech
        };

        webRecognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        setRecordingError("Não foi possível iniciar o microfone.");
        setIsRecording(false);
        setMode("initial");
      }
    }
  };

  const stopVoiceRecording = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const finalText = (transcriptRef.current || liveTranscript).trim();

    if (Capacitor.isNativePlatform()) {
      try {
        // Envolve com Promise.race para timeout de segurança de 500ms
        await Promise.race([
          SpeechRecognition.stop(),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]).catch(() => {});
        await SpeechRecognition.removeAllListeners().catch(() => {});
      } catch (e) {
        console.warn("Erro ao parar gravação:", e);
      }
    } else if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.onerror = null;
        webRecognitionRef.current.onend = null;
        webRecognitionRef.current.stop();
      } catch {}
      webRecognitionRef.current = null;
    }

    setIsRecording(false);
    handleApplySpeechResult(finalText);
  };

  const cancelVoiceRecording = async () => {
    isStoppingRef.current = true;

    if (Capacitor.isNativePlatform()) {
      try {
        await Promise.race([
          SpeechRecognition.stop(),
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]).catch(() => {});
        await SpeechRecognition.removeAllListeners().catch(() => {});
      } catch (e) {
        console.warn("Erro ao cancelar gravação:", e);
      }
    } else if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.onerror = null;
        webRecognitionRef.current.onend = null;
        webRecognitionRef.current.abort?.();
      } catch {}
      webRecognitionRef.current = null;
    }

    transcriptRef.current = "";
    setLiveTranscript("");
    setIsRecording(false);
    setMode("initial");
  };

  const handlePatientSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    setPatientId(pId);
    if (!pId) {
      setPatientName("Geral");
    } else {
      const found = patients.find((p) => p.id === pId);
      setPatientName(found ? found.name : "Paciente");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert("Por favor, informe a descrição da tarefa.");
      return;
    }
    if (!scheduledAt) {
      alert("Por favor, selecione a data e o horário da tarefa.");
      return;
    }

    setIsSaving(true);
    try {
      const resolvedPatientName =
        patientName || (patientId ? patients.find((p) => p.id === patientId)?.name || "Paciente" : "Geral");

      await createTask({
        patientId: patientId || null,
        patientName: resolvedPatientName,
        description: description.trim(),
        scheduledAt: new Date(scheduledAt).toISOString(),
      });

      router.push("/tasks");
    } catch (err) {
      console.error("Erro ao salvar tarefa:", err);
      alert("Ocorreu um erro ao salvar a tarefa no banco de dados local.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para Tarefas
        </Link>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/50">
          100% Offline
        </span>
      </div>

      <div className="bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-xs">
        <div className="text-center max-w-md mx-auto mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-700 text-white mb-3 shadow-sm">
            <Mic size={24} />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Agendar Tarefa por Voz
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fale a ação clínica, o paciente e o horário. O sistema reconhecerá automaticamente e criará o lembrete.
          </p>
        </div>

        {recordingError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold">Atenção</p>
              <p className="mt-0.5">{recordingError}</p>
            </div>
          </div>
        )}

        {/* MODO GRAVAÇÃO / INICIAL */}
        {mode !== "confirm" && (
          <div className="flex flex-col items-center justify-center py-6 space-y-6">
            {/* Botão Gigante de Microfone */}
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <>
                  <span className="absolute w-36 h-36 rounded-full bg-teal-500/20 animate-ping pointer-events-none" />
                  <span className="absolute w-28 h-28 rounded-full bg-teal-500/30 animate-pulse pointer-events-none" />
                </>
              )}
              <button
                type="button"
                onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isRecording
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30"
                    : "bg-teal-700 hover:bg-teal-800 text-white shadow-teal-700/30"
                }`}
                aria-label={isRecording ? "Parar gravação" : "Iniciar gravação de voz"}
              >
                {isRecording ? <MicOff size={34} /> : <Mic size={34} />}
                <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                  {isRecording ? "Parar" : "Falar"}
                </span>
              </button>
            </div>

            {/* Feedback Visual */}
            <div className="text-center min-h-[50px] max-w-sm px-4">
              {isRecording ? (
                <div className="space-y-1 animate-pulse">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-teal-600 animate-ping" />
                    Ouvindo atentamente...
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 italic pt-2">
                    {liveTranscript ? `"${liveTranscript}"` : "Fale agora (ex: 'Aferir sinais vitais de Carlos amanhã às 14h')"}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Toque no botão para gravar ou digite os dados manualmente abaixo.
                </p>
              )}
            </div>

            {/* Botões de Ação Durante a Gravação */}
            {isRecording && (
              <div className="flex items-center gap-3 w-full max-w-xs justify-center pt-1 animate-fade-in">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <X size={15} /> Cancelar
                </button>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-700/20 transition-all active:scale-95"
                >
                  <Check size={16} strokeWidth={2.5} /> Parar e Registrar
                </button>
              </div>
            )}

            {/* Botão Digitar Manualmente */}
            {!isRecording && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setDetectedByVoice(false);
                    setMode("confirm");
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <FileEdit size={15} /> Digitar manualmente
                </button>
              </div>
            )}
          </div>
        )}

        {/* FORMULÁRIO DE CONFIRMAÇÃO & EDIÇÃO */}
        {mode === "confirm" && (
          <form onSubmit={handleSave} className="space-y-5 animate-fade-in">
            {detectedByVoice && (
              <div className="p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 flex items-center justify-between gap-3 text-teal-900 dark:text-teal-200 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-teal-600 shrink-0" />
                  <span>
                    Comando de voz processado! Verifique as informações antes de salvar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLiveTranscript("");
                    setMode("initial");
                  }}
                  className="text-teal-700 dark:text-teal-300 hover:underline font-bold shrink-0 flex items-center gap-1"
                >
                  <RotateCcw size={13} /> Gravar de novo
                </button>
              </div>
            )}

            {/* Paciente */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User size={14} className="text-teal-600" />
                Paciente Vinculado
              </label>
              <select
                value={patientId}
                onChange={handlePatientSelectChange}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Geral (Sem paciente específico / Plantão)</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.bed ? `• Leito ${p.bed}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <FileEdit size={14} className="text-teal-600" />
                Descrição da Tarefa Clínica
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Aferir pressão arterial, glicemia capilar e checar curativo"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Data e Horário */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock size={14} className="text-teal-600" />
                Data e Horário do Lembrete
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                A notificação local disparará no horário exato configurado, mesmo com o aplicativo fechado.
              </p>
            </div>

            {/* Ações */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setMode("initial");
                  setLiveTranscript("");
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                <Save size={15} />
                {isSaving ? "Agendando..." : "Salvar e Agendar Tarefa"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Dicas Rápidas de Voz */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
        <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Volume2 size={14} className="text-teal-600" /> Exemplos de frases que você pode falar:
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
          <li>&quot;Aferir pressão arterial de Carlos amanhã às 14h&quot;</li>
          <li>&quot;Dar banho no leito para Maria daqui a 30 minutos&quot;</li>
          <li>&quot;Trocar curativo do leito 3 às 16:30&quot;</li>
          <li>&quot;Coletar hemograma de João Silva na sexta-feira às 08:00&quot;</li>
        </ul>
      </div>
    </div>
  );
}
