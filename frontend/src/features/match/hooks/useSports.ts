import { useEffect, useState } from 'react';
import { errorMessage } from '@/shared/hooks/useResource';
import { matchApi } from '../api/match.api';
import type { PlayerRef, SportSummary } from '../types';

// The catalogue barely changes; one fetch per app session is enough.
let sportsCache: SportSummary[] | null = null;
let meCache: PlayerRef | null = null;

/** Active sports with their formats and rulesets, plus my own player row (to put me on side A). */
export function useSports() {
  const [sports, setSports] = useState<SportSummary[] | null>(sportsCache);
  const [me, setMe] = useState<PlayerRef | null>(meCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!sportsCache) {
      matchApi.sports().then(
        (r) => {
          sportsCache = r.sports;
          if (!cancelled) setSports(r.sports);
        },
        (e: unknown) => !cancelled && setError(errorMessage(e)),
      );
    }
    if (!meCache) {
      matchApi.me().then(
        (r) => {
          meCache = r.player;
          if (!cancelled) setMe(r.player);
        },
        () => undefined,
      );
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return { sports, me, error };
}

/** Forget the cached player when the account changes. */
export function clearSportsCache() {
  meCache = null;
}
