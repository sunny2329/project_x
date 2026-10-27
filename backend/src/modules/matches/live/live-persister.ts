import type { Logger } from 'pino';
import type { LiveStore, PersistJob } from './live-store.js';

const RETRY_MS = 3_000;
/** Jobs written per transaction: a backlog (fast tapping, a slow database) catches up in one go. */
const BATCH = 100;

/**
 * Writes queued live-scoring jobs to Postgres, strictly in order per match. A job leaves the
 * queue only after it is committed, and writing one twice is harmless, so nothing is lost if the
 * process dies mid-way: `resume()` at startup picks up where it stopped.
 */
export class LivePersister {
  private readonly running = new Map<string, Promise<void>>();
  /** Matches that got a new job since their drain loop last looked. */
  private readonly dirty = new Set<string>();

  constructor(
    private readonly store: LiveStore,
    /** Writes jobs (oldest first) in one transaction. */
    private readonly write: (matchId: string, jobs: PersistJob[]) => Promise<void>,
    private readonly logger?: Pick<Logger, 'error'>,
  ) {}

  /** Drains the match's queue; resolves once it is empty. Rejects if a write fails (it is retried later). */
  async flush(matchId: string): Promise<void> {
    // A job queued while a drain loop was finishing may have joined that loop too late: go again.
    do {
      this.dirty.add(matchId);
      await this.run(matchId);
    } while (await this.store.peekJob(matchId));
  }

  /** Fire-and-forget flush after a new job. */
  kick(matchId: string): void {
    this.flush(matchId).catch(() => undefined);
  }

  /** Drains every match that still has queued jobs (after a restart). */
  async resume(): Promise<void> {
    const matchIds = await this.store.pendingMatches();
    await Promise.allSettled(matchIds.map((id) => this.flush(id)));
  }

  private run(matchId: string): Promise<void> {
    const current = this.running.get(matchId);
    if (current) return current;
    let failed = false;
    const loop = (async () => {
      try {
        while (this.dirty.delete(matchId)) {
          for (let jobs = await this.store.peekJobs(matchId, BATCH); jobs.length; jobs = await this.store.peekJobs(matchId, BATCH)) {
            await this.write(matchId, jobs);
            await this.store.ackJobs(matchId, jobs.length);
          }
        }
      } catch (error) {
        failed = true;
        this.logger?.error({ err: error, matchId }, 'Could not save live score to the database; retrying');
        setTimeout(() => this.kick(matchId), RETRY_MS).unref();
        throw error;
      } finally {
        this.running.delete(matchId);
        if (!failed && this.dirty.has(matchId)) this.kick(matchId);
      }
    })();
    this.running.set(matchId, loop);
    return loop;
  }
}
