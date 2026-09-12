import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock do DOM para ambiente Node
function createMockDocument() {
  const classes = new Set<string>();
  const attributes: Record<string, string> = {};

  return {
    documentElement: {
      classList: {
        add: (...cls: string[]) => cls.forEach((c) => classes.add(c)),
        remove: (...cls: string[]) => cls.forEach((c) => classes.delete(c)),
        contains: (cls: string) => classes.has(cls),
      },
      setAttribute: (key: string, val: string) => {
        attributes[key] = val;
      },
      getAttribute: (key: string) => attributes[key] || null,
      removeAttribute: (key: string) => {
        delete attributes[key];
      },
    },
    querySelector: vi.fn(() => null),
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
    })),
    head: {
      appendChild: vi.fn(),
    },
  };
}

function createMockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

describe("Theme system", () => {
  let mockDoc: any;
  let mockStorage: any;
  const originalDoc = global.document;
  const originalStorage = global.localStorage;

  beforeEach(() => {
    mockDoc = createMockDocument();
    mockStorage = createMockLocalStorage();
    (global as any).document = mockDoc;
    (global as any).localStorage = mockStorage;
  });

  afterEach(() => {
    global.document = originalDoc;
    global.localStorage = originalStorage;
  });

  it("should contain all required themes including blue, rose, and orange", async () => {
    const { THEMES } = await import("./theme");
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain("blue");
    expect(ids).toContain("rose");
    expect(ids).toContain("orange");
    expect(ids).toContain("default");
    expect(ids).toContain("dark");
  });

  it("should apply blue theme correctly", async () => {
    const { applyTheme, getCurrentAppliedTheme } = await import("./theme");
    applyTheme("blue");
    expect(mockDoc.documentElement.classList.contains("theme-blue")).toBe(true);
    expect(mockDoc.documentElement.classList.contains("dark")).toBe(false);
    expect(mockDoc.documentElement.getAttribute("data-theme")).toBe("blue");
    expect(mockStorage.getItem("theme")).toBe("blue");
    expect(getCurrentAppliedTheme()).toBe("blue");
  });

  it("should apply rose theme correctly", async () => {
    const { applyTheme, getCurrentAppliedTheme } = await import("./theme");
    applyTheme("rose");
    expect(mockDoc.documentElement.classList.contains("theme-rose")).toBe(true);
    expect(mockDoc.documentElement.classList.contains("dark")).toBe(false);
    expect(mockDoc.documentElement.getAttribute("data-theme")).toBe("rose");
    expect(mockStorage.getItem("theme")).toBe("rose");
    expect(getCurrentAppliedTheme()).toBe("rose");
  });

  it("should apply orange theme correctly", async () => {
    const { applyTheme, getCurrentAppliedTheme } = await import("./theme");
    applyTheme("orange");
    expect(mockDoc.documentElement.classList.contains("theme-orange")).toBe(true);
    expect(mockDoc.documentElement.classList.contains("dark")).toBe(false);
    expect(mockDoc.documentElement.getAttribute("data-theme")).toBe("orange");
    expect(mockStorage.getItem("theme")).toBe("orange");
    expect(getCurrentAppliedTheme()).toBe("orange");
  });

  it("should apply dark theme correctly", async () => {
    const { applyTheme, getCurrentAppliedTheme } = await import("./theme");
    applyTheme("dark");
    expect(mockDoc.documentElement.classList.contains("dark")).toBe(true);
    expect(mockDoc.documentElement.classList.contains("theme-blue")).toBe(false);
    expect(mockDoc.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(mockStorage.getItem("theme")).toBe("dark");
    expect(getCurrentAppliedTheme()).toBe("dark");
  });

  it("should switch between themes cleanly without leftover classes", async () => {
    const { applyTheme } = await import("./theme");
    applyTheme("blue");
    expect(mockDoc.documentElement.classList.contains("theme-blue")).toBe(true);

    applyTheme("rose");
    expect(mockDoc.documentElement.classList.contains("theme-blue")).toBe(false);
    expect(mockDoc.documentElement.classList.contains("theme-rose")).toBe(true);

    applyTheme("orange");
    expect(mockDoc.documentElement.classList.contains("theme-rose")).toBe(false);
    expect(mockDoc.documentElement.classList.contains("theme-orange")).toBe(true);

    applyTheme("dark");
    expect(mockDoc.documentElement.classList.contains("theme-orange")).toBe(false);
    expect(mockDoc.documentElement.classList.contains("dark")).toBe(true);
  });
});
