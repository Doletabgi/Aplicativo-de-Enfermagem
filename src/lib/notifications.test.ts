import { describe, it, expect } from "vitest";
import { getNotificationId, calculateUpcomingDoses } from "./notifications";

describe("Notifications Helper", () => {
  it("should generate deterministic positive integer IDs within 31-bit limits", () => {
    const id1 = getNotificationId("med-123", 0);
    const id2 = getNotificationId("med-123", 0);
    const id3 = getNotificationId("med-123", 1);
    const id4 = getNotificationId("med-456", 0);

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).not.toBe(id4);
    expect(id1).toBeGreaterThanOrEqual(0);
    expect(id1).toBeLessThanOrEqual(2147483647);
  });

  it("should calculate upcoming doses properly", () => {
    const doses = calculateUpcomingDoses("14:00", 8, 3);
    expect(doses.length).toBe(3);
    // Interval between doses should be 8 hours (8 * 60 * 60 * 1000 ms)
    const diffMs1 = doses[1].getTime() - doses[0].getTime();
    const diffMs2 = doses[2].getTime() - doses[1].getTime();
    expect(diffMs1).toBe(8 * 3600 * 1000);
    expect(diffMs2).toBe(8 * 3600 * 1000);
  });

  it("should default to 24h interval if no frequency is given", () => {
    const doses = calculateUpcomingDoses("08:00", null, 2);
    expect(doses.length).toBe(2);
    const diffMs = doses[1].getTime() - doses[0].getTime();
    expect(diffMs).toBe(24 * 3600 * 1000);
  });
});
