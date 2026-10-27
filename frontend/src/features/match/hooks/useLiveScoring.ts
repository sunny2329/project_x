import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createScorer, replay, ScoringError, scoringRegistry, type Scorer } from '@/engine/scoring';
import { ApiError } from '@/shared/api/client';
import { matchApi } from '../api/match.api';
import { newClientEventId } from '../format';
import type { MatchView, PluginEvent, ScoreSummary } from '../types';

/** A spectator's screen refreshes every 4 s. */
const WATCH_INTERVAL_MS = 4_000;
const RETRY_MS = 2_000;
/** Finish / retire / walkover wait up to 60 s (in 100 ms steps) for queued points to send. */
const DRAIN_WAIT_STEPS = 600;
/** The server moved on (another scorer, a retry): reload it and resend what's queued. */
const RELOAD_CODES = new Set(['STALE_MATCH']);
/** The tap can't be applied any more: drop the queue and show the server's score. */
const DROP_CODES = new Set(['MATCH_OVER', 'MATCH_NOT_LIVE', 'INVALID_EVENT', 'NOTHING_TO_UNDO', 'NOT_MATCH_SCORER', 'NOT_ALLOWED']);

type Pending = { kind: 'event'; event: PluginEvent; clientEventId: string } | { kind: 'undo' };

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
}

function scorerOf(match: MatchView): Scorer | null {
  try {
    return createScorer(
      scoringRegistry,
      match.ruleset.scoringModel,
      match.rulesetConfig,
      match.sides.map((s) => ({ index: s.index, playerCount: s.players.length })),
    );
  } catch {
    return null;
  }
}

/** Server events with the queued taps and undos applied on top. */
function withPending(events: PluginEvent[], pending: Pending[]): PluginEvent[] {
  const out = [...events];
  for (const p of pending) {
    if (p.kind === 'undo') out.pop();
    else out.push(p.event);
  }
  return out;
}

/**
 * Live scoring with an instant screen: each tap is checked and applied by the same engine the
 * server runs, shown at once, and sent in order with the version it was based on and a client
 * event id (so a retry never counts twice). Spectators poll instead.
 */
export function useLiveScoring(id: string) {
  const [match, setMatch] = useState<MatchView | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const matchRef = useRef<MatchView | null>(null);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const load = useCallback(async () => {
    try {
      const r = await matchApi.get(id);
      matchRef.current = r.match;
      setMatch(r.match);
      setError(null);
      return r.match;
    } catch (e) {
      setError(messageOf(e));
      return null;
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    matchApi.get(id).then(
      (r) => {
        if (cancelled) return;
        setMatch(r.match);
        setError(null);
      },
      (e: unknown) => !cancelled && setError(messageOf(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scorer = useMemo(() => (match ? scorerOf(match) : null), [match?.id, match?.ruleset.scoringModel, match?.rulesetConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  /** What the screen shows: the server's score, or the engine's preview while taps are queued. */
  const display: ScoreSummary | null = useMemo(() => {
    if (!match) return null;
    if (!pending.length || !scorer) return match.score;
    try {
      return replay(scorer, withPending(match.events, pending)).summary as ScoreSummary;
    } catch {
      return match.score;
    }
  }, [match, pending, scorer]);

  // Send the queue one item at a time. `tick` re-runs this after a reload or a failed send.
  const [tick, setTick] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (retryTimer.current && clearTimeout(retryTimer.current)), []);
  useEffect(() => {
    const current = matchRef.current;
    const next = pending[0];
    if (!current || !next || inFlight.current) return;
    inFlight.current = true;
    const send = next.kind === 'undo' ? matchApi.undo(id, current.version) : matchApi.score(id, next.event, current.version, next.clientEventId);
    send
      .then((r) => {
        inFlight.current = false;
        matchRef.current = r.match;
        setMatch(r.match);
        setPending((q) => q.slice(1));
        setOffline(false);
        setError(null);
      })
      .catch(async (e: unknown) => {
        if (e instanceof ApiError && RELOAD_CODES.has(e.code)) {
          // Someone else scored, or a retry landed: resend on top of the server's version.
          await load();
          inFlight.current = false;
          setTick((t) => t + 1);
        } else if (e instanceof ApiError && !e.isNetworkError && (DROP_CODES.has(e.code) || (e.status >= 400 && e.status < 500))) {
          setPending([]);
          setError(e.message);
          await load();
          inFlight.current = false;
        } else {
          // Offline or a server hiccup: keep the taps and try again shortly.
          inFlight.current = false;
          setOffline(true);
          retryTimer.current = setTimeout(() => setTick((t) => t + 1), RETRY_MS);
        }
      });
  }, [pending, tick, id, load]);

  const watching = !!match && match.status === 'live' && !match.canScore;
  useFocusEffect(
    useCallback(() => {
      if (!watching) return undefined;
      const timer = setInterval(() => void load(), WATCH_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [watching, load]),
  );

  const tap = useCallback(
    (event: PluginEvent) => {
      const current = matchRef.current;
      if (!current || !scorer) return;
      setPending((q) => {
        try {
          // Rejects taps the engine won't accept (e.g. after the last point of the match).
          replay(scorer, [...withPending(current.events, q), event]);
        } catch (e) {
          if (e instanceof ScoringError) return q;
          throw e;
        }
        return [...q, { kind: 'event', event, clientEventId: newClientEventId() }];
      });
    },
    [scorer],
  );

  const undo = useCallback(() => {
    const current = matchRef.current;
    if (!current) return;
    setPending((q) => {
      // An unsent tap is simply dropped; otherwise ask the server to undo its last event.
      const last = q[q.length - 1];
      if (last?.kind === 'event' && !(q.length === 1 && inFlight.current)) return q.slice(0, -1);
      if (!withPending(current.events, q).length) return q;
      return [...q, { kind: 'undo' }];
    });
  }, []);

  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  /** Match-level actions wait for the queue to drain, then run once. */
  const action = useCallback(
    async (run: (m: MatchView) => Promise<{ match: MatchView }>): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      try {
        // Wait for every queued point to reach the server, so the action uses its latest version.
        for (let i = 0; i < DRAIN_WAIT_STEPS && (inFlight.current || pendingRef.current.length); i += 1) await new Promise((r) => setTimeout(r, 100));
        if (inFlight.current || pendingRef.current.length) {
          setError('Still saving the last points. Check your connection and try again.');
          return false;
        }
        const current = matchRef.current;
        if (!current) return false;
        const r = await run(current);
        setMatch(r.match);
        setError(null);
        return true;
      } catch (e) {
        setError(messageOf(e));
        if (e instanceof ApiError && RELOAD_CODES.has(e.code)) await load();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, load],
  );

  const eventCount = match ? withPending(match.events, pending).length : 0;

  return {
    match,
    display,
    error,
    offline,
    busy,
    syncing: pending.length > 0,
    /** Points played so far (walkover is only possible at 0). */
    eventCount,
    reload: load,
    tap,
    undo,
    complete: () => action((m) => matchApi.complete(id, m.version)),
    retire: (side: number) => action((m) => matchApi.retire(id, m.version, side)),
    walkover: (winner: number | null, reason: 'walkover' | 'no_show') => action(() => matchApi.walkover(id, winner, reason)),
    abandon: () => action(() => matchApi.abandon(id)),
    addScorer: (userId: string) => action(() => matchApi.addScorer(id, userId)),
  };
}
