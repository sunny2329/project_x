import { PRESETS } from '../basketball';
import type { LineupPlayer } from '../lineup';
import type { SportSummary } from '../types';
import { freshHoops, useMatchDraft } from './draft.store';

jest.mock('expo-router', () => ({ router: {} }));

const sport = {
  id: 9,
  slug: 'basketball',
  name: 'Basketball',
  formats: [
    { code: '3v3', name: '3v3', minPerSide: 1, maxPerSide: 12 },
    { code: '5v5', name: '5v5', minPerSide: 1, maxPerSide: 12 },
  ],
  rulesets: [{ id: 'r1', slug: '3v3-21', isDefault: true, scoringModel: 'baskets', config: { mode: 'target', playersOnCourt: 3 } }],
} as unknown as SportSummary;
const player = (key: string): LineupPlayer => ({ key, displayName: `Player ${key}`, isGuest: true, userId: null, input: { guest: { displayName: key } } });
const keys = (side: number) => useMatchDraft.getState().lineup[side]!.map((p) => p.key);

beforeEach(() => {
  useMatchDraft.getState().reset();
  useMatchDraft.getState().start(sport, null, null);
});

describe('basketball draft', () => {
  it('starts on the 3v3 quick start with default names and colours', () => {
    const { hoops, formatCode } = useMatchDraft.getState();
    expect(formatCode).toBe('3v3');
    expect(hoops).toEqual(freshHoops());
    expect(hoops.setup).toEqual(PRESETS[3]);
    expect(hoops.names).toEqual(['Team A', 'Team B']);
    expect(hoops.tagPlayers).toBe(true);
  });

  it('takes up to 12 a side (starters plus subs), never the same player twice', () => {
    const d = useMatchDraft.getState();
    for (let i = 0; i < 14; i += 1) d.add(0, player(`a${i}`));
    d.add(1, player('a0'));
    expect(keys(0)).toHaveLength(12);
    expect(keys(1)).toEqual([]);
  });

  it('sets, clears and auto-fills shirt numbers per team', () => {
    const d = useMatchDraft.getState();
    ['a', 'b', 'c'].forEach((k) => d.add(0, player(k)));
    ['x', 'y'].forEach((k) => d.add(1, player(k)));
    d.setJersey('a', 1);
    d.setJersey('x', 1);
    d.setJersey('b', 7);
    d.setJersey('b', null);
    d.autoJerseys();
    // Each team fills its own gaps: team B may reuse #1's neighbours freely.
    expect(useMatchDraft.getState().hoops.jerseys).toEqual({ a: 1, b: 2, c: 3, x: 1, y: 2 });
  });

  it('swaps a starter with a bench player on one side only, ignoring unknown keys', () => {
    const d = useMatchDraft.getState();
    ['a', 'b', 'c', 'd'].forEach((k) => d.add(0, player(k)));
    d.swap(0, 'a', 'd');
    expect(keys(0)).toEqual(['d', 'b', 'c', 'a']);
    d.swap(1, 'b', 'c');
    d.swap(0, 'b', 'zzz');
    expect(keys(0)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('keeps setup choices with setHoops, and clears them on reset', () => {
    const d = useMatchDraft.getState();
    d.setHoops({ setup: PRESETS[5], names: ['Mavericks', 'Warriors'], tagPlayers: false });
    expect(useMatchDraft.getState().hoops).toMatchObject({ setup: PRESETS[5], names: ['Mavericks', 'Warriors'], tagPlayers: false, colors: freshHoops().colors });
    d.reset();
    expect(useMatchDraft.getState().hoops).toEqual(freshHoops());
  });

  it('restores a rematch with its teams, or fresh choices when none are given', () => {
    const hoops = { ...freshHoops(), names: ['A1', 'B1'] as [string, string], jerseys: { a: 4 } };
    useMatchDraft.getState().restore({ sport, formatCode: '3v3', rulesetId: 'r1', lineup: [[player('a')], [player('b')]], firstServer: 0, hoops });
    expect(useMatchDraft.getState().hoops).toEqual(hoops);
    useMatchDraft.getState().restore({ sport, formatCode: '3v3', rulesetId: 'r1', lineup: [[], []], firstServer: 0 });
    expect(useMatchDraft.getState().hoops).toEqual(freshHoops());
  });
});
