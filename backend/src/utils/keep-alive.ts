import type { Logger } from 'pino';

/**
 * Render's free plan stops an instance after 15 minutes without inbound requests, and the next
 * request then waits ~50 s for a cold start. The server keeps itself awake by requesting its own
 * public URL (through Render's proxy, so it counts as traffic) every few minutes.
 *
 * Only inside a daily window: free instance hours are shared by every free service in the Render
 * workspace (750 h/month), and staying awake 24/7 would use ~744 h of them on its own.
 */

/** A daily window in whole hours of a fixed UTC offset; `end` may be past midnight (e.g. 6-1). */
export interface KeepAliveWindow {
  startHour: number;
  endHour: number;
  utcOffsetMinutes: number;
}

/** Parses "6-24" or "7-1" (start hour inclusive, end hour exclusive, 0-24). Equal hours = all day. */
export function parseWindow(value: string, utcOffsetMinutes: number): KeepAliveWindow {
  const match = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/.exec(value);
  if (!match) throw new Error(`Invalid keep-alive window "${value}", expected e.g. "6-24"`);
  const startHour = Number(match[1]);
  const endHour = Number(match[2]);
  if (startHour > 23 || endHour > 24) throw new Error(`Invalid keep-alive window "${value}": hours are 0-24`);
  return { startHour, endHour: endHour % 24, utcOffsetMinutes };
}

export function isWithinWindow(at: Date, window: KeepAliveWindow): boolean {
  const minutesOfDay = (((at.getUTCHours() * 60 + at.getUTCMinutes() + window.utcOffsetMinutes) % 1440) + 1440) % 1440;
  const start = window.startHour * 60;
  const end = window.endHour * 60;
  if (start === end) return true;
  return start < end ? minutesOfDay >= start && minutesOfDay < end : minutesOfDay >= start || minutesOfDay < end;
}

export interface KeepAliveOptions {
  /** Public base URL of this server, e.g. Render's RENDER_EXTERNAL_URL. */
  baseUrl: string;
  window: KeepAliveWindow;
  intervalMs?: number;
  logger: Pick<Logger, 'debug' | 'warn' | 'info'>;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/** Starts pinging `${baseUrl}/health`; returns a function that stops it. */
export function startKeepAlive({
  baseUrl,
  window,
  intervalMs = 10 * 60_000,
  logger,
  fetchFn = fetch,
  now = () => new Date(),
}: KeepAliveOptions): () => void {
  const url = `${baseUrl.replace(/\/+$/, '')}/health`;

  const tick = async (): Promise<void> => {
    if (!isWithinWindow(now(), window)) return;
    try {
      const response = await fetchFn(url, { signal: AbortSignal.timeout(30_000), headers: { 'user-agent': 'project-x-keep-alive' } });
      if (response.ok) logger.debug('Keep-alive ping ok');
      else logger.warn({ status: response.status }, 'Keep-alive ping got a non-2xx response');
    } catch (error) {
      logger.warn({ err: error }, 'Keep-alive ping failed');
    }
  };

  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  logger.info({ url, window: `${window.startHour}-${window.endHour}` }, 'Keep-alive pings enabled');
  return () => clearInterval(timer);
}
