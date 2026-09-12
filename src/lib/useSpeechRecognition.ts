"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as CapSpeechRecognition } from "@capacitor-community/speech-recognition";

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionHook {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: (options?: { onFinalText?: (text: string) => void }) => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition({
  lang = "pt-BR",
  continuous = true,
  interimResults = true,
}: UseSpeechRecognitionOptions = {}): SpeechRecognitionHook {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const webRecognitionRef = useRef<any>(null);
  const onFinalTextCallbackRef = useRef<((text: string) => void) | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const isListeningRef = useRef(false);

  // Armazena histórico de sessões anteriores sem acumular duplicatas
  const persistedRef = useRef("");
  const sessionFinalRef = useRef("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (Capacitor.isNativePlatform()) {
        setIsSupported(true);
      } else {
        const WebSpeech =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        setIsSupported(!!WebSpeech);
      }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    persistedRef.current = "";
    sessionFinalRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const stopListening = useCallback(async () => {
    isManuallyStoppedRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    if (Capacitor.isNativePlatform()) {
      try {
        await CapSpeechRecognition.stop();
        await CapSpeechRecognition.removeAllListeners();
      } catch (e) {
        console.warn("Erro ao parar CapSpeechRecognition:", e);
      }
    } else if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch (e) {
        console.warn("Erro ao parar Web Speech Recognition:", e);
      }
    }
  }, []);

  const startListening = useCallback(
    async (options?: { onFinalText?: (text: string) => void }) => {
      setError(null);
      isManuallyStoppedRef.current = false;
      isListeningRef.current = true;
      onFinalTextCallbackRef.current = options?.onFinalText || null;

      persistedRef.current = "";
      sessionFinalRef.current = "";
      setTranscript("");
      setInterimTranscript("");

      if (typeof window === "undefined") return;

      // 1. Dispositivo Móvel Nativo (Android via Capacitor)
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await CapSpeechRecognition.checkPermissions();
          if (perm.speechRecognition !== "granted") {
            const req = await CapSpeechRecognition.requestPermissions();
            if (req.speechRecognition !== "granted") {
              setError("Permissão de microfone não concedida.");
              setIsListening(false);
              isListeningRef.current = false;
              return;
            }
          }

          await CapSpeechRecognition.removeAllListeners();

          await CapSpeechRecognition.addListener("partialResults", (data: { matches: string[] }) => {
            if (!isListeningRef.current) return;
            if (data.matches && data.matches.length > 0) {
              const text = data.matches[0].trim();
              setTranscript(text);
              if (onFinalTextCallbackRef.current) {
                onFinalTextCallbackRef.current(text);
              }
            }
          });

          await CapSpeechRecognition.addListener("listeningState", (data: { status: "started" | "stopped" }) => {
            if (data.status === "started") {
              setIsListening(true);
              isListeningRef.current = true;
            } else if (data.status === "stopped") {
              if (isManuallyStoppedRef.current || !continuous) {
                setIsListening(false);
                isListeningRef.current = false;
              }
            }
          });

          setIsListening(true);
          await CapSpeechRecognition.start({
            language: lang,
            maxResults: 2,
            partialResults: interimResults,
            popup: false,
          });
          return;
        } catch (err: any) {
          console.warn("Erro no SpeechRecognition nativo, tentando fallback WebSpeech:", err);
        }
      }

      // 2. Web Speech API (Navegador Desktop ou WebView fallback)
      const WebSpeech =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!WebSpeech) {
        setError("Reconhecimento de fala não suportado neste dispositivo.");
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }

      if (webRecognitionRef.current) {
        try {
          webRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      try {
        const recognition = new WebSpeech();
        recognition.lang = lang;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
          setError(null);
        };

        // Elimina duplicações: iterar todo o array de resultados e substituir em vez de concatenar no estado
        recognition.onresult = (event: any) => {
          if (!isListeningRef.current) return;

          let sessionFinal = "";
          let sessionInterim = "";

          for (let i = 0; i < event.results.length; i++) {
            const item = event.results[i];
            const text = item[0]?.transcript || "";
            if (item.isFinal) {
              sessionFinal += text + " ";
            } else {
              sessionInterim += text;
            }
          }

          sessionFinalRef.current = sessionFinal.trim();
          const cleanInterim = sessionInterim.trim();

          const fullTranscript = (persistedRef.current + " " + sessionFinalRef.current).trim();

          setTranscript(fullTranscript);
          setInterimTranscript(cleanInterim);

          if (fullTranscript && onFinalTextCallbackRef.current) {
            onFinalTextCallbackRef.current(fullTranscript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Erro de reconhecimento de voz:", event.error);
          if (event.error === "no-speech" || event.error === "aborted") {
            return;
          }
          if (event.error === "not-allowed") {
            setError("Permissão de microfone negada.");
          } else if (event.error === "network") {
            setError("Falha de conexão no reconhecimento de voz.");
          } else {
            setError(`Erro no microfone (${event.error}).`);
          }
          setIsListening(false);
          isListeningRef.current = false;
        };

        recognition.onend = () => {
          if (continuous && !isManuallyStoppedRef.current && isListeningRef.current) {
            persistedRef.current = (persistedRef.current + " " + sessionFinalRef.current).trim();
            sessionFinalRef.current = "";
            try {
              recognition.start();
              return;
            } catch {
              // ignore
            }
          }
          setIsListening(false);
          isListeningRef.current = false;
        };

        webRecognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        console.error("Falha ao iniciar microfone:", err);
        setError("Não foi possível acessar o microfone.");
        setIsListening(false);
        isListeningRef.current = false;
      }
    },
    [continuous, interimResults, lang]
  );

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
