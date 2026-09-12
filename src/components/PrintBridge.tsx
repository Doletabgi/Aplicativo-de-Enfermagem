"use client";

import { useEffect } from "react";

/**
 * Componente que intercepta chamadas globais a window.print()
 * no ambiente Android WebView, redirecionando para a interface nativa
 * AndroidPrintInterface. Dessa forma, qualquer local que chame window.print()
 * (como escalas de serviço, relatórios ou fichas) aciona o PrintManager do Android.
 */
export function PrintBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalPrint = window.print.bind(window);

    window.print = () => {
      const androidPrint = (window as unknown as { AndroidPrintInterface?: { print: (t: string) => void } })
        .AndroidPrintInterface;

      if (androidPrint && typeof androidPrint.print === "function") {
        try {
          androidPrint.print(document.title || "Prontuário");
          return;
        } catch (e) {
          console.error("Erro ao chamar AndroidPrintInterface em window.print():", e);
        }
      }

      originalPrint();
    };
  }, []);

  return null;
}
