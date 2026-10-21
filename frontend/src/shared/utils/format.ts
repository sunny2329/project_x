const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-08" (a calendar date) as a local Date at midnight. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Local YYYY-MM-DD. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "8 Nov". */
export function dayMonth(date: Date | string): string {
  const d = typeof date === 'string' ? (date.length === 10 ? parseDay(date) : new Date(date)) : date;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat 15 Nov". */
export function weekdayDayMonth(date: Date | string): string {
  const d = typeof date === 'string' ? (date.length === 10 ? parseDay(date) : new Date(date)) : date;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sun, 18 Oct". */
export function weekdayComma(date: Date | string): string {
  const d = typeof date === 'string' ? (date.length === 10 ? parseDay(date) : new Date(date)) : date;
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sat 15". */
export function weekdayDay(date: Date | string): string {
  const d = typeof date === 'string' ? (date.length === 10 ? parseDay(date) : new Date(date)) : date;
  return `${DAYS[d.getDay()]} ${d.getDate()}`;
}

/** "8–9 Nov", "30 Nov – 2 Dec", "8 Nov". */
export function dateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const a = parseDay(start);
  if (!end || end === start) return dayMonth(a);
  const b = parseDay(end);
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}` : `${dayMonth(a)} – ${dayMonth(b)}`;
}

/** "Sat 8 – Sun 9 Nov". */
export function longDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const a = parseDay(start);
  if (!end || end === start) return weekdayDayMonth(a);
  const b = parseDay(end);
  return a.getMonth() === b.getMonth() ? `${weekdayDay(a)} – ${weekdayDayMonth(b)}` : `${weekdayDayMonth(a)} – ${weekdayDayMonth(b)}`;
}

/** Every day from start to end (for the schedule's day tabs). */
export function daysBetween(start: string | null, end: string | null): string[] {
  if (!start) return [];
  const out: string[] = [];
  const d = parseDay(start);
  const last = parseDay(end ?? start);
  while (d <= last && out.length < 31) {
    out.push(toDay(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** "9:42". */
export function clock(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "9:00 AM". */
export function clock12(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "7:42 pm". */
export function clockLower(date: Date | string): string {
  return clock12(date).toLowerCase();
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Chat list times: "9:42" today, "Yesterday", "Mon" this week, then "12 Oct". */
export function chatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return clock(d);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return DAYS[d.getDay()]!;
  return dayMonth(d);
}

/** Day separators in a thread: "Today", "Yesterday", "Sunday", "12 Oct". */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  if (now.getTime() - d.getTime() < 6 * 86_400_000) return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]!;
  return dayMonth(d);
}

/** History rows: "Today", "Yesterday", "12 Oct". */
export function shortDay(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return dayMonth(d);
}

/** "5h ago", "2h ago", "just now", then "12 Oct". */
export function ago(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 2 * 86_400_000) return 'yesterday';
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return dayMonth(new Date(iso));
}

/** Comment ages: "4h", "2d". */
export function agoShort(iso: string, now = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return dayMonth(new Date(iso));
}

/** "52 min" / "1h 05m". */
export function minutes(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  const m = Math.max(1, Math.round(seconds / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/** "OCTOBER" section headers. */
export function monthName(iso: string): string {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date(iso).getMonth()]!;
}

/** "Riya Sharma" -> "Riya S". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}` : name;
}

/** "Riya Sharma" -> "Riya". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "+919829041567" -> "+91 98290 41567". */
export function prettyPhone(e164: string): string {
  const m = /^\+(91)(\d{5})(\d{5})$/.exec(e164);
  if (m) return `+${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}

export const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
