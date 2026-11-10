import * as SecureStore from 'expo-secure-store';
import { useGameClock } from './clock.store';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  useGameClock.setState({ clocks: {} });
  store.clear();
  jest.useFakeTimers({ now: 1_000_000 });
});
afterEach(() => jest.useRealTimers());

describe('game clock store', () => {
  it('hands out a fresh, stopped clock per match and period', () => {
    expect(useGameClock.getState().get('m1', 1, 600, 24)).toEqual({ period: 1, left: 600, shot: 24, runningSince: null });
  });

  it('starts, runs and pauses, and saves every change', () => {
    const c = useGameClock.getState();
    c.toggle('m1', 1, 600, 24);
    expect(useGameClock.getState().clocks.m1).toEqual({ period: 1, left: 600, shot: 24, runningSince: 1_000_000 });
    jest.setSystemTime(1_030_000);
    c.toggle('m1', 1, 600, 24);
    expect(useGameClock.getState().clocks.m1).toEqual({ period: 1, left: 570, shot: 0, runningSince: null });
    expect(JSON.parse(store.get('projectx.clock.m1')!)).toEqual({ period: 1, left: 570, shot: 0, runningSince: null });
  });

  it('pause does nothing to a stopped or unknown clock', () => {
    useGameClock.getState().pause('nope');
    expect(useGameClock.getState().clocks).toEqual({});
  });

  it('resets the shot clock without touching the game clock', () => {
    const c = useGameClock.getState();
    c.toggle('m1', 1, 600, 24);
    jest.setSystemTime(1_010_000);
    c.shot('m1', 1, 600, 14);
    jest.setSystemTime(1_015_000);
    c.pause('m1');
    expect(useGameClock.getState().clocks.m1).toMatchObject({ left: 585, shot: 9 });
  });

  it('a new period replaces the old clock', () => {
    const c = useGameClock.getState();
    c.toggle('m1', 1, 600, 24);
    expect(c.get('m1', 2, 600, 24)).toEqual({ period: 2, left: 600, shot: 24, runningSince: null });
  });

  it('restores a saved clock once, and ignores corrupt or missing values', async () => {
    store.set('projectx.clock.m1', JSON.stringify({ period: 3, left: 258, shot: 18, runningSince: null }));
    store.set('projectx.clock.bad', '{not json');
    store.set('projectx.clock.odd', JSON.stringify({ hello: 1 }));
    await useGameClock.getState().restore('m1');
    await useGameClock.getState().restore('bad');
    await useGameClock.getState().restore('odd');
    await useGameClock.getState().restore('none');
    expect(useGameClock.getState().clocks).toEqual({ m1: { period: 3, left: 258, shot: 18, runningSince: null } });
    // Already in memory: a stale saved copy does not overwrite it.
    store.set('projectx.clock.m1', JSON.stringify({ period: 1, left: 1, shot: 1, runningSince: null }));
    await useGameClock.getState().restore('m1');
    expect(useGameClock.getState().clocks.m1?.left).toBe(258);
  });
});
