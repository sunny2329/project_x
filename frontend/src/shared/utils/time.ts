const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "just now", "5m ago", "3h ago", "2d ago", then "12 Sep" (or "12 Sep 2025" in another year).
 * Hand-rolled because Intl.RelativeTimeFormat is not reliably available in Hermes.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? dayMonth : `${dayMonth} ${date.getFullYear()}`;
}

function clockTime(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Strava-style activity time: "Today at 6:34 AM", "Yesterday at 9:05 PM", "12 Sep at 7:00 AM" (+ year if not this year). */
export function formatActivityTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  let day: string;
  if (sameDay(date, now)) day = 'Today';
  else if (sameDay(date, yesterday)) day = 'Yesterday';
  else {
    day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
    if (date.getFullYear() !== now.getFullYear()) day += ` ${date.getFullYear()}`;
  }
  return `${day} at ${clockTime(date)}`;
}

/** "Morning" (5–11), "Afternoon" (12–16), "Evening" (17–20), else "Night", for titles like "Morning Pickleball". */
export function timeOfDay(iso: string): string {
  const hour = new Date(iso).getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

/** 2973 -> "49m 33s", 4500 -> "1h 15m", 42 -> "42s". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
