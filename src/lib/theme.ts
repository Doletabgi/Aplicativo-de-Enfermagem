"use client";

import { SafeArea } from "@capacitor-community/safe-area";

export type ThemeId = "default" | "blue" | "rose" | "orange" | "dark";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  subtitle: string;
  accentColor: string;
  badgeBg: string;
  cardBorder: string;
  bgPreview: string;
  isDark: boolean;
  emoji: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: "blue",
    name: "Azul Claro",
    subtitle: "Suave, sereno e focado",
    accentColor: "#0284c7",
    badgeBg: "#e0f2fe",
    cardBorder: "#bfdbfe",
    bgPreview: "#f0f7ff",
    isDark: false,
    emoji: "🌊",
  },
  {
    id: "rose",
    name: "Rosa Claro",
    subtitle: "Acolhedor e delicado",
    accentColor: "#e11d48",
    badgeBg: "#ffe4e6",
    cardBorder: "#fecdd3",
    bgPreview: "#fff1f5",
    isDark: false,
    emoji: "🌸",
  },
  {
    id: "orange",
    name: "Laranja Claro",
    subtitle: "Pêssego, caloroso e amigável",
    accentColor: "#ea580c",
    badgeBg: "#ffedd5",
    cardBorder: "#fed7aa",
    bgPreview: "#fff8f0",
    isDark: false,
    emoji: "🍊",
  },
  {
    id: "default",
    name: "Claro Clínico",
    subtitle: "Verde e ardósia padrão",
    accentColor: "#0f766e",
    badgeBg: "#ccfbf1",
    cardBorder: "#cbd5e1",
    bgPreview: "#f8fafc",
    isDark: false,
    emoji: "🌿",
  },
  {
    id: "dark",
    name: "Escuro Noturno",
    subtitle: "Descanso ocular para plantões",
    accentColor: "#14b8a6",
    badgeBg: "#134e4a",
    cardBorder: "#334155",
    bgPreview: "#0b0f19",
    isDark: true,
    emoji: "🌙",
  },
];

/**
 * Aplica visualmente o tema selecionado no DOM.
 */
export function applyTheme(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // Remove classes anteriores
  root.classList.remove("dark", "theme-blue", "theme-rose", "theme-orange", "theme-default");

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "blue") {
    root.classList.add("theme-blue");
  } else if (theme === "rose") {
    root.classList.add("theme-rose");
  } else if (theme === "orange") {
    root.classList.add("theme-orange");
  } else {
    root.classList.add("theme-default");
  }

  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {}

  // Sincroniza a tag meta theme-color para navegadores e barra de status do sistema
  const themeColors: Record<ThemeId, string> = {
    default: "#f8fafc",
    blue: "#f0f7ff",
    rose: "#fff1f5",
    orange: "#fff8f0",
    dark: "#0b0f19",
  };

  try {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", themeColors[theme] || "#f8fafc");
  } catch {}

  // Sincroniza Safe Area e barra de status nativa do Android
  try {
    SafeArea.enable({
      config: {
        customColorsForSystemBars: true,
        statusBarColor: "#00000000",
        statusBarContent: theme === "dark" ? "light" : "dark",
        navigationBarColor: "#00000000",
        navigationBarContent: theme === "dark" ? "light" : "dark",
      },
    }).catch(() => {});
  } catch {}
}

/**
 * Retorna o tema atualmente aplicado no DOM ou no localStorage.
 */
export function getCurrentAppliedTheme(): ThemeId {
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme") as ThemeId;
    if (attr && THEMES.some((t) => t.id === attr)) return attr;
    if (document.documentElement.classList.contains("dark")) return "dark";
    if (document.documentElement.classList.contains("theme-blue")) return "blue";
    if (document.documentElement.classList.contains("theme-rose")) return "rose";
    if (document.documentElement.classList.contains("theme-orange")) return "orange";
  }
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("theme") as ThemeId;
    if (stored && THEMES.some((t) => t.id === stored)) return stored;
  }
  return "default";
}
