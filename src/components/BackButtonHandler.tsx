"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/**
 * Tenta fechar o modal mais recente/aberto no DOM.
 * Procura por overlays modais visíveis (fixed inset-0 com z-index alto)
 * e aciona o botão de cancelar/fechar correspondente.
 */
function tryCloseTopmostModal(): boolean {
  if (typeof document === "undefined") return false;

  // Seleciona overlays de modais comuns da aplicação
  const modalOverlays = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.fixed.inset-0.z-50, .fixed.inset-0.z-\\[70\\], .fixed.inset-0.z-\\[100\\], [role="dialog"], [data-modal="true"]'
    )
  );

  // Filtra apenas os overlays visíveis
  const visibleModals = modalOverlays.filter((el) => {
    if (el.classList.contains("z-10")) return false; // Ignora menus dropdown leves da navbar
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  });

  if (visibleModals.length === 0) return false;

  // Pega o modal mais ao topo (último no DOM)
  const topModal = visibleModals[visibleModals.length - 1];

  // 1. Procura botão com atributo explícito de fechar
  const explicitCloseBtn = topModal.querySelector<HTMLButtonElement>(
    'button[aria-label="Fechar"], button[aria-label="Close"], button[title="Fechar"], button[title="Cancelar"], button[data-modal-close="true"]'
  );

  if (explicitCloseBtn && !explicitCloseBtn.disabled) {
    explicitCloseBtn.click();
    return true;
  }

  // 2. Procura botões com texto comum de cancelamento/fechamento
  const buttons = Array.from(topModal.querySelectorAll<HTMLButtonElement>("button"));
  const cancelBtn = buttons.find((btn) => {
    if (btn.disabled) return false;
    const text = (btn.textContent || "").trim().toLowerCase();
    return (
      text === "cancelar" ||
      text === "fechar" ||
      text === "voltar" ||
      text === "entendido" ||
      text === "não" ||
      text === "nao"
    );
  });

  if (cancelBtn) {
    cancelBtn.click();
    return true;
  }

  // 3. Procura botão com ícone de fechar (X)
  const xBtn = buttons.find((btn) => {
    if (btn.disabled) return false;
    return (
      btn.querySelector("svg.lucide-x") !== null ||
      btn.getAttribute("aria-label")?.toLowerCase().includes("fechar")
    );
  });

  if (xBtn) {
    xBtn.click();
    return true;
  }

  return false;
}

export default function BackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const listenerPromise = App.addListener("backButton", () => {
      // 1. Permite que componentes cancelem a navegação via evento customizado se necessário
      const customEvent = new CustomEvent("app:backbutton", { cancelable: true });
      const notPrevented = window.dispatchEvent(customEvent);
      if (!notPrevented) {
        return;
      }

      // 2. Se houver modal ou confirmação aberta, fecha o modal primeiro
      if (tryCloseTopmostModal()) {
        return;
      }

      // 3. Nas telas raiz, o botão Voltar deve minimizar o app (comportamento padrão Android)
      if (pathname === "/" || pathname === "/login" || pathname === "/register") {
        App.minimizeApp();
      } else {
        router.back();
      }
    });

    return () => {
      listenerPromise.then((listener) => listener.remove()).catch(() => {});
    };
  }, [pathname, router]);

  return null;
}
