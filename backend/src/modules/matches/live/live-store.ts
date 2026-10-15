import type { Redis } from 'ioredis';
import type { MatchStatic, MatchStatusName } from '../matches.types.js';

/** One scoring event as the live store keeps it (the Postgres id is not needed to replay). */
export interface LiveEvent {
  sequence: number;
  /** The plugin event type ("rally_won" ...). */
  type: string;
  sideIndex: number | null;
  /** The full plugin event, as validated by the plugin's eventSchema. */
  payload: Record<string, unknown>;
  clientEventId: string | null;
  occurredAt: string;
  voided: boolean;
}

/** Everything needed to serve and score a live match without touching Postgres. */
export interface LiveState {
  /** Bumped by every event and every undo; clients send it back to detect stale views. */
  version: number;
  match: {
    id: string;
    status: MatchStatusName;
    scoringModel: string;
    /** The ruleset snapshot (matches.ruleset_config). */
    rulesetConfig: unknown;
    startedAt: string | null;
    /** Users allowed to score besides the creator (assigned scorers, organizers). */
    scorerUserIds: string[];
    view: MatchStatic;
  };
  events: LiveEvent[];
}

/** A change waiting to be written to Postgres, in order. */
export type PersistJob = { kind: 'event'; event: LiveEvent; actorUserId: string } | { kind: 'undo'; sequence: number; actorUserId: string };

export type CommitResult = 'ok' | 'stale' | 'missing';

export interface LiveStore {
  get(matchId: string): Promise<LiveState | null>;
  getMany(matchIds: string[]): Promise<Map<string, LiveState>>;
  /** Caches a state loaded from Postgres unless another request cached one first; returns the cached one. */
  prime(state: LiveState): Promise<LiveState>;
  /** Atomically: if the cached version is `expectedVersion`, store `next` and queue `job` for Postgres. */
  commit(expectedVersion: number, next: LiveState, job: PersistJob): Promise<CommitResult>;
  /** The oldest job not yet written to Postgres. */
  peekJob(matchId: string): Promise<PersistJob | null>;
  /** Removes the oldest job once it is in Postgres. */
  ackJob(matchId: string): Promise<void>;
  /** Matches with jobs still queued (used to resume after a restart). */
  pendingMatches(): Promise<string[]>;
  /** Forgets a match (it ended); only call once its queue is empty. */
  drop(matchId: string): Promise<void>;
}

/** Live state stays cached a day after the last change; ended matches are dropped explicitly. */
const STATE_TTL_SECONDS = 24 * 60 * 60;

const keys = {
  state: (id: string) => `live:match:${id}`,
  version: (id: string) => `live:version:${id}`,
  queue: (id: string) => `live:queue:${id}`,
  pending: 'live:pending',
};

// KEYS: state, version, queue, pending. ARGV: expected version, next state JSON, next version, job JSON, ttl, match id.
const COMMIT_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if not current then return 'missing' end
if tonumber(current) ~= tonumber(ARGV[1]) then return 'stale' end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[5])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[5])
redis.call('RPUSH', KEYS[3], ARGV[4])
redis.call('SADD', KEYS[4], ARGV[6])
return 'ok'`;

// KEYS: state, version. ARGV: state JSON, version, ttl. Returns the cached state JSON (existing or new).
const PRIME_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing and redis.call('EXISTS', KEYS[2]) == 1 then return existing end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return ARGV[1]`;

export class RedisLiveStore implements LiveStore {
  constructor(private readonly redis: Redis) {}

  async get(matchId: string): Promise<LiveState | null> {
    const raw = await this.redis.get(keys.state(matchId));
    return raw ? (JSON.parse(raw) as LiveState) : null;
  }

  async getMany(matchIds: string[]): Promise<Map<string, LiveState>> {
    if (!matchIds.length) return new Map();
    const raws = await this.redis.mget(matchIds.map(keys.state));
    const found = new Map<string, LiveState>();
    raws.forEach((raw, i) => {
      if (raw) found.set(matchIds[i]!, JSON.parse(raw) as LiveState);
    });
    return found;
  }

  async prime(state: LiveState): Promise<LiveState> {
    const id = state.match.id;
    const raw = (await this.redis.eval(PRIME_SCRIPT, 2, keys.state(id), keys.version(id), JSON.stringify(state), state.version, STATE_TTL_SECONDS)) as string;
    return JSON.parse(raw) as LiveState;
  }

  async commit(expectedVersion: number, next: LiveState, job: PersistJob): Promise<CommitResult> {
    const id = next.match.id;
    return (await this.redis.eval(
      COMMIT_SCRIPT,
      4,
      keys.state(id),
      keys.version(id),
      keys.queue(id),
      keys.pending,
      expectedVersion,
      JSON.stringify(next),
      next.version,
      JSON.stringify(job),
      STATE_TTL_SECONDS,
      id,
    )) as CommitResult;
  }

  async peekJob(matchId: string): Promise<PersistJob | null> {
    const raw = await this.redis.lindex(keys.queue(matchId), 0);
    return raw ? (JSON.parse(raw) as PersistJob) : null;
  }

  async ackJob(matchId: string): Promise<void> {
    const remaining = await this.redis.multi().lpop(keys.queue(matchId)).llen(keys.queue(matchId)).exec();
    if (remaining?.[1]?.[1] === 0) await this.redis.srem(keys.pending, matchId);
  }

  pendingMatches(): Promise<string[]> {
    return this.redis.smembers(keys.pending);
  }

  async drop(matchId: string): Promise<void> {
    await this.redis.del(keys.state(matchId), keys.version(matchId));
  }
}

/** Single-process stand-in with the same semantics, used when REDIS_URL is not set (and in tests). */
export class MemoryLiveStore implements LiveStore {
  private readonly states = new Map<string, string>();
  private readonly queues = new Map<string, PersistJob[]>();

  get(matchId: string): Promise<LiveState | null> {
    const raw = this.states.get(matchId);
    return Promise.resolve(raw ? (JSON.parse(raw) as LiveState) : null);
  }

  async getMany(matchIds: string[]): Promise<Map<string, LiveState>> {
    const found = new Map<string, LiveState>();
    for (const id of matchIds) {
      const state = await this.get(id);
      if (state) found.set(id, state);
    }
    return found;
  }

  prime(state: LiveState): Promise<LiveState> {
    const existing = this.states.get(state.match.id);
    if (existing) return Promise.resolve(JSON.parse(existing) as LiveState);
    this.states.set(state.match.id, JSON.stringify(state));
    return Promise.resolve(state);
  }

  commit(expectedVersion: number, next: LiveState, job: PersistJob): Promise<CommitResult> {
    const id = next.match.id;
    const raw = this.states.get(id);
    if (!raw) return Promise.resolve('missing');
    if ((JSON.parse(raw) as LiveState).version !== expectedVersion) return Promise.resolve('stale');
    this.states.set(id, JSON.stringify(next));
    this.queues.set(id, [...(this.queues.get(id) ?? []), job]);
    return Promise.resolve('ok');
  }

  peekJob(matchId: string): Promise<PersistJob | null> {
    return Promise.resolve(this.queues.get(matchId)?.[0] ?? null);
  }

  ackJob(matchId: string): Promise<void> {
    const rest = (this.queues.get(matchId) ?? []).slice(1);
    if (rest.length) this.queues.set(matchId, rest);
    else this.queues.delete(matchId);
    return Promise.resolve();
  }

  pendingMatches(): Promise<string[]> {
    return Promise.resolve([...this.queues.keys()]);
  }

  drop(matchId: string): Promise<void> {
    this.states.delete(matchId);
    return Promise.resolve();
  }
}
