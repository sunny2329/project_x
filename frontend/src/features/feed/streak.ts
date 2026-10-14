const DAY = 86_400_000;

/** Local midnight of the Monday that starts the week containing `date`. */
function weekStart(date: Date): number {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMonday = (midnight.getDay() + 6) % 7;
  return new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - sinceMonday).getTime();
}

/**
 * Weeks in a row (Monday to Sunday) with at least one match, as in Strava's streak card. The current
 * week counts when it has a match; when it has none yet the streak is still alive from last week.
 */
export function weekStreak(playedAt: string[], now: Date = new Date()): number {
  const weeks = new Set(playedAt.map((iso) => weekStart(new Date(iso))));
  const thisWeek = weekStart(now);
  // Step back a week at a time; 7 days plus a few hours absorbs daylight-saving shifts.
  const previous = (week: number) => weekStart(new Date(week - 3 * DAY));
  let week = weeks.has(thisWeek) ? thisWeek : previous(thisWeek);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = previous(week);
  }
  return streak;
}
