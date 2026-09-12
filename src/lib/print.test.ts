import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printDocument } from "./print";

describe("printDocument", () => {
  const originalWindow = global.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  it("should call AndroidPrintInterface.print when available on Android", () => {
    const mockAndroidPrint = vi.fn();
    (global as any).window = {
      AndroidPrintInterface: {
        print: mockAndroidPrint,
      },
      print: vi.fn(),
    };

    printDocument("Ficha_Maria_Silva_2026-09-07");

    expect(mockAndroidPrint).toHaveBeenCalledTimes(1);
    expect(mockAndroidPrint).toHaveBeenCalledWith("Ficha_Maria_Silva_2026-09-07");
    expect((global as any).window.print).not.toHaveBeenCalled();
  });

  it("should fallback to window.print on web when AndroidPrintInterface is not present", () => {
    const mockWindowPrint = vi.fn();
    (global as any).window = {
      print: mockWindowPrint,
    };

    printDocument("Ficha_Paciente");

    expect(mockWindowPrint).toHaveBeenCalledTimes(1);
  });

  it("should use document.title or fallback if no title is provided", () => {
    const mockAndroidPrint = vi.fn();
    (global as any).window = {
      AndroidPrintInterface: {
        print: mockAndroidPrint,
      },
      print: vi.fn(),
    };
    (global as any).document = {
      title: "Prontuário Enfermagem",
    };

    printDocument();

    expect(mockAndroidPrint).toHaveBeenCalledWith("Prontuário Enfermagem");
  });
});
