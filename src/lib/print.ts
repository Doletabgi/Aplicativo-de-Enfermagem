"use client";

/**
 * Utilitário de impressão multiplataforma.
 * - No Android nativo (Capacitor WebView com AndroidPrintInterface):
 *   chama a interface nativa do Android que abre o PrintManager do sistema operacional,
 *   permitindo selecionar impressoras Wi-Fi/Bluetooth ou "Salvar como PDF".
 * - Na Web / Desktop / PWA:
 *   chama o window.print() padrão do navegador.
 */
export function printDocument(title?: string): void {
  if (typeof window === "undefined") return;

  const docTitle = (title || document.title || "Prontuário").trim();

  // Verifica se a interface nativa do Android está presente
  const androidPrint = (window as unknown as { AndroidPrintInterface?: { print: (t: string) => void } })
    .AndroidPrintInterface;

  if (androidPrint && typeof androidPrint.print === "function") {
    try {
      androidPrint.print(docTitle);
      return;
    } catch (e) {
      console.error("Erro ao chamar AndroidPrintInterface:", e);
    }
  }

  // Fallback padrão para navegadores de desktop ou PWA
  if (typeof window.print === "function") {
    window.print();
  }
}
