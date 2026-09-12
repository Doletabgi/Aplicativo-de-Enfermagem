"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Preferences } from "@capacitor/preferences";
import { setPendingImportContent } from "@/lib/pendingImport";

export function ImportListener() {
  const router = useRouter();

  useEffect(() => {
    // 1. Cold start / mount inicial: verifica SharedPreferences nativo
    const checkPending = async () => {
      try {
        const { value } = await Preferences.get({ key: "pending_patient_import" });
        if (value) {
          await Preferences.remove({ key: "pending_patient_import" });
          setPendingImportContent(value);
          router.push("/import");
        }
      } catch (err) {
        console.error("Erro ao verificar importação pendente no Preferences:", err);
      }
    };

    checkPending();

    // 2. onNewIntent / runtime: arquivo aberto com o app já em execução
    const handleCustomEvent = async (e: any) => {
      let content = typeof e?.detail === "string" && e.detail ? e.detail : null;

      if (!content) {
        try {
          const { value } = await Preferences.get({ key: "pending_patient_import" });
          if (value) {
            content = value;
            await Preferences.remove({ key: "pending_patient_import" });
          }
        } catch (err) {
          console.error("Erro ao ler Preferences no evento pendingPatientImport:", err);
        }
      }

      if (content) {
        setPendingImportContent(content);
        router.push("/import");
      }
    };

    window.addEventListener("pendingPatientImport", handleCustomEvent);
    return () => {
      window.removeEventListener("pendingPatientImport", handleCustomEvent);
    };
  }, [router]);

  return null;
}
