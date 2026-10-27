import * as Device from 'expo-device';
import { env } from '@/shared/config/env';

/** "Pixel 8": shown under Settings > Devices for the session this phone signs in with. */
const DEVICE_NAME = (Device.modelName ?? Device.deviceName ?? '').replace(/[^\w .()'-]/g, '').slice(0, 100);

const REQUEST_TIMEOUT_MS = 15_000;

export type FieldErrors = Record<string, string[]>;

/** Every failed request surfaces as an ApiError with a stable `code` the UI can branch on. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: FieldErrors };
}

/**
 * Supplied by the auth store so the client can attach and renew tokens without
 * importing the store (which itself depends on this client).
 */
export interface SessionHandlers {
  getAccessToken(): Promise<string | null>;
  /** Returns a new access token, or null when the session is gone. */
  refreshAccessToken(): Promise<string | null>;
  onSessionExpired(): void;
}

let sessionHandlers: SessionHandlers | null = null;

export function registerSessionHandlers(handlers: SessionHandlers): void {
  sessionHandlers = handlers;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the access token and transparently refresh it once if it has expired. */
  authenticated?: boolean;
  /** Overrides the 15 s default for requests that do a lot of work (finishing a match). */
  timeoutMs?: number;
}

async function send<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(DEVICE_NAME ? { 'X-Device-Name': DEVICE_NAME } : {}),
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach ProjectX. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // Non-JSON body (e.g. a proxy error page); handled below.
  }

  if (response.ok && envelope?.success) return envelope.data as T;
  const error = envelope?.error;
  throw new ApiError(
    response.status,
    error?.code ?? 'UNKNOWN_ERROR',
    error?.message ?? 'Something went wrong. Please try again.',
    error?.details,
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!options.authenticated) return send<T>(path, options, null);
  if (!sessionHandlers) throw new Error('Session handlers are not registered');

  const token = await sessionHandlers.getAccessToken();
  try {
    return await send<T>(path, options, token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (error.code !== 'ACCESS_TOKEN_EXPIRED') {
      sessionHandlers.onSessionExpired();
      throw error;
    }
    const refreshed = await sessionHandlers.refreshAccessToken();
    if (!refreshed) throw error;
    return send<T>(path, options, refreshed);
  }
}
