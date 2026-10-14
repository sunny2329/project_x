import { useCallback, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { matchApi } from '../api/match.api';
import type { MatchCard } from '../types';

/** Live matches: mine (to resume scoring) and those of players I follow. Call `refresh` on focus. */
export function useLiveMatches() {
  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await matchApi.live();
      setMatches(response.matches);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load live matches.');
    }
  }, []);

  return { matches, error, refresh };
}
