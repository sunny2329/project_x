import { describe, expect, it } from 'vitest';
import { LivePersister } from './live-persister.js';
import { MemoryLiveStore, type LiveState, type PersistJob } from './live-store.js';

function state(version: number): LiveState {
  return {
    version,
    match: {
      id: 'm1',
      sport: { id: '1', code: 'BADMINTON', name: 'Badminton' },
      format: { id: '1', name: 'Singles' },
      createdBy: 'u1',
      statusId: 602,
      startedAt: new Date(0).toISOString(),
      completedAt: null,
      config: { kind: 'rally', periodName: 'Game', pointsToWin: 21, winBy: 2, cap: 30, bestOf: 3, decidingPoints: null },
    },
    sides: [],
    events: [],
    periodStarts: {},
  };
}

const job = (sequenceNo: number): PersistJob => ({ kind: 'event', sequenceNo, typeId: 401, side: 1, data: null, scoreValue: 1, userId: 'u1' });

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
    const persister = new LivePersister(store, async (_id, j) => {
      written.push(j.sequenceNo);
    });
    for (let i = 1; i <= 3; i += 1) await store.commit(i - 1, state(i), job(i));
    await persister.flush('m1');
    expect(written).toEqual([1, 2, 3]);
    expect(await store.peekJob('m1')).toBeNull();
    expect(await store.pendingMatches()).toEqual([]);
  });

  it('keeps a failed job queued and writes it on the next flush', async () => {
    const store = new MemoryLiveStore();
    await store.prime(state(0));
    await store.commit(0, state(1), job(1));
    let fail = true;
    const written: number[] = [];
    const persister = new LivePersister(store, async (_id, j) => {
      if (fail) throw new Error('db down');
      written.push(j.sequenceNo);
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
    const persister = new LivePersister(store, async (_id, j) => {
      if (j.sequenceNo === 1) await gate;
      written.push(j.sequenceNo);
    });
    const first = persister.flush('m1');
    await store.commit(1, state(2), job(2));
    const second = persister.flush('m1');
    release();
    await Promise.all([first, second]);
    expect(written).toEqual([1, 2]);
  });
});
