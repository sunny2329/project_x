import { describe, expect, it } from 'vitest';
import { LivePersister } from './live-persister.js';
import { MemoryLiveStore, type LiveState, type PersistJob } from './live-store.js';

const seq = (j: PersistJob) => (j.kind === 'event' ? j.event.sequence : j.sequence);

function state(version: number): LiveState {
  return {
    version,
    match: {
      id: 'm1',
      status: 'live',
      scoringModel: 'rally',
      rulesetConfig: { pointsToWin: 21, bestOf: 3 },
      startedAt: new Date(0).toISOString(),
      scorerUserIds: [],
      view: {} as LiveState['match']['view'],
    },
    events: [],
  };
}

const job = (sequence: number): PersistJob => ({
  kind: 'event',
  event: { sequence, type: 'rally_won', sideIndex: 0, payload: { type: 'rally_won', sideIndex: 0 }, clientEventId: null, occurredAt: new Date(0).toISOString(), voided: false },
  actorUserId: 'u1',
});

describe('MemoryLiveStore', () => {
  it('commits only on the expected version and queues the job', async () => {
    const store = new MemoryLiveStore();
    expect(await store.commit(0, state(1), job(1))).toBe('missing');
    await store.prime(state(0));
    expect(await store.commit(5, state(6), job(1))).toBe('stale');
    expect(await store.commit(0, state(1), job(1))).toBe('ok');
    expect((await store.get('m1'))?.version).toBe(1);
    expect(await store.peekJob('m1')).toEqual(job(1));
    expect(await store.pendingMatches()).toEqual(['m1']);
  });

  it('prime keeps the state another request cached first', async () => {
    const store = new MemoryLiveStore();
    await store.prime(state(3));
    expect((await store.prime(state(0))).version).toBe(3);
  });
});

describe('LivePersister', () => {
  it('writes jobs in order and empties the queue', async () => {
    const store = new MemoryLiveStore();
    await store.prime(state(0));
    const written: number[] = [];
    const batches: number[][] = [];
    const persister = new LivePersister(store, async (_id, jobs) => {
      batches.push(jobs.map(seq));
      written.push(...jobs.map(seq));
    });
    for (let i = 1; i <= 3; i += 1) await store.commit(i - 1, state(i), job(i));
    await persister.flush('m1');
    expect(written).toEqual([1, 2, 3]);
    expect(batches).toEqual([[1, 2, 3]]); // a backlog goes in one write
    expect(await store.peekJob('m1')).toBeNull();
    expect(await store.pendingMatches()).toEqual([]);
  });

  it('keeps a failed job queued and writes it on the next flush', async () => {
    const store = new MemoryLiveStore();
    await store.prime(state(0));
    await store.commit(0, state(1), job(1));
    let fail = true;
    const written: number[] = [];
    const persister = new LivePersister(store, async (_id, jobs) => {
      if (fail) throw new Error('db down');
      written.push(...jobs.map(seq));
    });
    await expect(persister.flush('m1')).rejects.toThrow('db down');
    expect(await store.peekJob('m1')).toEqual(job(1));
    fail = false;
    await persister.flush('m1');
    expect(written).toEqual([1]);
  });

  it('picks up a job queued while a drain is running', async () => {
    const store = new MemoryLiveStore();
    await store.prime(state(0));
    await store.commit(0, state(1), job(1));
    const written: number[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const persister = new LivePersister(store, async (_id, jobs) => {
      if (jobs.some((j) => seq(j) === 1)) await gate;
      written.push(...jobs.map(seq));
    });
    const first = persister.flush('m1');
    await store.commit(1, state(2), job(2));
    const second = persister.flush('m1');
    release();
    await Promise.all([first, second]);
    expect(written).toEqual([1, 2]);
  });
});
