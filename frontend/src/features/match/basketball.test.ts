import { createScorer, replay, scoringRegistry } from '@/engine/scoring';
import {
  autoNumbers,
  baseRuleset,
  breakLine,
  checkHoopsResult,
  clampMinutes,
  clockNow,
  colorWord,
  configFromSetup,
  flowStats,
  foulWarning,
  formatClock,
  formatCode,
  gameTime,
  hoopsRules,
  inkOn,
  isPreset,
  jerseyClash,
  marginSeries,
  moments,
  ordinal,
  pauseClock,
  periodColumns,
  pickMode,
  pickSize,
  playerOfTheGame,
  playText,
  pressDigit,
  PRESETS,
  resetShot,
  roster,
  setupFromConfig,
  setupLine,
  setupRows,
  shortTeam,
  startClock,
  statLine,
  tagName,
  topScorer,
  untagged,
  type HoopsSetup,
  type Roster,
} from './basketball';
import { hoopsResultCheck } from './screens/BasketballResultScreen';
import type { GameDetail, MatchView, PlayEntry, ScoreSummary, SportSummary } from './types';

jest.mock('expo-router', () => ({ router: {}, useLocalSearchParams: jest.fn() }));

const NAMES = ['Pink City Ballers', 'Hawa Mahal Hoopers'];
const sides3 = [
  { index: 0, playerCount: 3 },
  { index: 1, playerCount: 3 },
];
const summaryFor = (config: Record<string, unknown>, events: unknown[], sides = sides3) => replay(createScorer(scoringRegistry, 'baskets', config, sides), events).summary as ScoreSummary;
const first = configFromSetup(PRESETS[3], true);
const five = configFromSetup(PRESETS[5], true);
const match = (players: Array<Array<[string, number | null]>>): Pick<MatchView, 'sides'> =>
  ({ sides: players.map((list, index) => ({ index, name: NAMES[index], players: list.map(([displayName, jerseyNumber], i) => ({ playerId: `p${index}${i}`, displayName, jerseyNumber, isGuest: false, userId: null })) })) }) as unknown as Pick<MatchView, 'sides'>;
const team = match([
  [
    ['Arjun Singh', 7],
    ['Kabir Mehta', 11],
    ['Rohan Das', null],
  ],
  [
    ['Dev Patel', 4],
    ['Ishaan Rathore', 9],
    ['Yash Bhatia', 30],
  ],
]);
const rosters: [Roster[], Roster[]] = [roster(team, 0), roster(team, 1)];
const score = (side: number, points: number, extra: Record<string, unknown> = {}) => ({ type: 'score', sideIndex: side, points, ...extra });

describe('setup', () => {
  it('has three quick starts that each match only themselves', () => {
    for (const n of [3, 4, 5] as const) {
      expect(isPreset(PRESETS[n], n)).toBe(true);
      for (const m of [3, 4, 5] as const) if (m !== n) expect(isPreset(PRESETS[n], m)).toBe(false);
    }
  });

  it('a timed preset ignores the target; a first-to preset does not', () => {
    expect(isPreset({ ...PRESETS[5], target: 11 }, 5)).toBe(true);
    expect(isPreset({ ...PRESETS[3], target: 11 }, 3)).toBe(false);
    expect(isPreset({ ...PRESETS[3], mins: 12 }, 3)).toBe(false);
  });

  it('five a side moves to full court; fewer keeps the court', () => {
    expect(pickSize(PRESETS[3], 5).court).toBe('full');
    expect(pickSize({ ...PRESETS[5], court: 'full' }, 4).court).toBe('full');
    expect(pickSize(PRESETS[3], 4)).toEqual({ ...PRESETS[3], size: 4 });
  });

  it('a 5v5 switched to timed plays quarters, other sizes keep their periods', () => {
    expect(pickMode({ ...PRESETS[3], size: 5 }, 'time').fmt).toBe('q');
    expect(pickMode(PRESETS[3], 'time').fmt).toBe('one');
    expect(pickMode(PRESETS[5], 'score')).toEqual({ ...PRESETS[5], mode: 'score' });
  });

  it('clamps minutes to 4..20', () => {
    expect(clampMinutes(1)).toBe(4);
    expect(clampMinutes(4)).toBe(4);
    expect(clampMinutes(20)).toBe(20);
    expect(clampMinutes(99)).toBe(20);
  });

  it('builds configs the engine accepts for every preset and option', () => {
    const setups: HoopsSetup[] = [];
    for (const size of [3, 4, 5] as const)
      for (const mode of ['score', 'time'] as const)
        for (const fmt of ['q', 'h', 'one'] as const)
          for (const pts of ['12', '123'] as const) for (const court of ['half', 'full'] as const) setups.push({ size, mode, fmt, pts, court, target: 15, mins: 8 });
    for (const s of setups) {
      const config = configFromSetup(s, false, 1);
      const sides = [
        { index: 0, playerCount: s.size },
        { index: 1, playerCount: s.size },
      ];
      expect(() => createScorer(scoringRegistry, 'baskets', config, sides)).not.toThrow();
      expect(setupFromConfig(config)).toEqual(s);
    }
  });

  it('sets the 5v5 and small-sided defaults', () => {
    expect(five).toMatchObject({ mode: 'timed', periods: 4, periodMinutes: 10, threePointers: true, shotClock: 24, teamFoulLimit: 5, teamFoulsPer: 'period', foulOutAt: 5, timeouts: 2, timeoutsPer: 'half' });
    expect(first).toMatchObject({ mode: 'target', target: 21, timeLimitMinutes: 10, threePointers: false, shotClock: 12, teamFoulLimit: 7, foulOutAt: 0, timeouts: 1, timeoutsPer: 'game', tagPlayers: true });
  });

  it('reads back a damaged config with safe defaults', () => {
    expect(setupFromConfig({})).toEqual({ size: 3, court: 'half', mode: 'score', target: 21, fmt: 'q', mins: 10, pts: '12' });
    expect(setupFromConfig({ playersOnCourt: 9, periodMinutes: 99 })).toMatchObject({ size: 5, mins: 20 });
  });

  it('describes the setup in words', () => {
    expect(setupLine(PRESETS[3])).toBe('3v3 · half court · first to 21');
    expect(setupLine(PRESETS[5])).toBe('5v5 · full court · 4 × 10 min');
    expect(setupLine({ ...PRESETS[4], fmt: 'one', mins: 12 })).toBe('4v4 · half court · one 12 min game');
    expect(setupRows(PRESETS[5])).toMatchObject({ shotClock: '24 s', foulLimit: '5 a quarter', timeouts: '2 a half', summaryTitle: '5v5 · full court' });
    expect(setupRows(PRESETS[3]).summary).toBe('First to 21 wins · 10 min limit · 1 and 2 pointers');
    expect(setupRows({ ...PRESETS[5], fmt: 'one' }).summary).toBe('One 10 min game · running clock · 1, 2 and 3 pointers');
    expect(formatCode(PRESETS[4])).toBe('4v4');
  });

  it('picks the base ruleset by how the game ends, with fallbacks', () => {
    const rulesets = [
      { id: 'a', slug: '3v3-21', isDefault: true },
      { id: 'b', slug: '5v5-quarters', isDefault: false },
    ] as unknown as SportSummary['rulesets'];
    expect(baseRuleset({ rulesets }, PRESETS[3])?.id).toBe('a');
    expect(baseRuleset({ rulesets }, PRESETS[5])?.id).toBe('b');
    expect(baseRuleset({ rulesets: [rulesets[0]!] }, PRESETS[5])?.id).toBe('a');
    expect(baseRuleset({ rulesets: [] }, PRESETS[5])).toBeNull();
  });
});

describe('teams and shirts', () => {
  it('picks readable ink for every offered colour', () => {
    expect(inkOn('#F2EDE7')).toBe('#0A0A0A');
    expect(inkOn('#FACC15')).toBe('#0A0A0A');
    expect(inkOn('#0A0A0A')).toBe('#FFFFFF');
    expect(colorWord('#3b82f6')).toBe('BLUE');
    expect(colorWord('#123456')).toBe('');
  });

  it('finds a clash only with another player on the same team', () => {
    const jerseys = { a: 7, b: 11, c: null };
    expect(jerseyClash(['a', 'b', 'c'], jerseys, 'c', 7)).toBe(true);
    expect(jerseyClash(['a', 'b', 'c'], jerseys, 'a', 7)).toBe(false);
    expect(jerseyClash(['b', 'c'], jerseys, 'c', 7)).toBe(false);
    expect(jerseyClash(['a', 'b'], jerseys, 'b', 0)).toBe(false);
  });

  it('auto-numbers only the gaps, with the lowest free numbers', () => {
    expect(autoNumbers(['a', 'b', 'c', 'd'], { a: 2, c: 1 })).toEqual({ a: 2, b: 3, c: 1, d: 4 });
    expect(autoNumbers([], { x: 5 })).toEqual({ x: 5 });
    expect(autoNumbers(['a'], { a: null })).toEqual({ a: 1 });
  });

  it('types at most two digits and replaces a lone zero', () => {
    expect(pressDigit('', '0')).toBe('0');
    expect(pressDigit('0', '7')).toBe('7');
    expect(pressDigit('2', '3')).toBe('23');
    expect(pressDigit('23', '4')).toBe('23');
  });

  it('names players with and without numbers', () => {
    expect(rosters[0]![0]).toMatchObject({ index: 0, first: 'Arjun', number: 7 });
    expect(tagName(rosters[0]![2])).toBe('Rohan');
    expect(tagName(rosters[0]![0])).toBe('#7 Arjun');
    expect(tagName(undefined)).toBe('Team');
    expect(shortTeam('Pink City Ballers')).toBe('Ballers');
    expect(shortTeam('Ballers')).toBe('Ballers');
    expect(shortTeam('  Team   A ')).toBe('A');
    expect(roster(team, 5)).toEqual([]);
  });
});

describe('clock', () => {
  const rules3 = hoopsRules(first);
  const rules5 = hoopsRules(five);

  it('formats scoreboard time, rounding up and never below zero', () => {
    expect(formatClock(372)).toBe('6:12');
    expect(formatClock(258, true)).toBe('04:18');
    expect(formatClock(0.2)).toBe('0:01');
    expect(formatClock(-5, true)).toBe('00:00');
  });

  it('knows period lengths, overtime and the first-to time limit', () => {
    expect(rules3.periodSeconds(1)).toBe(600);
    expect(rules3.periods).toBe(1);
    expect(rules5.periodSeconds(4)).toBe(600);
    expect(rules5.periodSeconds(5)).toBe(300);
    expect(hoopsRules(null)).toMatchObject({ timed: false, target: 21, tagPlayers: true });
  });

  it('runs, pauses and resumes from where it stood', () => {
    const c = { period: 1, left: 600, shot: 24, runningSince: null };
    expect(clockNow(c, 5000)).toEqual({ left: 600, shot: 24, running: false });
    const on = startClock(c, 1000);
    expect(clockNow(on, 11_000)).toEqual({ left: 590, shot: 14, running: true });
    const off = pauseClock(on, 11_000);
    expect(off).toEqual({ period: 1, left: 590, shot: 14, runningSince: null });
    expect(clockNow(off, 99_000).left).toBe(590);
  });

  it('stops at zero and will not start an expired clock', () => {
    const on = startClock({ period: 1, left: 5, shot: 24, runningSince: null }, 0);
    expect(clockNow(on, 60_000)).toEqual({ left: 0, shot: 0, running: false });
    const done = { period: 1, left: 0, shot: 0, runningSince: null };
    expect(startClock(done, 0)).toBe(done);
  });

  it('resets the shot clock while running or stopped', () => {
    const on = startClock({ period: 1, left: 600, shot: 24, runningSince: null }, 0);
    const reset = resetShot(on, 10_000, 14);
    expect(clockNow(reset, 10_000)).toMatchObject({ left: 590, shot: 14 });
    expect(resetShot({ period: 1, left: 100, shot: 3, runningSince: null }, 0, 24)).toMatchObject({ shot: 24, left: 100 });
  });
});

describe('plays and stats', () => {
  const s = summaryFor(first, [score(0, 2), { type: 'tag', playerIndex: 0, assistIndex: 1 }, score(1, 1), { type: 'foul', sideIndex: 1, playerIndex: 2, kind: 'shooting' }, score(0, 2), score(0, 1), { type: 'tag', playerIndex: 0 }]);
  const g = s.game!;

  it('writes each play in words', () => {
    expect(playText(g.plays[0]!, rosters, NAMES, { threes: false })).toBe('#7 Arjun +2 · ast #11');
    expect(playText(g.plays[1]!, rosters, NAMES, { threes: false })).toBe('Hoopers +1');
    expect(playText(g.plays[2]!, rosters, NAMES)).toBe('Foul (shooting) · #30 Yash');
    expect(playText(g.plays[4]!, rosters, NAMES, { threes: true })).toBe('#7 Arjun free throw');
    const timeout = { ...g.plays[1]!, kind: 'timeout' } as PlayEntry;
    expect(playText(timeout, rosters, NAMES)).toBe('Timeout · Hoopers');
    const sub = { ...g.plays[1]!, kind: 'sub', inIndex: 2, outIndex: 0, sideIndex: 0 } as PlayEntry;
    expect(playText(sub, rosters, NAMES)).toBe('Sub · Rohan on, #7 Arjun off');
  });

  it('counts untagged points, top scorers and the player of the game', () => {
    expect(untagged(g, [5, 1])).toEqual([2, 1]);
    expect(topScorer(g, 0)?.index).toBe(0);
    expect(topScorer(g, 1)).toBeNull();
    expect(playerOfTheGame(g, 0)).toMatchObject({ side: 0, line: { index: 0, points: 3 } });
    expect(playerOfTheGame(g, 1)).toBeNull();
    expect(playerOfTheGame(g, null)?.side).toBe(0);
  });

  it('writes a stat line with plurals', () => {
    expect(statLine({ index: 0, points: 26, ones: 4, twos: 5, threes: 4, assists: 5, fouls: 2, onCourt: true, fouledOut: false })).toBe('26 pts, 4 threes, 5 ast');
    expect(statLine({ index: 0, points: 1, ones: 1, twos: 0, threes: 0, assists: 0, fouls: 0, onCourt: true, fouledOut: false })).toBe('1 pt');
    expect(statLine({ index: 0, points: 3, ones: 0, twos: 0, threes: 1, assists: 1, fouls: 0, onCourt: true, fouledOut: false })).toBe('3 pts, 1 three, 1 ast');
  });

  it('warns about fouling out and the team limit, in the right window', () => {
    const r5 = hoopsRules(five);
    expect(foulWarning({ name: 'Dev', number: 4, fouls: 4 }, 4, r5)).toBe('#4 Dev has 4 fouls. This one fouls them out. It is also the team’s 5th foul this quarter, so every foul from now gives free throws.');
    expect(foulWarning({ name: 'Dev', number: null, fouls: 1 }, 0, r5)).toBeNull();
    expect(foulWarning({ name: 'Dev', number: null, fouls: 1 }, 6, hoopsRules(first))).toBe('It is also the team’s 7th foul this game, so every foul from now gives free throws.');
    expect(foulWarning({ name: 'Dev', number: null, fouls: 1 }, 4, hoopsRules({ ...five, periods: 2 }))).toContain('this half');
    // No fouling out in 3v3 however many fouls.
    expect(foulWarning({ name: 'Dev', number: null, fouls: 9 }, 0, hoopsRules(first))).toBeNull();
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
  });
});

describe('timed games: break, periods, flow', () => {
  const sides5 = [
    { index: 0, playerCount: 5 },
    { index: 1, playerCount: 5 },
  ];
  const q = (events: unknown[]) => summaryFor(five, events, sides5);

  it('says who leads and how much is left at each break', () => {
    expect(breakLine(q([score(1, 3), score(0, 2), { type: 'period_end' }]), NAMES, hoopsRules(five))).toBe('Hoopers lead by 1 with 3 quarters to go');
    const q3 = q([score(1, 2), { type: 'period_end' }, { type: 'period_end' }, score(1, 2), { type: 'period_end' }]);
    expect(breakLine(q3, NAMES, hoopsRules(five))).toBe('Hoopers lead by 4 with one quarter to go');
    const tied = q([score(0, 2), score(1, 2), { type: 'period_end' }, { type: 'period_end' }, { type: 'period_end' }, { type: 'period_end' }]);
    expect(tied.game!.overtime).toBe(true);
    expect(breakLine(tied, NAMES, hoopsRules(five))).toBe('Tied · overtime next');
    const halves = summaryFor({ ...five, periods: 2 }, [{ type: 'period_end' }], sides5);
    expect(breakLine(halves, NAMES, hoopsRules({ ...five, periods: 2 }))).toBe('Tied with one half to go');
  });

  it('lists period columns, marking unplayed ones', () => {
    const cols = periodColumns(q([score(0, 2), { type: 'period_end' }]));
    expect(cols[0]).toEqual({ label: 'Q1', scores: [2, 0], played: true });
    expect(cols[1]).toMatchObject({ label: 'Q2', played: false });
  });

  it('counts lead changes, ties, runs and biggest leads', () => {
    const s = q([score(0, 2), score(1, 3), score(0, 2), score(0, 2), score(0, 3), score(1, 2), score(1, 2), score(1, 2)]);
    expect(flowStats(s.game!.plays)).toEqual({ leadChanges: 2, ties: 1, bestRun: { points: 7, side: 0 }, biggestLead: [6, 1] });
    expect(flowStats([])).toEqual({ leadChanges: 0, ties: 0, bestRun: null, biggestLead: [0, 0] });
  });

  it('places plays in game time by clock, or spreads them evenly without one', () => {
    const rules = hoopsRules(five);
    expect(gameTime({ period: 2, clock: 300 }, rules)).toBe(900);
    expect(gameTime({ period: 1, clock: null }, rules)).toBeNull();
    const s = q([score(0, 2, { clock: 300 }), score(1, 3), { type: 'period_end' }]);
    const series = marginSeries(s.game!.plays, 4, rules);
    expect(series[0]).toEqual([0, 0]);
    expect(series[1]).toEqual([0.125, 2]);
    expect(series[2]![1]).toBe(-1);
    expect(series[2]![0]).toBeGreaterThan(0);
    expect(series[2]![0]).toBeLessThanOrEqual(0.25);
  });

  it('builds the moments list with key flags, runs and the final line', () => {
    const s = q([score(0, 3), score(0, 3), score(0, 2), score(1, 2), { type: 'timeout', sideIndex: 1 }, { type: 'period_end' }]);
    const list = moments(s.game!.plays, rosters, NAMES, (p) => `Q${p}`, true, 'Final · Ballers win');
    expect(list.map((m) => m.kind)).toEqual(['pts', 'pts', 'pts', 'run', 'pts', 'to', 'end', 'end']);
    expect(list[0]!.text).toBe('Ballers +3 · first points');
    expect(list[3]!.text).toBe('Ballers 8–0 run');
    expect(list.filter((m) => m.key_).map((m) => m.kind)).toEqual(['pts', 'pts', 'run', 'end', 'end']);
    expect(list.at(-1)).toMatchObject({ text: 'Final · Ballers win', key_: true });
  });
});

describe('typed-in results', () => {
  const rules3 = hoopsRules(first);
  it('gives the design’s messages for first-to games', () => {
    expect(checkHoopsResult(21, 21, rules3, NAMES)).toEqual({ ok: false, text: 'A game can’t end tied. Check the score.' });
    expect(checkHoopsResult(18, 15, rules3, NAMES)).toEqual({ ok: true, text: 'Nobody reached 21, so this ended on the 10 minute limit. That’s allowed.' });
    expect(checkHoopsResult(21, 22, rules3, NAMES).ok).toBe(false);
    expect(checkHoopsResult(24, 18, rules3, NAMES)).toEqual({ ok: false, text: 'The game stops at 21. A last basket can take it to 22 at most.' });
    expect(checkHoopsResult(22, 18, rules3, NAMES)).toEqual({ ok: true, text: 'Ballers win 22–18. Looks right.' });
    expect(checkHoopsResult(23, 18, hoopsRules({ ...first, threePointers: true }), NAMES).ok).toBe(true);
  });

  it('accepts any untied timed score', () => {
    expect(checkHoopsResult(81, 78, hoopsRules(five), NAMES)).toEqual({ ok: true, text: 'Ballers win 81–78. Looks right.' });
    expect(checkHoopsResult(0, 2, hoopsRules(five), NAMES).text).toBe('Hoopers win 2–0. Looks right.');
  });

  it('runs the engine check too, so the server will accept it', () => {
    expect(hoopsResultCheck(0, 0, first, NAMES, [3, 3])).toEqual({ ok: false, text: 'Enter the final score.' });
    expect(hoopsResultCheck(21, 17, first, NAMES, [3, 3]).ok).toBe(true);
    expect(hoopsResultCheck(9, 4, first, NAMES, [3, 1]).ok).toBe(true);
    expect(hoopsResultCheck(81, 78, five, NAMES, [5, 7]).ok).toBe(true);
    expect(hoopsResultCheck(21, 21, first, NAMES, [3, 3]).ok).toBe(false);
  });
});

it('the game detail is shaped as the screens expect', () => {
  const g: GameDetail = summaryFor(first, []).game!;
  expect(g).toMatchObject({ period: 1, periodLabel: 'Game', periods: 1, overtime: false, clock: null, possessionSideIndex: 0, suddenDeath: false });
  expect(g.teams).toHaveLength(2);
  expect(g.players.map((p) => p.length)).toEqual([3, 3]);
});
