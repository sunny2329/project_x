import { initialsOf } from '@/shared/components/Avatar';
import { formatActivityTime, formatDuration, formatRelativeTime, timeOfDay } from '@/shared/utils/time';

describe('formatRelativeTime', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it('uses short relative units within a week', () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe('just now');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe('3h ago');
    expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe('2d ago');
  });

  it('falls back to a date after a week, with the year only when different', () => {
    expect(formatRelativeTime('2026-09-12T12:00:00.000Z', now)).toBe('12 Sep');
    expect(formatRelativeTime('2025-03-01T12:00:00.000Z', now)).toBe('1 Mar 2025');
  });
});

describe('initialsOf', () => {
  it('takes first and last initials, or two letters of a single word', () => {
    expect(initialsOf('Rahul Kumar Sharma')).toBe('RS');
    expect(initialsOf('testuser')).toBe('TE');
    expect(initialsOf('  ')).toBe('?');
  });
});

describe('formatActivityTime', () => {
  const now = new Date(2026, 9, 5, 15, 0);

  it('says Today / Yesterday with a 12-hour clock', () => {
    expect(formatActivityTime(new Date(2026, 9, 5, 6, 34).toISOString(), now)).toBe('Today at 6:34 AM');
    expect(formatActivityTime(new Date(2026, 9, 4, 21, 5).toISOString(), now)).toBe('Yesterday at 9:05 PM');
    expect(formatActivityTime(new Date(2026, 9, 5, 0, 7).toISOString(), now)).toBe('Today at 12:07 AM');
  });

  it('uses the date before that, with the year only when different', () => {
    expect(formatActivityTime(new Date(2026, 8, 12, 12, 0).toISOString(), now)).toBe('12 Sep at 12:00 PM');
    expect(formatActivityTime(new Date(2025, 2, 1, 7, 0).toISOString(), now)).toBe('1 Mar 2025 at 7:00 AM');
  });
});

describe('timeOfDay', () => {
  it('names the part of the day', () => {
    expect(timeOfDay(new Date(2026, 9, 5, 6).toISOString())).toBe('Morning');
    expect(timeOfDay(new Date(2026, 9, 5, 13).toISOString())).toBe('Afternoon');
    expect(timeOfDay(new Date(2026, 9, 5, 19).toISOString())).toBe('Evening');
    expect(timeOfDay(new Date(2026, 9, 5, 23).toISOString())).toBe('Night');
  });
});

describe('formatDuration', () => {
  it('shows the two largest units', () => {
    expect(formatDuration(2973)).toBe('49m 33s');
    expect(formatDuration(4500)).toBe('1h 15m');
    expect(formatDuration(42)).toBe('42s');
  });
});
