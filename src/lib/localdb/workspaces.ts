"use client";

import { Preferences } from "@capacitor/preferences";
import { applyTheme, type ThemeId } from "@/lib/theme";

export interface Workspace {
  id: string;
  name: string;
  dbName: string;
  theme?: ThemeId;
}

const WORKSPACES_KEY = "workspaces_list";
const ACTIVE_WORKSPACE_KEY = "active_workspace_id";

export const DEFAULT_WORKSPACES: Workspace[] = [
  { id: "workspace_1", name: "Hospital A", dbName: "prontuario", theme: "blue" },
  { id: "workspace_2", name: "Hospital B", dbName: "prontuario_ws2", theme: "rose" },
];

/**
 * Retorna as 2 áreas de trabalho fixas. Se ainda não existirem nas preferências,
 * inicializa com os valores padrão (Hospital A com tema Azul Claro, e Hospital B com tema Rosa Claro).
 */
export async function listWorkspaces(): Promise<Workspace[]> {
  try {
    const { value } = await Preferences.get({ key: WORKSPACES_KEY });
    if (!value) {
      await Preferences.set({
        key: WORKSPACES_KEY,
        value: JSON.stringify(DEFAULT_WORKSPACES),
      });
      return [...DEFAULT_WORKSPACES];
    }

    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      await Preferences.set({
        key: WORKSPACES_KEY,
        value: JSON.stringify(DEFAULT_WORKSPACES),
      });
      return [...DEFAULT_WORKSPACES];
    }

    // Garante que os IDs e dbNames fixos permaneçam íntegros
    const ws1 = parsed.find((w: any) => w.id === "workspace_1") || DEFAULT_WORKSPACES[0];
    const ws2 = parsed.find((w: any) => w.id === "workspace_2") || DEFAULT_WORKSPACES[1];

    return [
      {
        id: "workspace_1",
        name: ws1.name || "Hospital A",
        dbName: "prontuario",
        theme: (ws1.theme as ThemeId) || "blue",
      },
      {
        id: "workspace_2",
        name: ws2.name || "Hospital B",
        dbName: "prontuario_ws2",
        theme: (ws2.theme as ThemeId) || "rose",
      },
    ];
  } catch {
    return [...DEFAULT_WORKSPACES];
  }
}

/**
 * Retorna o workspace atualmente ativo.
 */
export async function getActiveWorkspace(): Promise<Workspace> {
  const workspaces = await listWorkspaces();
  try {
    const { value } = await Preferences.get({ key: ACTIVE_WORKSPACE_KEY });
    const found = workspaces.find((w) => w.id === value);
    if (found) return found;

    // Padrão: workspace_1
    await setActiveWorkspace(workspaces[0].id);
    return workspaces[0];
  } catch {
    return workspaces[0];
  }
}

/**
 * Define qual workspace está ativo e aplica o tema correspondente.
 */
export async function setActiveWorkspace(id: string): Promise<void> {
  await Preferences.set({ key: ACTIVE_WORKSPACE_KEY, value: id });
  const workspaces = await listWorkspaces();
  const found = workspaces.find((w) => w.id === id);
  if (found && found.theme) {
    applyTheme(found.theme);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workspaces_updated"));
  }
}

/**
 * Permite renomear um workspace (ex: mudar de 'Hospital A' para o nome real do hospital).
 */
export async function renameWorkspace(id: string, newName: string): Promise<Workspace[]> {
  const workspaces = await listWorkspaces();
  const trimmed = newName.trim();
  const finalName = trimmed.length > 0 ? trimmed : (id === "workspace_1" ? "Hospital A" : "Hospital B");

  const updated = workspaces.map((w) => {
    if (w.id === id) {
      return { ...w, name: finalName };
    }
    return w;
  });

  await Preferences.set({
    key: WORKSPACES_KEY,
    value: JSON.stringify(updated),
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workspaces_updated"));
  }

  return updated;
}

/**
 * Define o tema visual de uma área de trabalho específica (ex: Hospital A = azul, Hospital B = rosa).
 */
export async function setWorkspaceTheme(id: string, theme: ThemeId): Promise<Workspace[]> {
  const workspaces = await listWorkspaces();
  const updated = workspaces.map((w) => {
    if (w.id === id) {
      return { ...w, theme };
    }
    return w;
  });

  await Preferences.set({
    key: WORKSPACES_KEY,
    value: JSON.stringify(updated),
  });

  // Se esta for a área ativa, aplica imediatamente o tema no app
  const active = await getActiveWorkspace();
  if (active.id === id) {
    applyTheme(theme);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workspaces_updated"));
    window.dispatchEvent(new CustomEvent("theme_changed", { detail: { workspaceId: id, theme } }));
  }

  return updated;
}
