import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Loads data for a screen and reloads it whenever the screen comes back into focus (so lists
 * reflect what was just done elsewhere). `poll` refreshes every N ms while focused.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[], options: { poll?: number; enabled?: boolean } = {}) {
  const { poll, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async (mode: 'silent' | 'pull' = 'silent') => {
    if (mode === 'pull') setRefreshing(true);
    try {
      const value = await loader.current();
      if (!mounted.current) return;
      setData(value);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

   
  const key = JSON.stringify(deps);
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      void reload();
      if (!poll) return undefined;
      const timer = setInterval(() => void reload(), poll);
      return () => clearInterval(timer);
    }, [enabled, poll, reload, key]),
  );

  return { data, setData, error, loading: loading && data === null, refreshing, reload: () => reload('silent'), refresh: () => reload('pull') };
}
