import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';

export interface SubmitState {
  submitting: boolean;
  /** Form-level message (network failures, invalid credentials, ...). */
  formError: string | null;
  /** Per-field messages returned by the server's VALIDATION_ERROR response. */
  serverFieldErrors: Record<string, string>;
}

/**
 * Wraps an async form action with loading state and error normalization.
 * Ignores re-entrant calls while a submission is running (double taps).
 */
export function useSubmit() {
  const [state, setState] = useState<SubmitState>({ submitting: false, formError: null, serverFieldErrors: {} });
  const running = useRef(false);

  const submit = useCallback(async (action: () => Promise<void>): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setState({ submitting: true, formError: null, serverFieldErrors: {} });
    try {
      await action();
      setState((prev) => ({ ...prev, submitting: false }));
      return true;
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError(0, 'UNEXPECTED', 'Something went wrong. Please try again.');
      const serverFieldErrors = Object.fromEntries(
        Object.entries(apiError.details ?? {}).flatMap(([field, messages]) => (messages[0] ? [[field, messages[0]]] : [])),
      );
      setState({
        submitting: false,
        formError: Object.keys(serverFieldErrors).length ? null : apiError.message,
        serverFieldErrors,
      });
      return false;
    } finally {
      running.current = false;
    }
  }, []);

  const clearErrors = useCallback(() => setState((prev) => ({ ...prev, formError: null, serverFieldErrors: {} })), []);

  return { ...state, submit, clearErrors };
}
