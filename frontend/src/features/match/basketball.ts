/*
 * Basketball, app side: the setup screen's choices and how they become `baskets` rules, team
 * colours and shirt numbers, and everything the live, break, box score, timeline and spectator
 * screens derive from the engine's `ScoreSummary.game`. Pure functions only (tested in
 * basketball.test.ts); the screens live in components/basketball and screens/Basketball*.
 */
import type { GameDetail, MatchView, PlayEntry, PlayerLine, RulesetOption, ScoreSummary, SportSummary } from './types';

// ------------------------------------------------------------------------------------------
// Setup ("Basketball · match setup")
// ------------------------------------------------------------------------------------------

export type HoopsSize = 3 | 4 | 5;
export type HoopsCourt = 'half' | 'full';
export type HoopsMode = 'score' | 'time';
/** Periods: 4 quarters, 2 halves, one game. */
export type HoopsFormat = 'q' | 'h' | 'one';
/** Points per basket: "1 · 2" or "1 · 2 · 3". */
export type HoopsPoints = '12' | '123';

export interface HoopsSetup {
  size: HoopsSize;
  court: HoopsCourt;
  mode: HoopsMode;
  target: number;
  fmt: HoopsFormat;
  mins: number;
  pts: HoopsPoints;
}

/** The three QUICK START cards. */
export const PRESETS: Record<HoopsSize, HoopsSetup> = {
  3: { size: 3, court: 'half', mode: 'score', target: 21, fmt: 'one', mins: 10, pts: '12' },
  4: { size: 4, court: 'half', mode: 'time', target: 21, fmt: 'h', mins: 10, pts: '12' },
  5: { size: 5, court: 'full', mode: 'time', target: 21, fmt: 'q', mins: 10, pts: '123' },
};

export const MIN_MINUTES = 4;
export const MAX_MINUTES = 20;
/** First-to games end anyway after this many minutes. */
export const TIME_LIMIT = 10;

/** True when every field a preset sets matches (the target only matters for first-to games). */
export function isPreset(s: HoopsSetup, size: HoopsSize): boolean {
  const p = PRESETS[size];
  return s.size === p.size && s.court === p.court && s.mode === p.mode && s.fmt === p.fmt && s.mins === p.mins && s.pts === p.pts && (p.mode === 'time' || s.target === p.target);
}

/** Choosing 5 a side moves to full court; switching a 5v5 to Timed makes it quarters. */
export function pickSize(s: HoopsSetup, size: HoopsSize): HoopsSetup {
  return { ...s, size, ...(size === 5 ? { court: 'full' as const } : {}) };
}

export function pickMode(s: HoopsSetup, mode: HoopsMode): HoopsSetup {
  return mode === 'time' ? { ...s, mode, fmt: s.fmt === 'one' && s.size === 5 ? 'q' : s.fmt } : { ...s, mode };
}

export const clampMinutes = (mins: number) => Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, mins));

const periodsOf = (fmt: HoopsFormat) => (fmt === 'q' ? 4 : fmt === 'h' ? 2 : 1);
const periodWord = (fmt: HoopsFormat) => (fmt === 'q' ? 'quarter' : fmt === 'h' ? 'half' : 'game');

/** The `baskets` ruleset config the setup describes (sent as rulesOverride). */
export function configFromSetup(s: HoopsSetup, tagPlayers: boolean, firstPossession: 0 | 1 = 0): Record<string, unknown> {
  const five = s.size === 5;
  return {
    mode: s.mode === 'score' ? 'target' : 'timed',
    target: s.target,
    winBy: 1,
    timeLimitMinutes: TIME_LIMIT,
    periods: periodsOf(s.fmt),
    periodMinutes: s.mins,
    overtimeMinutes: 5,
    threePointers: s.pts === '123',
    playersOnCourt: s.size,
    court: s.court,
    shotClock: s.court === 'half' ? 12 : 24,
    teamFoulLimit: five ? 5 : 7,
    teamFoulsPer: five && s.mode === 'time' ? 'period' : 'game',
    foulOutAt: five ? 5 : 0,
    timeouts: five ? 2 : 1,
    timeoutsPer: five && s.mode === 'time' && s.fmt !== 'one' ? 'half' : 'game',
    stopClock: false,
    tagPlayers,
    firstPossessionSideIndex: firstPossession,
  };
}

/** Back from a played config (rematch, "Change" on Enter a result). */
export function setupFromConfig(config: Record<string, unknown>): HoopsSetup {
  const n = (k: string, d: number) => (typeof config[k] === 'number' ? (config[k] as number) : d);
  const size = Math.max(3, Math.min(5, n('playersOnCourt', 3))) as HoopsSize;
  const periods = n('periods', 4);
  return {
    size,
    court: config.court === 'full' ? 'full' : 'half',
    mode: config.mode === 'timed' ? 'time' : 'score',
    target: n('target', 21),
    fmt: periods === 4 ? 'q' : periods === 2 ? 'h' : 'one',
    mins: clampMinutes(n('periodMinutes', 10)),
    pts: config.threePointers === true ? '123' : '12',
  };
}

export interface SetupRows {
  pointsNote: string;
  shotClock: string;
  foulLimit: string;
  timeouts: string;
  summaryTitle: string;
  summary: string;
}

/** The read-only rows and the blue summary box under the choices. */
export function setupRows(s: HoopsSetup): SetupRows {
  const periods = periodsOf(s.fmt);
  const points = s.pts === '12' ? '1 and 2 pointers' : '1, 2 and 3 pointers';
  const five = s.size === 5;
  return {
    pointsNote: s.pts === '12' ? 'Inside the arc 1, outside 2, free throw 1' : 'Inside 2, outside 3, free throw 1',
    shotClock: s.court === 'half' ? '12 s' : '24 s',
    foulLimit: five ? (s.mode === 'time' ? `5 a ${periodWord(s.fmt)}` : '5 a game') : '7 a game',
    timeouts: five ? (s.mode === 'time' && s.fmt !== 'one' ? '2 a half' : '2 a game') : '1 each',
    summaryTitle: `${s.size}v${s.size} · ${s.court === 'half' ? 'half court' : 'full court'}`,
    summary:
      s.mode === 'score'
        ? `First to ${s.target} wins · ${TIME_LIMIT} min limit · ${points}`
        : `${periods > 1 ? `${periods} ${s.fmt === 'q' ? 'quarters' : 'halves'} of ${s.mins} min` : `One ${s.mins} min game`} · running clock · ${points}`,
  };
}

/** "3v3 · half court · first to 21" / "5v5 · full court · 4 × 10 min". */
export function setupLine(s: HoopsSetup): string {
  const how = s.mode === 'score' ? `first to ${s.target}` : periodsOf(s.fmt) > 1 ? `${periodsOf(s.fmt)} × ${s.mins} min` : `one ${s.mins} min game`;
  return `${s.size}v${s.size} · ${s.court} court · ${how}`;
}

/** The ruleset to start from: first-to games build on 3v3, timed ones on 5v5 (every field is overridden anyway). */
export function baseRuleset(sport: Pick<SportSummary, 'rulesets'>, s: HoopsSetup): RulesetOption | null {
  const slug = s.mode === 'score' ? '3v3-21' : '5v5-quarters';
  return sport.rulesets.find((r) => r.slug === slug) ?? sport.rulesets.find((r) => r.isDefault) ?? sport.rulesets[0] ?? null;
}

export const formatCode = (s: HoopsSetup) => `${s.size}v${s.size}`;

// ------------------------------------------------------------------------------------------
// Teams, colours and shirt numbers
// ------------------------------------------------------------------------------------------

/** Jersey colours offered per team (first = default). */
export const TEAM_COLORS: [string[], string[]] = [
  ['#3B82F6', '#F43F5E', '#10B981'],
  ['#F2EDE7', '#FACC15', '#0A0A0A'],
];
export const DEFAULT_NAMES: [string, string] = ['Team A', 'Team B'];

/** Dark or white text on a jersey colour. */
export function inkOn(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#0A0A0A' : '#FFFFFF';
}

/** "BLUE" / "WHITE": the word on the 5v5 team header. */
export function colorWord(hex: string): string {
  const words: Record<string, string> = { '#3B82F6': 'BLUE', '#F43F5E': 'RED', '#10B981': 'GREEN', '#F2EDE7': 'WHITE', '#FACC15': 'YELLOW', '#0A0A0A': 'BLACK' };
  return words[hex.toUpperCase()] ?? '';
}

export type Jerseys = Record<string, number | null | undefined>;

/** "#4 is already taken on this team", or null. */
export function jerseyClash(keys: string[], jerseys: Jerseys, key: string, value: number): boolean {
  return keys.some((k) => k !== key && jerseys[k] === value);
}

/** "No jerseys? Give everyone a number (1, 2, 3…)": fills the gaps with the lowest free numbers. */
export function autoNumbers(keys: string[], jerseys: Jerseys): Jerseys {
  const used = new Set(keys.map((k) => jerseys[k]).filter((n): n is number => typeof n === 'number'));
  const out: Jerseys = { ...jerseys };
  let next = 1;
  for (const k of keys) {
    if (typeof out[k] === 'number') continue;
    while (used.has(next)) next += 1;
    out[k] = next;
    used.add(next);
  }
  return out;
}

/** Types a digit into the 2-digit number buffer ("0" is replaced, never more than 2 digits). */
export function pressDigit(buffer: string, digit: string): string {
  if (buffer.length >= 2) return buffer;
  return buffer === '0' ? digit : buffer + digit;
}

/** On-court spots on the half-court drawing, in % of its width / height. */
export const SPOTS: Record<number, [number, number][]> = {
  1: [[50, 70]],
  2: [
    [30, 55],
    [70, 55],
  ],
  3: [
    [50, 70],
    [20, 40],
    [80, 40],
  ],
  4: [
    [30, 72],
    [70, 72],
    [22, 35],
    [78, 35],
  ],
  5: [
    [50, 80],
    [15, 52],
    [85, 52],
    [29, 22],
    [71, 22],
  ],
};

// ------------------------------------------------------------------------------------------
// The clock
// ------------------------------------------------------------------------------------------

/** "6:12" (3v3) or "06:12" (5v5 scoreboard, `pad`). */
export function formatClock(seconds: number, pad = false): string {
  const t = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${pad && m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

interface ClockRules {
  mode?: unknown;
  timeLimitMinutes?: unknown;
  periods?: unknown;
  periodMinutes?: unknown;
  overtimeMinutes?: unknown;
  shotClock?: unknown;
  threePointers?: unknown;
  court?: unknown;
  teamFoulLimit?: unknown;
  foulOutAt?: unknown;
  tagPlayers?: unknown;
  playersOnCourt?: unknown;
  timeoutsPer?: unknown;
  teamFoulsPer?: unknown;
  stopClock?: unknown;
  target?: unknown;
}

export interface HoopsRules {
  timed: boolean;
  target: number;
  periods: number;
  shotClock: number;
  threePointers: boolean;
  half: boolean;
  teamFoulLimit: number;
  foulOutAt: number;
  tagPlayers: boolean;
  onCourt: number;
  timeoutsPer: 'half' | 'game';
  teamFoulsPer: 'period' | 'game';
  stopClock: boolean;
  /** Seconds in a period: the time limit, a period, or overtime. */
  periodSeconds(period: number): number;
}

export function hoopsRules(config: unknown): HoopsRules {
  const c = (config ?? {}) as ClockRules;
  const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
  const timed = c.mode === 'timed';
  const periods = num(c.periods, 4);
  return {
    timed,
    target: num(c.target, 21),
    periods: timed ? periods : 1,
    shotClock: num(c.shotClock, 24),
    threePointers: c.threePointers === true,
    half: c.court === 'half',
    teamFoulLimit: num(c.teamFoulLimit, 5),
    foulOutAt: num(c.foulOutAt, 0),
    tagPlayers: c.tagPlayers !== false,
    onCourt: num(c.playersOnCourt, 5),
    timeoutsPer: c.timeoutsPer === 'game' ? 'game' : 'half',
    teamFoulsPer: c.teamFoulsPer === 'game' ? 'game' : 'period',
    stopClock: c.stopClock === true,
    periodSeconds: (period: number) => {
      if (!timed) return num(c.timeLimitMinutes, TIME_LIMIT) * 60;
      return (period > periods ? num(c.overtimeMinutes, 5) : num(c.periodMinutes, 10)) * 60;
    },
  };
}

/** A running clock: seconds left now, from where it stood when started. */
export interface ClockState {
  period: number;
  /** Seconds left when last started or paused. */
  left: number;
  shot: number;
  /** ms epoch it was started, or null while paused. */
  runningSince: number | null;
}

export function clockNow(c: ClockState, now: number): { left: number; shot: number; running: boolean } {
  if (c.runningSince === null) return { left: c.left, shot: c.shot, running: false };
  const gone = (now - c.runningSince) / 1000;
  const left = Math.max(0, c.left - gone);
  return { left, shot: Math.max(0, c.shot - gone), running: left > 0 };
}

export function pauseClock(c: ClockState, now: number): ClockState {
  const { left, shot } = clockNow(c, now);
  return { ...c, left, shot, runningSince: null };
}

export function startClock(c: ClockState, now: number): ClockState {
  return c.left <= 0 ? c : { ...c, runningSince: now };
}

export function resetShot(c: ClockState, now: number, seconds: number): ClockState {
  const { left } = clockNow(c, now);
  return c.runningSince === null ? { ...c, shot: seconds } : { ...c, left, shot: seconds, runningSince: now };
}

// ------------------------------------------------------------------------------------------
// Players and plays
// ------------------------------------------------------------------------------------------

export interface Roster {
  index: number;
  name: string;
  first: string;
  number: number | null;
  isGuest: boolean;
}

export function roster(match: Pick<MatchView, 'sides'>, side: number): Roster[] {
  return (match.sides[side]?.players ?? []).map((p, index) => ({
    index,
    name: p.displayName,
    first: p.displayName.split(' ')[0] ?? p.displayName,
    number: p.jerseyNumber ?? null,
    isGuest: p.isGuest,
  }));
}

/** "#7 Arjun", or "Arjun" without a number. */
export const tagName = (p: Pick<Roster, 'number' | 'first'> | undefined) => (p ? (p.number === null ? p.first : `#${p.number} ${p.first}`) : 'Team');

/** Short team name for callouts: the last word ("Pink City Ballers" -> "Ballers"). */
export function shortTeam(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? words.at(-1)! : name;
}

const POINT_WORDS: Record<number, string> = { 1: '1', 2: '2', 3: '3' };

/** One play in words, as the play-by-play and the "Last play" line show it. */
export function playText(play: PlayEntry, rosters: [Roster[], Roster[]], teamNames: string[], opts: { threes: boolean } = { threes: true }): string {
  const side = play.sideIndex ?? 0;
  const who = play.playerIndex === null ? null : rosters[side]?.[play.playerIndex];
  const team = shortTeam(teamNames[side] ?? '');
  switch (play.kind) {
    case 'score': {
      const shot = play.points === 3 ? 'three-pointer' : play.points === 1 ? (opts.threes ? 'free throw' : '+1') : opts.threes ? '2 points' : '+2';
      const assist = play.assistIndex === null ? '' : ` · ast ${rosters[side]?.[play.assistIndex]?.number !== null && rosters[side]?.[play.assistIndex] ? `#${rosters[side]![play.assistIndex]!.number}` : (rosters[side]?.[play.assistIndex]?.first ?? '')}`;
      return `${who ? tagName(who) : team} ${who ? shot : `+${POINT_WORDS[play.points ?? 1]}`}${assist}`;
    }
    case 'foul':
      return `Foul${play.foulKind && play.foulKind !== 'personal' ? ` (${play.foulKind})` : ''} · ${who ? tagName(who) : team}${play.fouledOut ? ' · FOULED OUT' : ''}`;
    case 'timeout':
      return `Timeout · ${team}`;
    case 'sub': {
      const into = play.inIndex === null ? null : rosters[side]?.[play.inIndex];
      const out = play.outIndex === null ? null : rosters[side]?.[play.outIndex];
      return `Sub · ${tagName(into ?? undefined)} on, ${tagName(out ?? undefined)} off`;
    }
    case 'period_end':
      return 'Period over';
  }
}

/** The clock part of a play line ("6:20"), or "" without a reading. */
export const playClock = (play: Pick<PlayEntry, 'clock'>, pad = false) => (play.clock === null ? '' : formatClock(play.clock, pad));

/** Points nobody was credited with (the "Skip" taps), per side. */
export function untagged(game: GameDetail, totals: number[]): number[] {
  return [0, 1].map((side) => (totals[side] ?? 0) - (game.players[side] ?? []).reduce((sum, p) => sum + p.points, 0));
}

/** The highest scorer of a side, or null when no basket was credited. */
export function topScorer(game: GameDetail, side: number): PlayerLine | null {
  const lines = game.players[side] ?? [];
  const best = lines.reduce<PlayerLine | null>((top, p) => (p.points > (top?.points ?? 0) ? p : top), null);
  return best && best.points > 0 ? best : null;
}

/** Player of the game: most points plus assists on the winning side (any side if no winner). */
export function playerOfTheGame(game: GameDetail, winner: number | null): { side: number; line: PlayerLine } | null {
  const sides = winner === null ? [0, 1] : [winner];
  let best: { side: number; line: PlayerLine } | null = null;
  for (const side of sides) {
    for (const line of game.players[side] ?? []) {
      const value = line.points + line.assists;
      if (value > 0 && (!best || value > best.line.points + best.line.assists)) best = { side, line };
    }
  }
  return best;
}

/** "26 pts, 4 threes, 5 ast". */
export function statLine(line: PlayerLine): string {
  const parts = [`${line.points} pt${line.points === 1 ? '' : 's'}`];
  if (line.threes) parts.push(`${line.threes} three${line.threes === 1 ? '' : 's'}`);
  if (line.assists) parts.push(`${line.assists} ast`);
  return parts.join(', ');
}

/** "Warriors lead by 4 with one quarter to go" / "Tied going into overtime". */
export function breakLine(score: ScoreSummary, names: string[], rules: Pick<HoopsRules, 'periods'>): string {
  const g = score.game!;
  const [a, b] = [Number(score.sides[0]!.primary), Number(score.sides[1]!.primary)];
  const ended = g.period - 1; // the period that just finished
  const left = rules.periods - ended;
  const lead = a === b ? null : a > b ? 0 : 1;
  if (g.overtime) return lead === null ? 'Tied · overtime next' : `${shortTeam(names[lead]!)} lead by ${Math.abs(a - b)} in overtime`;
  const unit = rules.periods === 4 ? 'quarter' : 'half';
  const togo = left <= 0 ? '' : left === 1 ? ` with one ${unit} to go` : ` with ${left} ${unit}s to go`;
  if (lead === null) return `Tied${togo}`;
  return `${shortTeam(names[lead]!)} lead by ${Math.abs(a - b)}${togo}`;
}

/** Shown in the foul sheet when the selected player or team is about to cross a limit. */
export function foulWarning(player: { name: string; number: number | null; fouls: number }, teamFouls: number, rules: Pick<HoopsRules, 'foulOutAt' | 'teamFoulLimit' | 'periods' | 'teamFoulsPer' | 'timed'>): string | null {
  const parts: string[] = [];
  const label = `${player.number === null ? '' : `#${player.number} `}${player.name}`;
  if (rules.foulOutAt > 0 && player.fouls + 1 >= rules.foulOutAt) parts.push(`${label} has ${player.fouls} fouls. This one fouls them out.`);
  if (teamFouls + 1 === rules.teamFoulLimit) {
    const window = rules.teamFoulsPer === 'game' || !rules.timed ? 'this game' : rules.periods === 4 ? 'this quarter' : rules.periods === 2 ? 'this half' : 'this game';
    parts.push(`It is also the team’s ${ordinal(rules.teamFoulLimit)} foul ${window}, so every foul from now gives free throws.`);
  }
  return parts.length ? parts.join(' ') : null;
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

// ------------------------------------------------------------------------------------------
// Typed-in result check ("Basketball · enter result later")
// ------------------------------------------------------------------------------------------

export function checkHoopsResult(a: number, b: number, rules: Pick<HoopsRules, 'timed' | 'target' | 'threePointers'>, names: string[]): { ok: boolean; text: string } {
  if (a === b) return { ok: false, text: 'A game can’t end tied. Check the score.' };
  const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
  const winner = shortTeam(names[a > b ? 0 : 1]!);
  if (rules.timed) return { ok: true, text: `${winner} win ${hi}–${lo}. Looks right.` };
  const T = rules.target;
  const over = rules.threePointers ? 2 : 1;
  if (hi < T) return { ok: true, text: `Nobody reached ${T}, so this ended on the ${TIME_LIMIT} minute limit. That’s allowed.` };
  if (lo >= T) return { ok: false, text: `Both teams can’t reach ${T}. The game ends as soon as one team gets there.` };
  if (hi > T + over) return { ok: false, text: `The game stops at ${T}. A last basket can take it to ${T + over} at most.` };
  return { ok: true, text: `${winner} win ${hi}–${lo}. Looks right.` };
}

// ------------------------------------------------------------------------------------------
// Game summary (timeline)
// ------------------------------------------------------------------------------------------

export interface FlowStats {
  leadChanges: number;
  ties: number;
  /** Best unanswered run: points and the side, or null. */
  bestRun: { points: number; side: number } | null;
  /** Biggest lead each side had. */
  biggestLead: [number, number];
}

export function flowStats(plays: PlayEntry[]): FlowStats {
  let leader: number | null = null;
  let leadChanges = 0;
  let ties = 0;
  let runSide: number | null = null;
  let run = 0;
  let bestRun: FlowStats['bestRun'] = null;
  const biggest: [number, number] = [0, 0];
  let prev = [0, 0];
  for (const p of plays) {
    if (p.kind !== 'score') continue;
    const [a, b] = p.score as [number, number];
    const now = a === b ? null : a > b ? 0 : 1;
    if (now === null && leader !== null) ties += 1;
    if (now !== null && leader !== null && now !== leader) leadChanges += 1;
    // Through a tie the last leader is kept, so "led, tied, led again" is not a lead change.
    if (now !== null) leader = now;
    biggest[0] = Math.max(biggest[0], a - b);
    biggest[1] = Math.max(biggest[1], b - a);
    const side = p.sideIndex ?? 0;
    const pts = (side === 0 ? a - prev[0]! : b - prev[1]!) || 0;
    run = runSide === side ? run + pts : pts;
    runSide = side;
    if (!bestRun || run > bestRun.points) bestRun = { points: run, side };
    prev = [a, b];
  }
  return { leadChanges, ties, bestRun, biggestLead: biggest };
}

/** Seconds into the game when a play happened (by its clock reading); null without one. */
export function gameTime(play: Pick<PlayEntry, 'period' | 'clock'>, rules: Pick<HoopsRules, 'periodSeconds'>): number | null {
  if (play.clock === null) return null;
  let before = 0;
  for (let p = 1; p < play.period; p += 1) before += rules.periodSeconds(p);
  return before + rules.periodSeconds(play.period) - play.clock;
}

/**
 * Score margin (side 0 minus side 1) through the game as [x 0..1, margin] points. Plays carry
 * clock readings when the scorer ran the clock; otherwise they are spread evenly per period.
 */
export function marginSeries(plays: PlayEntry[], periods: number, rules: Pick<HoopsRules, 'periodSeconds'>): [number, number][] {
  let total = 0;
  for (let p = 1; p <= periods; p += 1) total += rules.periodSeconds(p);
  const points: [number, number][] = [[0, 0]];
  const byPeriod = new Map<number, PlayEntry[]>();
  for (const p of plays) if (p.kind === 'score') byPeriod.set(p.period, [...(byPeriod.get(p.period) ?? []), p]);
  let start = 0;
  for (let period = 1; period <= periods; period += 1) {
    const len = rules.periodSeconds(period);
    const list = byPeriod.get(period) ?? [];
    list.forEach((p, i) => {
      const t = gameTime(p, rules) ?? start + (len * (i + 1)) / (list.length + 1);
      points.push([Math.min(1, t / total), p.score[0]! - p.score[1]!]);
    });
    start += len;
  }
  return points;
}

export type MomentKind = 'tip' | 'pts' | 'to' | 'end' | 'foul' | 'out' | 'run' | 'sub';

export interface Moment {
  key: string;
  period: number;
  clock: string;
  side: number | null;
  kind: MomentKind;
  text: string;
  score: [number, number];
  key_: boolean;
}

/**
 * The timeline: every play in words, plus synthetic lines for scoring runs (8+ unanswered), each
 * flagged as a key moment or not (first points, lead changes, ties, fouling out, runs, period ends).
 */
export function moments(plays: PlayEntry[], rosters: [Roster[], Roster[]], names: string[], periodLabel: (p: number) => string, threes: boolean, finalText: string | null): Moment[] {
  const out: Moment[] = [];
  let leader: number | null = null;
  let runSide: number | null = null;
  let run = 0;
  let runFlagged = false;
  let prev: [number, number] = [0, 0];
  let first = true;
  for (const p of plays) {
    const score = p.score as [number, number];
    const base = { key: String(p.seq), period: p.period, clock: playClock(p, true), side: p.sideIndex, score };
    if (p.kind === 'score') {
      const side = p.sideIndex ?? 0;
      const pts = side === 0 ? score[0] - prev[0] : score[1] - prev[1];
      if (runSide !== side) runFlagged = false;
      run = runSide === side ? run + pts : pts;
      runSide = side;
      const now = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;
      const change = now !== null && leader !== null && now !== leader;
      const tie = now === null;
      let text = playText(p, rosters, names, { threes });
      if (first) text += ' · first points';
      else if (change) text += ` · ${shortTeam(names[now!]!)} lead`;
      else if (tie) text += ' ties it';
      out.push({ ...base, kind: 'pts', text, key_: first || change || tie || p.points === 3 });
      if (run >= 8 && !runFlagged) {
        out.push({ ...base, key: `${p.seq}-run`, kind: 'run', text: `${shortTeam(names[side]!)} ${run}–0 run`, key_: true });
        runFlagged = true;
      }
      if (now !== null) leader = now;
      first = false;
      prev = score;
      continue;
    }
    if (p.kind === 'foul') out.push({ ...base, kind: p.fouledOut ? 'out' : 'foul', text: playText(p, rosters, names, { threes }), key_: p.fouledOut });
    else if (p.kind === 'timeout') out.push({ ...base, kind: 'to', text: playText(p, rosters, names, { threes }), key_: false });
    else if (p.kind === 'sub') out.push({ ...base, kind: 'sub', text: playText(p, rosters, names, { threes }), key_: false });
    else out.push({ ...base, side: null, kind: 'end', text: `End of ${periodLabel(p.period)}`, key_: true });
  }
  if (finalText) {
    const last = plays.at(-1);
    out.push({ key: 'final', period: last?.period ?? 1, clock: '00:00', side: null, kind: 'end', text: finalText, score: (last?.score as [number, number]) ?? [0, 0], key_: true });
  }
  return out;
}

/** Points scored per side in each period ("Q1 18 22"), for tables. */
export function periodColumns(score: ScoreSummary): { label: string; scores: number[]; played: boolean }[] {
  return score.segments.map((s) => ({ label: s.label, scores: s.scores, played: s.complete || s.scores.some((n) => n > 0) }));
}
