export function diffDays(a: string, b: string): number {
  return (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000;
}

export interface StreakRange {
  start: string;
  end: string;
  days: number;
}

export function consecutiveStreakRanges(dates: string[]): StreakRange[] {
  const sorted = [...new Set(dates)].sort();
  const ranges: StreakRange[] = [];
  if (sorted.length === 0) return ranges;
  let runStart = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && diffDays(sorted[i - 1], sorted[i]) === 1) continue;
    const start = runStart;
    const end = sorted[i - 1];
    const days = diffDays(start, end) + 1;
    if (days > 1) ranges.push({ start, end, days });
    runStart = sorted[i];
  }
  return ranges;
}

export function maxConsecutiveStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const ranges = consecutiveStreakRanges(dates);
  return Math.max(...ranges.map((r) => r.days), 1);
}
