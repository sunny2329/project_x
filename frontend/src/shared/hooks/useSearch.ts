import { useEffect, useRef, useState } from 'react';

/**
 * Search-as-you-type for an already debounced `query`: results for the latest query, keeping the
 * previous ones on screen while the next request is out. Nothing is fetched under `minLength`.
 */
export function useSearch<T>(query: string, search: (q: string) => Promise<T[]>, minLength = 2) {
  const [state, setState] = useState<{ for: string; items: T[] } | null>(null);
  const fn = useRef(search);
  useEffect(() => {
    fn.current = search;
  });
  useEffect(() => {
    if (query.length < minLength) return undefined;
    let cancelled = false;
    fn.current(query).then(
      (items) => !cancelled && setState({ for: query, items }),
      () => !cancelled && setState({ for: query, items: [] }),
    );
    return () => {
      cancelled = true;
    };
  }, [query, minLength]);
  const active = query.length >= minLength;
  return { results: active && state ? state.items : [], loading: active && state?.for !== query, settled: active && state?.for === query };
}

/** True on the render where `visible` flips to true; use it to reset a sheet's form when it opens. */
export function useOpened(visible: boolean): boolean {
  const [was, setWas] = useState(visible);
  if (was !== visible) {
    setWas(visible);
    return visible;
  }
  return false;
}
