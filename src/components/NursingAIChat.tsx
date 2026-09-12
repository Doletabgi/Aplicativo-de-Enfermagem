"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  RotateCcw,
  Mic,
  MicOff,
  User,
  Lightbulb,
  ShieldCheck,
  Stethoscope,
  Zap
} from "lucide-react";
import { askNursingSpecialist, type ChatMessage } from "@/lib/localdb";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

const QUICK_PROMPTS = [
  { label: "Cálculo de gotejamento", query: "Cálculo de gotejamento de soro de 500 mL para 4 horas (gotas e microgotas)?" },
  { label: "Regra dos 9 certos", query: "Quais são os 9 certos na administração de medicamentos?" },
  { label: "Conduta em LPP", query: "Conduta e cobertura indicada para cada estágio de Lesão por Pressão (LPP)?" },
  { label: "Alerta de Sepse / MEWS", query: "Critérios de Sepse e pacote da primeira hora?" },
  { label: "Diagnóstico NANDA", query: "Estrutura do diagnóstico de enfermagem NANDA-I?" },
];

export function NursingAIChat({ className = "h-[490px]" }: { className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content:
        "Olá! Assistente de Enfermagem em modo simplificado. Respostas diretas e econômicas para cálculos, doses, protocolos (Sepse, PCR, LPP) e diagnósticos NANDA.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reconhecimento de voz integrado
  const {
    isSupported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({ lang: "pt-BR", continuous: false, interimResults: true });

  useEffect(() => {
    if (isListening) {
      const live = (transcript + " " + interimTranscript).trim();
      if (live) {
        setInput(live);
      }
    }
  }, [transcript, interimTranscript, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    if (isListening) {
      stopListening();
    }

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: query }];
    setMessages(newMessages);
    setInput("");
    resetTranscript();
    setLoading(true);

    try {
      const reply = await askNursingSpecialist(newMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Houve uma instabilidade temporária na rede. Verifique sua conexão e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (isListening) stopListening();
    resetTranscript();
    setInput("");
    setMessages([
      {
        role: "assistant",
        content:
          "Conversa reiniciada. Em que posso ajudar no seu plantão agora?",
      },
    ]);
  };

  const toggleVoice = () => {
    if (!voiceSupported) {
      alert("Reconhecimento de voz não suportado neste dispositivo.");
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      setInput("");
      resetTranscript();
      startListening();
    }
  };

  return (
    <div className={`bg-white dark:bg-[#111927] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between shadow-xs ${className}`}>
      {/* Header do Quadro */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-800 dark:bg-teal-700 text-white flex items-center justify-center shadow-xs">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">
                Pergunte para a IA
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800/40 hidden sm:inline-flex items-center gap-1">
                <ShieldCheck size={11} /> Especialista
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40 inline-flex items-center gap-1">
                <Zap size={11} /> Simplificado
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Condutas, cálculos e protocolos de enfermagem
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Reiniciar conversa"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Histórico de Mensagens */}
      <div className="flex-1 overflow-y-auto pr-1 my-3 space-y-3 text-xs">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5 border border-teal-200/40">
                  <Stethoscope size={13} />
                </div>
              )}
              <div
                className={`px-3.5 py-2.5 rounded-2xl max-w-[88%] leading-relaxed ${
                  isUser
                    ? "bg-teal-800 dark:bg-teal-700 text-white rounded-tr-xs shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/60 dark:border-slate-700/60 whitespace-pre-wrap"
                }`}
              >
                {m.content}
              </div>
              {isUser && (
                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs py-1 pl-8 italic">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>Consultando conduta clínica...</span>
          </div>
        )}

        {/* Sugestões rápidas quando o histórico for inicial */}
        {messages.length <= 1 && (
          <div className="pt-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
              <Lightbulb size={13} className="text-amber-500" />
              <span>Sugestões frequentes de plantão:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(p.query)}
                  className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Entrada / Envio */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isListening
                ? "Ouvindo sua dúvida clínica..."
                : "Pergunte sobre procedimentos, doses, NANDA..."
            }
            className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              isListening ? "border-rose-400 dark:border-rose-500 bg-rose-50/30" : "border-slate-200 dark:border-slate-700"
            }`}
          />
          {isListening && (
            <span className="absolute right-2.5 top-2.5 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </div>

        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-2 rounded-xl border transition-colors shrink-0 ${
              isListening
                ? "bg-rose-50 border-rose-300 text-rose-600 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 animate-pulse"
                : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300"
            }`}
            title={isListening ? "Parar de ouvir" : "Falar pergunta por microfone"}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-2 rounded-xl bg-teal-800 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors shrink-0 shadow-xs"
          title="Enviar pergunta"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
