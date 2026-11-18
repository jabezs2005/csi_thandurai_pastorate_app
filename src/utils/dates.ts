export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Most recent Sunday on or before the given day (today, if today is a Sunday)
export function lastSunday(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - d.getDay());
  return toISODate(d);
}

export function isSunday(iso: string): boolean {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay() === 0;
}

export const todayISO = () => toISODate(new Date());
export const firstOfMonth = (from: Date = new Date()) =>
  toISODate(new Date(from.getFullYear(), from.getMonth(), 1));

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

// Weeks run Sunday to Saturday
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - dt.getDay());
  return toISODate(dt);
}

export const weekEnd = (iso: string) => addDays(weekStart(iso), 6);

// The calendar date (India time) of a saved timestamp
export function istDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export const istDayStartISO = (date: string) => new Date(`${date}T00:00:00+05:30`).toISOString();
export const istDayEndISO = (date: string) => new Date(`${date}T23:59:59.999+05:30`).toISOString();

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// 2026-11-15 -> 15-Nov-2026
export function formatDisplayDate(iso?: string | null): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[3]}-${MONTH_SHORT[Number(m[2]) - 1]}-${m[1]}`;
}

// 2026-11-15 -> Sun 15-Nov-2026
export function formatWithDay(iso?: string | null): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dow = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return `${DAY_SHORT[dow]} ${m[3]}-${MONTH_SHORT[Number(m[2]) - 1]}-${m[1]}`;
}

// 2026-11-15 -> Sun 15-Nov
export function formatDayShort(iso?: string | null): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dow = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
  return `${DAY_SHORT[dow]} ${m[3]}-${MONTH_SHORT[Number(m[2]) - 1]}`;
}