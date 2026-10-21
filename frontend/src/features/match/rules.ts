import type { RulesetOption, SportSummary } from './types';

type Config = Record<string, unknown>;
const num = (c: Config, k: string): number | null => (typeof c[k] === 'number' ? (c[k] as number) : null);
const serveOf = (c: Config) => (c.serve && typeof c.serve === 'object' ? (c.serve as Config) : {});

/** The second line of a rules card: "Win by 2, capped at 30", "Golden point at deuce", "Every rally scores". */
export function rulesetDetail(ruleset: Pick<RulesetOption, 'scoringModel' | 'config'>): string {
  const c = ruleset.config;
  if (ruleset.scoringModel === 'tennis') {
    const parts = [c.deuce === 'golden_point' ? 'Golden point at deuce' : 'Advantage at deuce'];
    if (c.finalSet === 'match_tiebreak') parts.push(`super tiebreak to ${num(c, 'matchTiebreakPoints') ?? 10}`);
    else parts.push(`tiebreak at ${num(c, 'tiebreakAt') ?? 6}-${num(c, 'tiebreakAt') ?? 6}`);
    return parts.join(' · ');
  }
  if (ruleset.scoringModel === 'side_out') return `Only the serving side scores · win by ${num(c, 'winBy') ?? 2}`;
  const winBy = num(c, 'winBy') ?? 2;
  const cap = num(c, 'cap');
  const deciding = num(c, 'decidingGamePoints');
  const parts = [cap ? `Win by ${winBy}, capped at ${cap}` : `Win by ${winBy}`];
  if (deciding) parts.push(`deciding set to ${deciding}`);
  if (serveOf(c).rotation === 'alternate') parts.push(`serve changes every ${num(serveOf(c), 'pointsPerServe') ?? 2}`);
  return parts.join(' · ');
}

/** NewMatchSport's line under each sport: the default rules, shortened ("Best of 3 · 21 points · cap 30"). */
export function sportTagline(sport: SportSummary): string {
  const r = sport.rulesets.find((x) => x.isDefault) ?? sport.rulesets[0];
  if (!r) return sport.formats.map((f) => f.name).join(' · ');
  const cap = num(r.config, 'cap');
  const onlyDoubles = sport.formats.length === 1 && sport.formats[0]!.code === 'doubles';
  return [onlyDoubles ? 'Doubles' : null, r.name, cap ? `cap ${cap}` : null].filter(Boolean).join(' · ');
}

/** The small grey line next to Undo, from the rules. */
export function rulesFooter(scoringModel: string, config: unknown, doubles: boolean): string | null {
  const c = (config ?? {}) as Config;
  if (scoringModel === 'side_out') return doubles ? 'Server 1 → “Second server”\nServer 2 → “Side out”' : 'Receiving side wins a rally → “Side out”';
  if (scoringModel === 'rally') {
    const s = serveOf(c);
    const from = num(s, 'everyPointFrom');
    if (s.rotation === 'alternate' && from) return `From ${from}-${from}, serve changes every point`;
    if (s.courtByScore) return null;
    return `Every rally scores · win by ${num(c, 'winBy') ?? 2}`;
  }
  return null;
}

/**
 * Table tennis: which serve of the turn this is ("1 of 2") and how many more before it changes,
 * from the points played in the game.
 */
export function serveTurn(config: unknown, scores: number[]): { of: number; nth: number; left: number } | null {
  const s = serveOf((config ?? {}) as Config);
  if (s.rotation !== 'alternate') return null;
  const per = num(s, 'pointsPerServe') ?? 1;
  const from = num(s, 'everyPointFrom');
  const [a = 0, b = 0] = scores;
  if (per <= 1 || (from !== null && a >= from && b >= from)) return { of: 1, nth: 1, left: 1 };
  const nth = ((a + b) % per) + 1;
  return { of: per, nth, left: per - nth + 1 };
}

/** Elo with K = 32 on side averages, as backend/src/engine/rating does; the change for side 0. */
export function eloChange(rating0: number, rating1: number, winnerIndex: 0 | 1 | null, k = 32): number {
  const expected0 = 1 / (1 + 10 ** ((rating1 - rating0) / 400));
  const score0 = winnerIndex === null ? 0.5 : winnerIndex === 0 ? 1 : 0;
  return Math.round(k * (score0 - expected0) * 10) / 10;
}
