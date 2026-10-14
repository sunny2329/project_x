import { pino, type Logger } from 'pino';

/**
 * Paths that must never reach log output. Request bodies are not logged at all,
 * but these cover any object that is logged explicitly by mistake.
 */
const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.newPassword',
  '*.passwordHash',
  '*.code',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.identityToken',
];

export function createLogger(level: string, pretty: boolean): Logger {
  return pino({
    level,
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    ...(pretty ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
  });
}
