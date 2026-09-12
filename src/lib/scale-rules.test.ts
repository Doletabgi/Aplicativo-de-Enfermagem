import { describe, it, expect } from "vitest";
import { diffDays, consecutiveStreakRanges, maxConsecutiveStreak } from "./scale-rules";

describe("scale-rules logic", () => {
  it("calculates diffDays between two dates", () => {
    expect(diffDays("2026-09-01", "2026-09-02")).toBe(1);
    expect(diffDays("2026-09-01", "2026-09-05")).toBe(4);
    expect(diffDays("2026-09-05", "2026-09-01")).toBe(-4);
  });

  it("calculates consecutiveStreakRanges", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05", "2026-09-06"];
    const ranges = consecutiveStreakRanges(dates);
    expect(ranges).toEqual([
      { start: "2026-09-01", end: "2026-09-03", days: 3 },
      { start: "2026-09-05", end: "2026-09-06", days: 2 },
    ]);
  });

  it("calculates maxConsecutiveStreak correctly", () => {
    expect(maxConsecutiveStreak([])).toBe(0);
    expect(maxConsecutiveStreak(["2026-09-01"])).toBe(1);
    expect(
      maxConsecutiveStreak(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05", "2026-09-06"])
    ).toBe(3);
  });
});
