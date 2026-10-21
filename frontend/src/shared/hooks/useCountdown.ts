import { useCallback, useEffect, useState } from 'react';

/** Seconds left before a code can be resent; `restart()` after sending one. */
export function useCountdown(seconds = 60) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  const restart = useCallback(() => setLeft(seconds), [seconds]);
  const label = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return { left, label, restart, done: left <= 0 };
}

/** The value after it stops changing for `ms` (search-as-you-type). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}
