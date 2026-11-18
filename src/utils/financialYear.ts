export interface FyMonth {
  month: number; // 1-12
  year: number;  // calendar year of that month
}

// Financial year starts in April. Nov 2026 -> 2026, Feb 2027 -> 2026
export function currentFyStart(from: Date = new Date()): number {
  return from.getMonth() >= 3 ? from.getFullYear() : from.getFullYear() - 1;
}

// 2026 -> "2026-27"
export function fyLabel(start: number): string {
  return `${start}-${String(start + 1).slice(-2)}`;
}

// April, May ... December, January, February, March
export function fyMonths(start: number): FyMonth[] {
  return [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(month => ({
    month,
    year: month >= 4 ? start : start + 1,
  }));
}
