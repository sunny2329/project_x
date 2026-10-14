import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { matchApi } from '../api/match.api';
import type { MatchDetail, ScoreEvent } from '../types';

/** How often a spectator's screen refreshes a live match. */
const WATCH_INTERVAL_MS = 4_000;
/** Errors after which the screen should show the server's latest score. */
const RELOAD_ON = new Set(['STALE_MATCH', 'MATCH_OVER', 'MATCH_NOT_LIVE', 'MATCH_NOT_FINISHED']);

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Loads a match and exposes the scorer's actions. Actions run one at a time (a second tap while
 * one is in flight is ignored) and send the version the scorer saw, so nothing is counted twice.
 * Spectators get the live score by polling while the screen is focused.
 */
export function useMatch(id: string) {
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const matchRef = useRef<MatchDetail | null>(null);
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
    async (action: (version: number) => Promise<{ match: MatchDetail }>): Promise<boolean> => {
      const current = matchRef.current;
      if (!current || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        const response = await action(current.version);
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
    score: (event: ScoreEvent) => run((version) => matchApi.score(id, event, version)),
    undo: () => run((version) => matchApi.undo(id, version)),
    finish: () => run((version) => matchApi.finish(id, version)),
    abandon: () => run(() => matchApi.abandon(id)),
  };
}
