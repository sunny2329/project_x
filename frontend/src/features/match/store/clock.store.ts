import { kv } from '@/shared/storage/kv';
import { create } from 'zustand';
import { clockNow, pauseClock, resetShot, startClock, type ClockState } from '../basketball';

/**
 * Basketball game and shot clocks. They run on the scorer's phone only (the server gets the
 * reading with every play), one per match, saved so leaving the screen or closing the app keeps
 * where the clock stood. A clock for an earlier period is replaced by a fresh one.
 */
interface ClockStore {
  clocks: Record<string, ClockState>;
  /** The match's clock for `period`, or a fresh, stopped one of `seconds` / `shot`. */
  get(matchId: string, period: number, seconds: number, shot: number): ClockState;
  toggle(matchId: string, period: number, seconds: number, shot: number): void;
  pause(matchId: string): void;
  shot(matchId: string, period: number, seconds: number, shotSeconds: number): void;
  restore(matchId: string): Promise<void>;
}

const keyOf = (matchId: string) => `projectx.clock.${matchId}`;

function save(matchId: string, clock: ClockState) {
  void kv.set(keyOf(matchId), JSON.stringify(clock)).catch(() => undefined);
}

export const useGameClock = create<ClockStore>((set, get) => {
  const current = (matchId: string, period: number, seconds: number, shot: number): ClockState => {
    const c = get().clocks[matchId];
    return c && c.period === period ? c : { period, left: seconds, shot, runningSince: null };
  };
  const put = (matchId: string, clock: ClockState) => {
    set({ clocks: { ...get().clocks, [matchId]: clock } });
    save(matchId, clock);
  };
  return {
    clocks: {},
    get: current,
    toggle(matchId, period, seconds, shot) {
      const c = current(matchId, period, seconds, shot);
      const now = Date.now();
      put(matchId, clockNow(c, now).running ? pauseClock(c, now) : startClock(c, now));
    },
    pause(matchId) {
      const c = get().clocks[matchId];
      if (c?.runningSince) put(matchId, pauseClock(c, Date.now()));
    },
    shot(matchId, period, seconds, shotSeconds) {
      put(matchId, resetShot(current(matchId, period, seconds, shotSeconds), Date.now(), shotSeconds));
    },
    async restore(matchId) {
      if (get().clocks[matchId]) return;
      const saved = await kv.get(keyOf(matchId)).catch(() => null);
      if (!saved) return;
      try {
        const clock = JSON.parse(saved) as ClockState;
        if (typeof clock.period === 'number' && typeof clock.left === 'number') set({ clocks: { ...get().clocks, [matchId]: clock } });
      } catch {
        // A corrupt value: start from a fresh clock.
      }
    },
  };
});
