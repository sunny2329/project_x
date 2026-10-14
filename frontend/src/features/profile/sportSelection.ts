export interface SportSelection {
  sportIds: string[];
  primarySportId: string | null;
}

/**
 * Adds or removes a sport. The first sport picked becomes primary; removing the primary
 * sport hands primary to the next one left (the backend requires one when any are picked).
 */
export function toggleSport(selection: SportSelection, sportId: string): SportSelection {
  if (selection.sportIds.includes(sportId)) {
    const sportIds = selection.sportIds.filter((id) => id !== sportId);
    const primarySportId = selection.primarySportId === sportId ? (sportIds[0] ?? null) : selection.primarySportId;
    return { sportIds, primarySportId };
  }
  return { sportIds: [...selection.sportIds, sportId], primarySportId: selection.primarySportId ?? sportId };
}

export function makePrimary(selection: SportSelection, sportId: string): SportSelection {
  return selection.sportIds.includes(sportId) ? { ...selection, primarySportId: sportId } : selection;
}

export function sameSelection(a: SportSelection, b: SportSelection): boolean {
  return a.primarySportId === b.primarySportId && a.sportIds.length === b.sportIds.length && a.sportIds.every((id) => b.sportIds.includes(id));
}
