import { rulesName, scoringRegistry } from '@/engine/scoring';
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
  if (ruleset.scoringModel === 'overs') return `${num(c, 'ballsPerOver') ?? 6} balls an over · super over if tied`;
  if (ruleset.scoringModel === 'baskets') {
    const court = c.court === 'half' ? 'Half court' : 'Full court';
    const pts = c.threePointers === true ? '1, 2 and 3 pointers' : '1 and 2 pointers';
    return [court, pts, c.mode === 'timed' ? `${num(c, 'overtimeMinutes') ?? 5} min overtime if tied` : 'next basket wins if tied at time'].join(' · ');
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
  if (r.scoringModel === 'baskets') return `${sport.formats.map((f) => f.name).join(' · ')} · half or full court`;
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

/** A number in a ruleset a scorer or organizer may change; `fallback` is the engine default when the ruleset leaves it out. */
export interface EditableRule {
  key: string;
  label: string;
  min: number;
  max: number;
  odd?: boolean;
  fallback?: number;
  /** Only offered when the rules use it (basketball: the target only in first-to games). */
  when?: (config: Config) => boolean;
}

const firstTo = (c: Config) => c.mode !== 'timed';
const timedGame = (c: Config) => c.mode === 'timed';

/** Per scoring model, the rules the "Change a rule" sheet offers. */
export const EDITABLE_RULES: Record<string, EditableRule[]> = {
  rally: [
    { key: 'pointsToWin', label: 'Points to win', min: 5, max: 50 },
    { key: 'winBy', label: 'Win by', min: 1, max: 5 },
    { key: 'cap', label: 'Cap', min: 5, max: 60 },
    { key: 'bestOf', label: 'Best of', min: 1, max: 7, odd: true },
  ],
  side_out: [
    { key: 'pointsToWin', label: 'Points to win', min: 5, max: 30 },
    { key: 'winBy', label: 'Win by', min: 1, max: 5 },
    { key: 'bestOf', label: 'Best of', min: 1, max: 5, odd: true },
  ],
  overs: [
    { key: 'playersPerSide', label: 'Players a side', min: 1, max: 11, fallback: 11 },
    { key: 'overs', label: 'Overs', min: 1, max: 50 },
    { key: 'wickets', label: 'Wickets', min: 1, max: 11 },
    { key: 'ballsPerOver', label: 'Balls an over', min: 1, max: 10, fallback: 6 },
    { key: 'wideRuns', label: 'Runs for a wide', min: 0, max: 2, fallback: 1 },
    { key: 'noBallRuns', label: 'Runs for a no-ball', min: 0, max: 2, fallback: 1 },
    { key: 'superOverOvers', label: 'Super over: overs', min: 1, max: 5, fallback: 1 },
    { key: 'superOverWickets', label: 'Super over: wickets', min: 1, max: 11, fallback: 2 },
  ],
  baskets: [
    { key: 'target', label: 'Points to win', min: 5, max: 100, fallback: 21, when: firstTo },
    { key: 'timeLimitMinutes', label: 'Time limit (min)', min: 1, max: 60, fallback: 10, when: firstTo },
    { key: 'periodMinutes', label: 'Minutes a period', min: 1, max: 20, fallback: 10, when: timedGame },
    { key: 'overtimeMinutes', label: 'Overtime (min)', min: 1, max: 10, fallback: 5, when: timedGame },
    { key: 'teamFoulLimit', label: 'Team foul limit', min: 1, max: 15, fallback: 5 },
    { key: 'foulOutAt', label: 'Fouls to foul out (0 = never)', min: 0, max: 10, fallback: 0 },
    { key: 'timeouts', label: 'Timeouts', min: 0, max: 10, fallback: 2 },
  ],
  tennis: [
    { key: 'bestOf', label: 'Best of (sets)', min: 1, max: 5, odd: true },
    { key: 'setGames', label: 'Games per set', min: 1, max: 8 },
    { key: 'tiebreakAt', label: 'Tiebreak at', min: 1, max: 8 },
    { key: 'tiebreakPoints', label: 'Tiebreak to', min: 5, max: 15 },
  ],
};

/** The rules the sheet offers for these rules as they stand. */
export function editableRules(scoringModel: string, config: Config): EditableRule[] {
  return (EDITABLE_RULES[scoringModel] ?? []).filter((r) => !r.when || r.when(config));
}

/** Cricket wickets can't outnumber the players a side (last man stands = as many as players). */
const PLAYER_BOUND = new Set(['wickets', 'superOverWickets']);

/** The value a rule shows: the change, else the ruleset's, else the engine default. */
export function ruleValue(rule: EditableRule, config: Config): number {
  const raw = config[rule.key];
  if (typeof raw === 'number') return raw;
  // No cap set yet: start from points-to-win + 9 (21 -> 30, as in badminton).
  if (rule.key === 'cap') return Number(config.pointsToWin ?? 21) + 9;
  return rule.fallback ?? rule.min;
}

/** Highest allowed value right now (wickets follow the players a side). */
export function ruleMax(scoringModel: string, rule: EditableRule, config: Config): number {
  if (scoringModel === 'overs' && PLAYER_BOUND.has(rule.key)) return Math.min(rule.max, num(config, 'playersPerSide') ?? 11);
  return rule.max;
}

/**
 * The override after one rule changes. Fewer players a side pulls the wickets down with it, so the
 * sheet never builds rules the engine refuses.
 */
export function changeRule(scoringModel: string, base: Config, override: Record<string, number>, key: string, value: number): Record<string, number> {
  const next = { ...override, [key]: value };
  if (scoringModel === 'overs' && key === 'playersPerSide') {
    for (const rule of EDITABLE_RULES.overs!.filter((r) => PLAYER_BOUND.has(r.key))) {
      if (ruleValue(rule, { ...base, ...next }) > value) next[rule.key] = value;
    }
  }
  return next;
}

/** The rules' name with the changes in it ("5 overs · 4 wickets · 6 a side"), or "<name> · changed". */
export function rulesTitle(ruleset: Pick<RulesetOption, 'name' | 'scoringModel' | 'config'>, override: Record<string, number>): string {
  const changed = Object.keys(override).length > 0;
  const described = rulesName(scoringRegistry, ruleset.scoringModel, { ...ruleset.config, ...override }, null);
  if (described) return described;
  return changed ? `${ruleset.name} · changed` : ruleset.name;
}

/** Rules a played match changed from its ruleset (for a rematch with the same rules). */
export function overrideFrom(scoringModel: string, rulesetConfig: Config, played: unknown): Record<string, number> {
  const p = (played ?? {}) as Config;
  const out: Record<string, number> = {};
  for (const rule of EDITABLE_RULES[scoringModel] ?? []) {
    const value = p[rule.key];
    if (typeof value !== 'number') continue;
    const base = typeof rulesetConfig[rule.key] === 'number' ? rulesetConfig[rule.key] : rule.fallback;
    if (value !== base) out[rule.key] = value;
  }
  return out;
}

/** Most players a side may list: the format's limit, lowered by a rule such as "6 a side". */
export function maxPlayersPerSide(formatMax: number, config: Config): number {
  const cap = num(config, 'playersPerSide');
  return cap ? Math.min(formatMax, cap) : formatMax;
}
