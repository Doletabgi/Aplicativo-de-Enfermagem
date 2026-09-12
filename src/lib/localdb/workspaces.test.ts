import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory store para mockar Preferences
const store: Record<string, string> = {};

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: store[key] || null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      store[key] = value;
    }),
    remove: vi.fn(async ({ key }: { key: string }) => {
      delete store[key];
    }),
    clear: vi.fn(async () => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
  },
}));

import {
  listWorkspaces,
  getActiveWorkspace,
  setActiveWorkspace,
  renameWorkspace,
  setWorkspaceTheme,
  DEFAULT_WORKSPACES,
} from "./workspaces";

describe("Workspaces management", () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it("should initialize default workspaces when preferences is empty", async () => {
    const list = await listWorkspaces();
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: "workspace_1",
      name: "Hospital A",
      dbName: "prontuario",
      theme: "blue",
    });
    expect(list[1]).toEqual({
      id: "workspace_2",
      name: "Hospital B",
      dbName: "prontuario_ws2",
      theme: "rose",
    });
  });

  it("should return workspace_1 as default active workspace", async () => {
    const active = await getActiveWorkspace();
    expect(active.id).toBe("workspace_1");
    expect(active.dbName).toBe("prontuario");
    expect(active.theme).toBe("blue");
  });

  it("should allow switching the active workspace", async () => {
    await setActiveWorkspace("workspace_2");
    const active = await getActiveWorkspace();
    expect(active.id).toBe("workspace_2");
    expect(active.name).toBe("Hospital B");
    expect(active.dbName).toBe("prontuario_ws2");
    expect(active.theme).toBe("rose");
  });

  it("should allow renaming a workspace", async () => {
    await renameWorkspace("workspace_1", "Hospital Regional São Paulo");
    const list = await listWorkspaces();
    expect(list[0].name).toBe("Hospital Regional São Paulo");
    expect(list[0].dbName).toBe("prontuario"); // dbName nunca muda
  });

  it("should allow customizing both Hospital A and Hospital B names with trimming", async () => {
    await renameWorkspace("workspace_1", "  Hospital Santa Casa  ");
    await renameWorkspace("workspace_2", "  UPA Central 24h  ");
    const list = await listWorkspaces();
    expect(list[0].name).toBe("Hospital Santa Casa");
    expect(list[1].name).toBe("UPA Central 24h");
  });

  it("should fallback to default hospital name if empty name is passed", async () => {
    await renameWorkspace("workspace_1", "   ");
    await renameWorkspace("workspace_2", "");
    const list = await listWorkspaces();
    expect(list[0].name).toBe("Hospital A");
    expect(list[1].name).toBe("Hospital B");
  });

  it("should allow setting different themes per hospital (e.g. Hospital A blue, Hospital B rose)", async () => {
    await setWorkspaceTheme("workspace_1", "blue");
    await setWorkspaceTheme("workspace_2", "rose");
    const list = await listWorkspaces();
    expect(list[0].theme).toBe("blue");
    expect(list[1].theme).toBe("rose");

    // Mudando Hospital B para laranja claro
    await setWorkspaceTheme("workspace_2", "orange");
    const updated = await listWorkspaces();
    expect(updated[0].theme).toBe("blue");
    expect(updated[1].theme).toBe("orange");
  });
});
