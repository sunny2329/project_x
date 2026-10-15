import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { matchApi } from '../api/match.api';
import { newClientEventId } from '../format';
import type { MatchView, PluginEvent } from '../types';

/** How often a spectator's screen refreshes a live match. */
const WATCH_INTERVAL_MS = 4_000;
/** Errors after which the screen should show the server's latest score. */
const RELOAD_ON = new Set(['STALE_MATCH', 'MATCH_OVER', 'MATCH_NOT_LIVE', 'MATCH_NOT_FINISHED', 'NOT_PENDING']);

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Loads a match and exposes the scorer's actions. Actions run one at a time (a second tap while
 * one is in flight is ignored), send the version the scorer saw and a client event id, so
 * nothing is ever counted twice. Spectators poll while the screen is focused.
 */
export function useMatch(id: string) {
  const [match, setMatch] = useState<MatchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const matchRef = useRef<MatchView | null>(null);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const load = useCallback(async () => {
    try {
      const response = await matchApi.get(id);
      setMatch(response.match);
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    }
  }, [id]);

  const run = useCallback(
    async (action: (current: MatchView) => Promise<{ match: MatchView }>): Promise<boolean> => {
      const current = matchRef.current;
      if (!current || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        const response = await action(current);
        setMatch(response.match);
        setError(null);
        return true;
      } catch (e) {
        if (e instanceof ApiError && RELOAD_ON.has(e.code)) await load();
        setError(messageOf(e));
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [load],
  );

  useEffect(() => {
    let cancelled = false;
    matchApi.get(id).then(
      (response) => {
        if (cancelled) return;
        setMatch(response.match);
        setError(null);
      },
      (e: unknown) => {
        if (!cancelled) setError(messageOf(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const watching = match?.status === 'live' && !match.canScore;
  useFocusEffect(
    useCallback(() => {
      if (!watching) return undefined;
      const timer = setInterval(() => void load(), WATCH_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [watching, load]),
  );

  return {
    match,
    error,
    busy,
    reload: load,
    score: (event: PluginEvent) => run((m) => matchApi.score(id, event, m.version, newClientEventId())),
    undo: () => run((m) => matchApi.undo(id, m.version)),
    complete: () => run((m) => matchApi.complete(id, m.version)),
    retire: (retiredSideIndex: number) => run((m) => matchApi.retire(id, m.version, retiredSideIndex)),
    abandon: () => run(() => matchApi.abandon(id)),
    confirm: (decision: 'confirmed' | 'disputed', comment?: string) => run(() => matchApi.confirm(id, decision, comment)),
  };
}
