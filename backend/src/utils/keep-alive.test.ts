import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../config/env.js';
import { isWithinWindow, parseWindow, startKeepAlive } from './keep-alive.js';

const IST = 330;
/** A Date at the given India time on 2026-11-14. */
const ist = (hour: number, minute = 0) => new Date(Date.UTC(2026, 10, 14, hour, minute) - IST * 60_000);

describe('parseWindow', () => {
  it('parses start-end hours, tolerating spaces', () => {
    expect(parseWindow('6-24', IST)).toEqual({ startHour: 6, endHour: 0, utcOffsetMinutes: IST });
    expect(parseWindow(' 7 - 1 ', IST)).toEqual({ startHour: 7, endHour: 1, utcOffsetMinutes: IST });
  });

  it.each(['', '6', '6-', 'a-b', '6:00-24', '24-6', '6-25', '-1-5'])('rejects %j', (value) => {
    expect(() => parseWindow(value, IST)).toThrow(/keep-alive window/);
  });
});

describe('isWithinWindow', () => {
  it('handles a same-day window with an exclusive end (6-24)', () => {
    const window = parseWindow('6-24', IST);
    expect(isWithinWindow(ist(5, 59), window)).toBe(false);
    expect(isWithinWindow(ist(6, 0), window)).toBe(true);
    expect(isWithinWindow(ist(23, 59), window)).toBe(true);
    expect(isWithinWindow(ist(0, 0), window)).toBe(false);
  });

  it('handles a window that wraps past midnight (22-2)', () => {
    const window = parseWindow('22-2', IST);
    expect(isWithinWindow(ist(21, 59), window)).toBe(false);
    expect(isWithinWindow(ist(23, 30), window)).toBe(true);
    expect(isWithinWindow(ist(1, 59), window)).toBe(true);
    expect(isWithinWindow(ist(2, 0), window)).toBe(false);
  });

  it('treats equal start and end as all day', () => {
    const window = parseWindow('0-24', IST);
    for (let hour = 0; hour < 24; hour++) expect(isWithinWindow(ist(hour, 17), window)).toBe(true);
  });

  it('applies the UTC offset, including half hours', () => {
    const window = parseWindow('6-7', IST);
    expect(isWithinWindow(new Date('2026-11-14T00:29:00Z'), window)).toBe(false); // 05:59 IST
    expect(isWithinWindow(new Date('2026-11-14T00:30:00Z'), window)).toBe(true); // 06:00 IST
    expect(isWithinWindow(new Date('2026-11-14T01:30:00Z'), window)).toBe(false); // 07:00 IST
  });
});

describe('startKeepAlive', () => {
  const logger = { debug: vi.fn(), warn: vi.fn(), info: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  const okFetch = () => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('{}', { status: 200 }));

  it('pings <url>/health every interval inside the window, and stops when asked', async () => {
    const fetchFn = okFetch();
    const stop = startKeepAlive({
      baseUrl: 'https://api.example.com//',
      window: parseWindow('0-24', IST),
      intervalMs: 1000,
      logger,
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]![0]).toBe('https://api.example.com/health');
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('skips pings outside the window and resumes inside it', async () => {
    const fetchFn = okFetch();
    let current = ist(3);
    const stop = startKeepAlive({
      baseUrl: 'https://api.example.com',
      window: parseWindow('6-24', IST),
      intervalMs: 1000,
      logger,
      fetchFn,
      now: () => current,
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchFn).not.toHaveBeenCalled();
    current = ist(6);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    stop();
  });

  it('logs and keeps going when a ping fails or returns an error status', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const stop = startKeepAlive({ baseUrl: 'https://a.b', window: parseWindow('0-24', IST), intervalMs: 1000, logger, fetchFn });
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'Keep-alive ping failed');
    expect(logger.warn).toHaveBeenCalledWith({ status: 502 }, 'Keep-alive ping got a non-2xx response');
    expect(logger.debug).toHaveBeenCalledWith('Keep-alive ping ok');
    stop();
  });

  it('does not keep the process alive on its own', () => {
    const stop = startKeepAlive({ baseUrl: 'https://a.b', window: parseWindow('0-24', IST), logger, fetchFn: okFetch() });
    expect(vi.getTimerCount()).toBe(1);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('keep-alive env', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_ACCESS_SECRET: 'x'.repeat(40),
    SMS_PROVIDER: 'dev',
    DEV_OTP_CODE: '123456',
  };

  it('defaults to 6-24 and reads the Render URL', () => {
    const env = loadEnv({ ...base, RENDER_EXTERNAL_URL: 'https://x.onrender.com' });
    expect(env.KEEP_ALIVE_HOURS_IST).toBe('6-24');
    expect(env.RENDER_EXTERNAL_URL).toBe('https://x.onrender.com');
    expect(env.KEEP_ALIVE_URL).toBeUndefined();
  });

  it('accepts "off" and rejects malformed hours', () => {
    expect(loadEnv({ ...base, KEEP_ALIVE_HOURS_IST: 'off' }).KEEP_ALIVE_HOURS_IST).toBe('off');
    expect(() => loadEnv({ ...base, KEEP_ALIVE_HOURS_IST: 'always' })).toThrow(/KEEP_ALIVE_HOURS_IST/);
    expect(() => loadEnv({ ...base, KEEP_ALIVE_URL: 'not a url' })).toThrow(/KEEP_ALIVE_URL/);
  });
});

describe('keep-alive env hour range', () => {
  it('rejects hours outside 0-24 at startup', () => {
    const env = {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_ACCESS_SECRET: 'x'.repeat(40),
      SMS_PROVIDER: 'dev',
      DEV_OTP_CODE: '123456',
    };
    expect(() => loadEnv({ ...env, KEEP_ALIVE_HOURS_IST: '24-6' })).toThrow(/KEEP_ALIVE_HOURS_IST.*hours are 0-24/s);
  });
});
