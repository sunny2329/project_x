import { z } from 'zod';
import { tiebreakerSchema } from '../engine/tournament/index.js';
import {
  appleSignInSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  linkAppleSchema,
  linkGoogleSchema,
  loginSchema,
  phoneStartSchema,
  phoneVerifySchema,
  refreshTokenSchema,
  registerCompleteSchema,
  registerStartSchema,
  registerVerifySchema,
  resetPasswordSchema,
} from '../modules/auth/auth.validation.js';
import { addMembersSchema, createConversationSchema, sendMessageSchema } from '../modules/chat/chat.validation.js';
import {
  addScorerSchema,
  confirmSchema,
  createMatchSchema,
  retireSchema,
  scoreEventSchema,
  versionSchema,
  walkoverSchema,
} from '../modules/matches/matches.validation.js';
import { uploadMediaSchema } from '../modules/media/media.routes.js';
import { claimSchema, createGuestSchema } from '../modules/players/players.routes.js';
import { updateProfileSchema, updateSportsSchema } from '../modules/profile/profile.validation.js';
import { createCommentSchema, createPostSchema } from '../modules/social/social.validation.js';
import {
  addCourtSchema,
  addEntrySchema,
  addStaffSchema,
  courtScorerSchema,
  createEventSchema,
  createTournamentSchema,
  drawSchema,
  fixtureManualResultSchema,
  fixtureWalkoverSchema,
  scheduleFixtureSchema,
  updateEntrySchema,
  updateEventSchema,
  updateTournamentSchema,
} from '../modules/tournaments/tournaments.validation.js';

/**
 * OpenAPI 3.1 description of the whole API, served at `/docs` (Swagger UI) and
 * `/docs/openapi.json`. Request bodies are generated from the same Zod schemas the routes
 * validate with, so they cannot drift; response shapes mirror the `*.types.ts` interfaces and
 * must be updated by hand when those change.
 */

type Schema = Record<string, unknown>;

/** Zod's uuid regex is noise next to `format: uuid`. */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy);
  if (!node || typeof node !== 'object') return node;
  const out: Schema = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue;
    if (key === 'pattern' && (node as Schema).format === 'uuid') continue;
    out[key] = tidy(value);
  }
  return out;
}

/** The request as clients send it (before transforms and defaults). */
const fromZod = (schema: z.ZodType): Schema => tidy(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })) as Schema;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
const arrayOf = (items: Schema): Schema => ({ type: 'array', items });
const obj = (properties: Record<string, Schema>, required: string[] = Object.keys(properties)): Schema => ({
  type: 'object',
  properties,
  required,
});

const str: Schema = { type: 'string' };
const int: Schema = { type: 'integer' };
const num: Schema = { type: 'number' };
const bool: Schema = { type: 'boolean' };
const uuid: Schema = { type: 'string', format: 'uuid' };
const dateTime: Schema = { type: 'string', format: 'date-time' };
const anyObject: Schema = { type: 'object', additionalProperties: true };
const enumOf = (...values: string[]): Schema => ({ type: 'string', enum: values });
const named = { id: uuid, name: str };

// ------------------------------------------------------------------------------------------
// Operation helpers
// ------------------------------------------------------------------------------------------

interface Op {
  tag: string;
  summary: string;
  description?: string;
  /** Bearer token required (default true). */
  auth?: boolean;
  body?: z.ZodType;
  query?: Array<{ name: string; schema: Schema; required?: boolean; description?: string }>;
  /** `data` of a success response. */
  data?: Schema;
  status?: number;
  /** Error codes the route can answer with, keyed by HTTP status. */
  errors?: Record<number, string[]>;
  /** Raw (non-envelope) responses, for the HTML/JS share pages and 204s. */
  raw?: Record<string, unknown>;
}

const ERROR_TEXT: Record<number, string> = {
  400: 'Validation failed or the request is not allowed in this state',
  401: 'Missing, invalid or expired credentials',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  429: 'Rate limited',
  503: 'Provider unavailable',
};

function errorResponse(status: number, codes: string[]): Schema {
  return {
    description: `${ERROR_TEXT[status] ?? 'Error'}: ${codes.join(', ')}`,
    content: { 'application/json': { schema: ref('Error') } },
  };
}

function operation(op: Op, method: string, expressPath: string, pathParams: string[]): Schema {
  const auth = op.auth ?? true;
  const errors: Record<number, string[]> = { ...op.errors };
  if (op.body) errors[400] = ['VALIDATION_ERROR', 'INVALID_JSON', ...(errors[400] ?? [])];
  if (auth) errors[401] = ['AUTH_REQUIRED', 'INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED', 'SESSION_REVOKED', ...(errors[401] ?? [])];

  const responses: Schema = op.raw ?? {
    [String(op.status ?? 200)]: {
      description: 'Success',
      content: { 'application/json': { schema: obj({ success: { const: true }, data: op.data ?? anyObject }) } },
    },
  };
  for (const [status, codes] of Object.entries(errors)) responses[status] = errorResponse(Number(status), [...new Set(codes)]);

  const parameters = [
    ...pathParams.map((name) => ({ name, in: 'path', required: true, schema: name === 'slug' || name === 'token' || name === 'role' ? str : uuid })),
    ...(op.query ?? []).map((q) => ({ name: q.name, in: 'query', required: q.required ?? false, schema: q.schema, ...(q.description ? { description: q.description } : {}) })),
  ];

  return {
    operationId: operationId(method, expressPath),
    tags: [op.tag],
    summary: op.summary,
    ...(op.description ? { description: op.description } : {}),
    ...(auth ? {} : { security: [] }),
    ...(parameters.length ? { parameters } : {}),
    ...(op.body ? { requestBody: { required: true, content: { 'application/json': { schema: fromZod(op.body) } } } } : {}),
    responses,
  };
}

/** "post /api/v1/matches/:id/events" -> "postMatchesByIdEvents". */
function operationId(method: string, expressPath: string): string {
  const words = expressPath
    .replace(/^\/api\/v1/, '')
    .split(/[/-]/)
    .filter(Boolean)
    .map((part) => (part.startsWith(':') ? `By${part.slice(1)}` : part).replace(/\W/g, ''))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return method + (words.join('') || 'Root');
}

/** Express-style path ("/matches/:id") → OpenAPI path ("/matches/{id}") plus its parameter names. */
function toOpenApiPath(path: string): { path: string; params: string[] } {
  const params: string[] = [];
  const converted = path.replace(/:([A-Za-z]+)/g, (_m, name: string) => {
    params.push(name);
    return `{${name}}`;
  });
  return { path: converted, params };
}

const routes: Array<[method: string, path: string, op: Op]> = [];
const route = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, op: Op) => routes.push([method, path, op]);

// ------------------------------------------------------------------------------------------
// Health
// ------------------------------------------------------------------------------------------

route('get', '/health', { tag: 'Health', summary: 'Liveness check', auth: false, data: obj({ status: { const: 'ok' } }) });

// ------------------------------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------------------------------

const A = '/api/v1/auth';
const authResult = ref('AuthResult');
const message = obj({ message: str });

route('post', `${A}/register/start`, {
  tag: 'Auth',
  summary: 'Start sign-up: checks duplicates and texts a 6-digit code',
  description: 'No account is created until `/register/complete`. Phones are E.164 (`+919876543210`). With `SMS_PROVIDER=dev` no SMS is sent and `DEV_OTP_CODE` is accepted.',
  auth: false,
  body: registerStartSchema,
  data: message,
  errors: { 400: ['INVALID_PHONE'], 409: ['USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN'], 429: ['RATE_LIMITED'], 503: ['SMS_UNAVAILABLE'] },
});
route('post', `${A}/register/verify`, {
  tag: 'Auth',
  summary: 'Check the sign-up code; returns the token `/register/complete` needs',
  auth: false,
  body: registerVerifySchema,
  data: obj({ registrationToken: str }),
  errors: { 400: ['INVALID_CODE'], 429: ['RATE_LIMITED', 'OTP_ATTEMPTS_EXCEEDED'] },
});
route('get', `${A}/username-available`, {
  tag: 'Auth',
  summary: 'Is this username free? (format problems come back as `reason`)',
  auth: false,
  query: [{ name: 'username', schema: str, required: true }],
  data: obj({ available: bool, reason: nullable(str) }),
});
route('post', `${A}/register/complete`, {
  tag: 'Auth',
  summary: 'Finish sign-up with the code; creates the account and signs in',
  auth: false,
  body: registerCompleteSchema,
  status: 201,
  data: authResult,
  errors: { 400: ['INVALID_CODE'], 409: ['USERNAME_TAKEN', 'EMAIL_TAKEN', 'PHONE_TAKEN', 'ACCOUNT_EXISTS'], 429: ['RATE_LIMITED', 'OTP_ATTEMPTS_EXCEEDED'] },
});
route('post', `${A}/login`, {
  tag: 'Auth',
  summary: 'Sign in with username, email or phone + password',
  description: '`identifier` containing "@" is an email; only digits, "+" and separators is a phone; anything else is a username.',
  auth: false,
  body: loginSchema,
  data: authResult,
  errors: { 401: ['INVALID_CREDENTIALS'], 403: ['ACCOUNT_DISABLED'], 429: ['RATE_LIMITED'] },
});
route('post', `${A}/phone/start`, {
  tag: 'Auth',
  summary: 'Text a sign-in code to a registered phone',
  auth: false,
  body: phoneStartSchema,
  data: message,
  errors: { 400: ['INVALID_PHONE'], 403: ['ACCOUNT_DISABLED'], 404: ['NO_ACCOUNT'], 429: ['RATE_LIMITED'], 503: ['SMS_UNAVAILABLE'] },
});
route('post', `${A}/phone/verify`, {
  tag: 'Auth',
  summary: 'Sign in with the texted code',
  auth: false,
  body: phoneVerifySchema,
  data: authResult,
  errors: { 400: ['INVALID_CODE'], 403: ['ACCOUNT_DISABLED'], 429: ['RATE_LIMITED', 'OTP_ATTEMPTS_EXCEEDED'] },
});
route('post', `${A}/password/forgot`, {
  tag: 'Auth',
  summary: "Text a reset code to the account's phone",
  auth: false,
  body: forgotPasswordSchema,
  data: message,
  errors: { 400: ['INVALID_PHONE'], 403: ['ACCOUNT_DISABLED'], 404: ['NO_ACCOUNT'], 429: ['RATE_LIMITED'], 503: ['SMS_UNAVAILABLE'] },
});
route('post', `${A}/password/reset`, {
  tag: 'Auth',
  summary: 'Set a new password with the code; signs out every device',
  auth: false,
  body: resetPasswordSchema,
  data: message,
  errors: { 400: ['INVALID_CODE'], 429: ['RATE_LIMITED', 'OTP_ATTEMPTS_EXCEEDED'] },
});
route('post', `${A}/google`, {
  tag: 'Auth',
  summary: 'Sign in with a Google ID token (existing accounts only, matched by verified email)',
  auth: false,
  body: googleSignInSchema,
  data: authResult,
  errors: { 400: ['EMAIL_NOT_VERIFIED'], 401: ['INVALID_SOCIAL_TOKEN'], 404: ['ACCOUNT_NOT_FOUND'], 503: ['PROVIDER_NOT_CONFIGURED'] },
});
route('post', `${A}/apple`, {
  tag: 'Auth',
  summary: 'Sign in with an Apple identity token (existing accounts only)',
  auth: false,
  body: appleSignInSchema,
  data: authResult,
  errors: { 400: ['EMAIL_NOT_VERIFIED'], 401: ['INVALID_SOCIAL_TOKEN'], 404: ['ACCOUNT_NOT_FOUND'], 503: ['PROVIDER_NOT_CONFIGURED'] },
});
route('post', `${A}/refresh`, {
  tag: 'Auth',
  summary: 'Swap a refresh token for new tokens (rotated; reusing an old one revokes the session)',
  auth: false,
  body: refreshTokenSchema,
  data: authResult,
  errors: { 401: ['INVALID_REFRESH_TOKEN'] },
});
route('post', `${A}/logout`, {
  tag: 'Auth',
  summary: "Revoke this device's session (idempotent)",
  auth: false,
  body: refreshTokenSchema,
  raw: { 204: { description: 'Signed out' } },
});
route('get', `${A}/me`, { tag: 'Auth', summary: 'The signed-in user', data: obj({ user: ref('PublicUser') }) });
route('get', `${A}/sessions`, { tag: 'Auth', summary: 'My signed-in devices (current one flagged)', data: obj({ sessions: arrayOf(anyObject) }) });
route('post', `${A}/sessions/sign-out-others`, { tag: 'Auth', summary: 'Sign out every device but this one', data: obj({ signedOut: int }) });
const identities = obj({ identities: arrayOf(anyObject) });
route('get', `${A}/identities`, { tag: 'Auth', summary: 'My linked Google / Apple accounts', data: identities });
route('post', `${A}/identities/google`, {
  tag: 'Auth',
  summary: 'Link a Google account to me',
  body: linkGoogleSchema,
  data: identities,
  errors: { 401: ['INVALID_SOCIAL_TOKEN'], 409: ['IDENTITY_IN_USE'], 503: ['PROVIDER_NOT_CONFIGURED'] },
});
route('post', `${A}/identities/apple`, {
  tag: 'Auth',
  summary: 'Link an Apple account to me',
  body: linkAppleSchema,
  data: identities,
  errors: { 401: ['INVALID_SOCIAL_TOKEN'], 409: ['IDENTITY_IN_USE'], 503: ['PROVIDER_NOT_CONFIGURED'] },
});
route('delete', `${A}/identities/:provider`, { tag: 'Auth', summary: 'Unlink "google" or "apple"', data: identities, errors: { 404: ['NOT_FOUND'] } });

// ------------------------------------------------------------------------------------------
// Sports, profile, players
// ------------------------------------------------------------------------------------------

route('get', '/api/v1/sports', {
  tag: 'Sports',
  summary: 'Active sports with their formats and rulesets',
  data: obj({ sports: arrayOf(ref('SportSummary')) }),
});
route('get', '/api/v1/sports/:slug', {
  tag: 'Sports',
  summary: 'One active sport by slug (e.g. "badminton")',
  data: obj({ sport: ref('SportSummary') }),
  errors: { 404: ['SPORT_NOT_FOUND'] },
});

const profile = obj({ profile: ref('Profile') });
route('get', '/api/v1/profile/me', { tag: 'Profile', summary: 'My profile, sports, ratings and record', data: profile });
route('patch', '/api/v1/profile/me', { tag: 'Profile', summary: 'Update my name or bio (empty bio clears it)', body: updateProfileSchema, data: profile });
route('put', '/api/v1/profile/me/sports', {
  tag: 'Profile',
  summary: 'Replace the sports I play and my primary sport',
  body: updateSportsSchema,
  data: profile,
});
route('get', '/api/v1/profile/me/matches', {
  tag: 'Profile',
  summary: 'My match history, newest first',
  query: [
    { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
    { name: 'sport', schema: str, description: 'Sport slug' },
  ],
  data: obj({ matches: arrayOf(ref('MatchHistoryItem')), counts: { type: 'object', additionalProperties: int } }),
  errors: { 400: ['VALIDATION_ERROR'] },
});

route('get', '/api/v1/players', {
  tag: 'Players',
  summary: 'Search registered players and my guests by name or username',
  query: [
    { name: 'q', schema: { type: 'string', minLength: 2, maxLength: 50 }, required: true },
    { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 } },
    { name: 'sport', schema: str, description: 'Sport slug: each result carries its rating in that sport' },
  ],
  data: obj({ players: arrayOf(ref('PlayerOption')) }),
  errors: { 400: ['VALIDATION_ERROR'] },
});
route('get', '/api/v1/players/me', {
  tag: 'Players',
  summary: 'My player record (created on first use; takes over guests with my verified phone)',
  data: obj({ player: ref('PlayerRef') }),
});
route('get', '/api/v1/players/guests', { tag: 'Players', summary: 'Guests I created recently', data: obj({ players: arrayOf(ref('PlayerRef')) }) });
route('post', '/api/v1/players/guests', {
  tag: 'Players',
  summary: 'Create a guest player (no account)',
  body: createGuestSchema,
  status: 201,
  data: obj({ player: ref('PlayerRef') }),
});
route('get', '/api/v1/players/claimable', {
  tag: 'Players',
  summary: 'Decided matches played by guests carrying my verified phone',
  data: obj({ matches: arrayOf(anyObject) }),
});
route('post', '/api/v1/players/claim', {
  tag: 'Players',
  summary: 'Merge guest players that carry my verified phone into me (only `playerIds` when given)',
  body: claimSchema,
  data: obj({ claimed: int }),
  errors: { 403: ['PHONE_NOT_VERIFIED'] },
});

// ------------------------------------------------------------------------------------------
// Matches
// ------------------------------------------------------------------------------------------

const M = '/api/v1/matches';
const match = obj({ match: ref('MatchView') });
const scoringErrors = { 403: ['NOT_MATCH_SCORER'], 404: ['MATCH_NOT_FOUND'], 409: ['STALE_MATCH', 'MATCH_NOT_LIVE'] };

route('post', M, {
  tag: 'Matches',
  summary: 'Quick start a friendly match (or record a finished one with `manualScores`)',
  description:
    'Each side lists players as `{playerId}`, `{userId}` or `{guest: {displayName, phone?}}`. `format` is a `sport_formats.code` ("singles", "doubles"). With `manualScores` the match is saved as completed and waits for a registered opponent to confirm.',
  body: createMatchSchema,
  status: 201,
  data: match,
  errors: { 404: ['SPORT_NOT_FOUND'] },
});
route('get', `${M}/live`, { tag: 'Matches', summary: 'Live matches (mine first)', data: obj({ matches: arrayOf(ref('MatchCard')) }) });
route('get', `${M}/pending-confirmations`, {
  tag: 'Matches',
  summary: 'Manually entered results waiting for me to confirm or dispute',
  data: obj({ matches: arrayOf(ref('MatchCard')) }),
});
route('get', `${M}/:id`, { tag: 'Matches', summary: 'One match with its full score summary', data: match, errors: { 404: ['MATCH_NOT_FOUND'] } });
route('get', `${M}/:id/details`, {
  tag: 'Matches',
  summary: 'Ratings, photos and scorer names for the watching and confirming screens',
  data: obj({ details: obj({ players: arrayOf(anyObject), scorers: arrayOf(obj({ userId: uuid, name: str })) }) }),
  errors: { 404: ['MATCH_NOT_FOUND'] },
});
route('post', `${M}/:id/events`, {
  tag: 'Matches',
  summary: 'Record a scoring event',
  description:
    'Send one of the `event` objects from `score.actions` (e.g. `{"type": "rally_won", "sideIndex": 0}`) with the current `version`. A stale version answers 409 STALE_MATCH; resending the same `clientEventId` never counts twice.',
  body: scoreEventSchema,
  data: match,
  errors: { ...scoringErrors, 400: ['INVALID_EVENT'], 409: [...scoringErrors[409], 'MATCH_OVER'] },
});
route('post', `${M}/:id/undo`, { tag: 'Matches', summary: 'Undo the last event (voids it; the log stays append-only)', body: versionSchema, data: match, errors: { ...scoringErrors, 400: ['NOTHING_TO_UNDO'] } });
route('post', `${M}/:id/complete`, { tag: 'Matches', summary: 'Finish a decided match: records, ratings, feed post, tournament advancement', body: versionSchema, data: match, errors: { ...scoringErrors, 409: [...scoringErrors[409], 'MATCH_NOT_FINISHED'] } });
route('post', `${M}/:id/retire`, { tag: 'Matches', summary: 'A side retires; the other side wins', body: retireSchema, data: match, errors: scoringErrors });
route('post', `${M}/:id/walkover`, {
  tag: 'Matches',
  summary: 'Award a walkover or no-show (null winner = double walkover). Never rated.',
  body: walkoverSchema,
  data: match,
  errors: { ...scoringErrors, 409: [...scoringErrors[409], 'MATCH_STARTED'] },
});
route('post', `${M}/:id/abandon`, { tag: 'Matches', summary: 'Abandon a friendly match (no result)', data: match, errors: { ...scoringErrors, 409: [...scoringErrors[409], 'TOURNAMENT_MATCH'] } });
route('post', `${M}/:id/confirm`, {
  tag: 'Matches',
  summary: 'Confirm or dispute a manually entered result (opponents only)',
  body: confirmSchema,
  data: match,
  errors: { 403: ['NOT_OPPONENT'], 404: ['MATCH_NOT_FOUND'], 409: ['NOT_PENDING'] },
});
route('post', `${M}/:id/scorers`, { tag: 'Matches', summary: 'Let another user score this match (creator or tournament organizer)', body: addScorerSchema, data: match, errors: { 403: ['NOT_ALLOWED'], 404: ['MATCH_NOT_FOUND'] } });

// ------------------------------------------------------------------------------------------
// Tournaments
// ------------------------------------------------------------------------------------------

const T = '/api/v1/tournaments';
const tournament = obj({ tournament: ref('Tournament') });
const event = obj({ event: ref('EventDetail') });
const organizerErrors = { 403: ['NOT_ORGANIZER'], 404: ['TOURNAMENT_NOT_FOUND'] };

route('get', T, {
  tag: 'Tournaments',
  summary: 'Tournaments I can see',
  query: [
    { name: 'filter', schema: { ...enumOf('all', 'open', 'live', 'mine'), default: 'all' } },
    { name: 'q', schema: { type: 'string', maxLength: 60 } },
  ],
  data: obj({ tournaments: arrayOf(ref('TournamentListItem')) }) });
route('get', `${T}/me/matches`, { tag: 'Tournaments', summary: 'My tournament entries and their upcoming / live / past fixtures', data: anyObject });
route('post', T, { tag: 'Tournaments', summary: 'Create a tournament (I become its organizer)', body: createTournamentSchema, status: 201, data: tournament });
route('get', `${T}/:id`, { tag: 'Tournaments', summary: 'Tournament with staff, courts and categories', data: tournament, errors: { 404: ['TOURNAMENT_NOT_FOUND'] } });
route('get', `${T}/:id/fixtures`, { tag: 'Tournaments', summary: 'Every fixture in the tournament (schedule, court board)', data: obj({ fixtures: arrayOf(ref('FixtureView')) }), errors: { 404: ['TOURNAMENT_NOT_FOUND'] } });
route('patch', `${T}/:id`, { tag: 'Tournaments', summary: 'Update details or status', body: updateTournamentSchema, data: tournament, errors: organizerErrors });
route('post', `${T}/:id/staff`, { tag: 'Tournaments', summary: 'Add a co-organizer, scorer or referee', body: addStaffSchema, data: tournament, errors: organizerErrors });
route('delete', `${T}/:id/staff/:userId/:role`, { tag: 'Tournaments', summary: 'Remove a staff role', data: tournament, errors: { ...organizerErrors, 409: ['ORGANIZER_REQUIRED'] } });
route('post', `${T}/:id/courts`, { tag: 'Tournaments', summary: 'Add a court', body: addCourtSchema, status: 201, data: tournament, errors: organizerErrors });
route('post', `${T}/:id/events`, {
  tag: 'Tournaments',
  summary: 'Add a category (sport + format + draw format)',
  description: '`drawFormat` is "knockout", "round_robin" or "groups_knockout"; `drawConfig` is validated by that format.',
  body: createEventSchema,
  status: 201,
  data: event,
  errors: organizerErrors,
});
route('post', '/api/v1/courts/:id/scorers', {
  tag: 'Tournaments',
  summary: "Assign a scorer to a court (they may score every match on it)",
  body: courtScorerSchema,
  data: tournament,
  errors: { 403: ['NOT_ORGANIZER'], 404: ['COURT_NOT_FOUND'] },
});
route('delete', '/api/v1/courts/:id/scorers/:userId', {
  tag: 'Tournaments',
  summary: 'Remove a court scorer',
  data: tournament,
  errors: { 403: ['NOT_ORGANIZER'], 404: ['COURT_NOT_FOUND'] },
});

const E = '/api/v1/tournament-events';
const eventErrors = { 403: ['NOT_ORGANIZER'], 404: ['EVENT_NOT_FOUND'] };
route('get', `${E}/:id`, { tag: 'Tournament categories', summary: 'Category with entries, stages, standings and fixtures', data: event, errors: { 404: ['EVENT_NOT_FOUND'] } });
route('patch', `${E}/:id`, { tag: 'Tournament categories', summary: 'Update status, size, draw config or tiebreakers', body: updateEventSchema, data: event, errors: eventErrors });
route('post', `${E}/:id/entries`, { tag: 'Tournament categories', summary: 'Enter a player, pair or team (organizers, or anyone while registration is open)', body: addEntrySchema, status: 201, data: event, errors: { ...eventErrors, 409: ['REGISTRATION_CLOSED', 'EVENT_FULL'] } });
route('post', `${E}/:id/draw`, {
  tag: 'Tournament categories',
  summary: 'Make the draw from approved entries (or preview it)',
  description: 'With `preview: true` nothing is saved and `data.preview` describes the plan. The same `randomSeed` gives the same draw.',
  body: drawSchema,
  data: { type: 'object', properties: { randomSeed: int, event: ref('EventDetail'), preview: anyObject }, required: ['randomSeed'] },
  errors: { ...eventErrors, 409: ['ALREADY_DRAWN'] },
});
route('delete', `${E}/:id/draw`, { tag: 'Tournament categories', summary: 'Reset the draw (only before any match has started)', data: event, errors: { ...eventErrors, 409: ['DRAW_STARTED'] } });
route('patch', '/api/v1/entries/:id', {
  tag: 'Tournament categories',
  summary: 'Approve, withdraw or seed an entry',
  body: updateEntrySchema,
  data: event,
  errors: { 403: ['NOT_ORGANIZER'], 404: ['ENTRY_NOT_FOUND'] },
});

const F = '/api/v1/fixtures';
const fixtureErrors = { 403: ['NOT_ORGANIZER', 'NOT_TOURNAMENT_STAFF'], 404: ['FIXTURE_NOT_FOUND'], 409: ['FIXTURE_NOT_READY', 'MATCH_STARTED'] };
route('get', `${F}/mine`, { tag: 'Fixtures', summary: 'Fixtures I can score (staff, court scorer)', data: obj({ fixtures: arrayOf(ref('FixtureView')) }) });
route('get', `${F}/:id`, { tag: 'Fixtures', summary: 'One fixture', data: obj({ fixture: ref('FixtureView') }), errors: { 404: ['FIXTURE_NOT_FOUND'] } });
route('patch', `${F}/:id`, { tag: 'Fixtures', summary: 'Set the court and time', body: scheduleFixtureSchema, data: obj({ fixture: ref('FixtureView') }), errors: fixtureErrors });
route('post', `${F}/:id/start`, { tag: 'Fixtures', summary: 'Create the live match for a ready fixture', data: match, errors: fixtureErrors });
route('post', `${F}/:id/walkover`, { tag: 'Fixtures', summary: 'Walkover or no-show (null winner = double walkover)', body: fixtureWalkoverSchema, data: match, errors: fixtureErrors });
route('post', `${F}/:id/result`, { tag: 'Fixtures', summary: 'Enter the final score (one [side0, side1] pair per game/set)', body: fixtureManualResultSchema, data: match, errors: fixtureErrors });

// ------------------------------------------------------------------------------------------
// Feed and posts
// ------------------------------------------------------------------------------------------

const cursorQuery = (max: number, dflt: number) => [
  { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: max, default: dflt } },
  { name: 'cursor', schema: uuid, description: "The previous page's `nextCursor`" },
];
const P = '/api/v1/posts';
const postNotFound = { 404: ['POST_NOT_FOUND'] };

route('get', '/api/v1/feed', {
  tag: 'Feed & posts',
  summary: 'My feed: my posts and those of people I follow',
  query: cursorQuery(50, 20),
  data: obj({ posts: arrayOf(ref('FeedPost')), nextCursor: nullable(uuid) }),
  errors: { 400: ['VALIDATION_ERROR'] },
});
route('post', P, { tag: 'Feed & posts', summary: 'Write a text post', body: createPostSchema, status: 201, data: obj({ post: ref('FeedPost') }) });
route('get', `${P}/:id`, { tag: 'Feed & posts', summary: 'One post I can see', data: obj({ post: ref('FeedPost') }), errors: postNotFound });
route('delete', `${P}/:id`, { tag: 'Feed & posts', summary: 'Delete my post', data: obj({ deleted: { const: true } }), errors: postNotFound });
route('put', `${P}/:id/like`, { tag: 'Feed & posts', summary: 'Like (idempotent)', data: ref('LikeState'), errors: postNotFound });
route('delete', `${P}/:id/like`, { tag: 'Feed & posts', summary: 'Unlike (idempotent)', data: ref('LikeState'), errors: postNotFound });
route('get', `${P}/:id/comments`, {
  tag: 'Feed & posts',
  summary: 'Comments, oldest first',
  query: cursorQuery(100, 50),
  data: obj({ comments: arrayOf(ref('PostComment')), nextCursor: nullable(uuid) }),
  errors: { ...postNotFound, 400: ['VALIDATION_ERROR'] },
});
route('post', `${P}/:id/comments`, { tag: 'Feed & posts', summary: 'Comment on a post', body: createCommentSchema, status: 201, data: obj({ comment: ref('PostComment') }), errors: postNotFound });
route('delete', `${P}/:id/comments/:commentId`, {
  tag: 'Feed & posts',
  summary: 'Delete my comment (or any comment on my post)',
  data: obj({ deleted: { const: true } }),
  errors: { 404: ['POST_NOT_FOUND', 'COMMENT_NOT_FOUND'] },
});

// ------------------------------------------------------------------------------------------
// Chat
// ------------------------------------------------------------------------------------------

const C = '/api/v1/conversations';
const conversation = obj({ conversation: ref('Conversation') });
const convNotFound = { 404: ['CONVERSATION_NOT_FOUND'] };
const chatNote = 'Members and the newest message id are cached (Redis when configured).';

route('get', C, { tag: 'Chat', summary: 'My conversations, most recent first', description: chatNote, data: obj({ conversations: arrayOf(ref('Conversation')) }) });
route('get', `${C}/unread`, { tag: 'Chat', summary: 'Total unread messages', description: chatNote, data: obj({ count: int }) });
route('post', C, {
  tag: 'Chat',
  summary: 'Start a direct conversation (one user) or a group (several users + title)',
  description: chatNote,
  body: createConversationSchema,
  status: 201,
  data: conversation,
  errors: { 403: ['CANNOT_MESSAGE'] },
});
route('get', `${C}/:id`, { tag: 'Chat', summary: 'One conversation', description: chatNote, data: conversation, errors: convNotFound });
route('post', `${C}/:id/members`, { tag: 'Chat', summary: 'Add members to a group (admins)', description: chatNote, body: addMembersSchema, data: conversation, errors: { ...convNotFound, 400: ['NOT_A_GROUP'], 403: ['NOT_GROUP_ADMIN'] } });
route('post', `${C}/:id/leave`, { tag: 'Chat', summary: 'Leave a group', description: chatNote, data: obj({ left: { const: true } }), errors: { ...convNotFound, 400: ['NOT_A_GROUP'] } });
route('get', `${C}/:id/messages`, {
  tag: 'Chat',
  summary: 'Messages: scroll back with `before`, poll for new ones with `after`',
  description: chatNote,
  query: [
    { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 30 } },
    { name: 'before', schema: uuid, description: 'Messages older than this one' },
    { name: 'after', schema: uuid, description: 'Messages newer than this one' },
  ],
  data: obj({ messages: arrayOf(ref('ChatMessage')) }),
  errors: { ...convNotFound, 400: ['VALIDATION_ERROR'] },
});
route('post', `${C}/:id/messages`, { tag: 'Chat', summary: 'Send a message', description: chatNote, body: sendMessageSchema, status: 201, data: obj({ message: ref('ChatMessage') }), errors: convNotFound });
route('delete', `${C}/:id/messages/:messageId`, {
  tag: 'Chat',
  summary: 'Delete my message',
  description: chatNote,
  data: obj({ deleted: { const: true } }),
  errors: { 404: ['CONVERSATION_NOT_FOUND', 'MESSAGE_NOT_FOUND'] },
});
route('post', `${C}/:id/read`, { tag: 'Chat', summary: 'Mark the conversation read', description: chatNote, data: obj({ read: { const: true } }), errors: convNotFound });

// ------------------------------------------------------------------------------------------
// Notifications
// ------------------------------------------------------------------------------------------

const N = '/api/v1/notifications';
const notificationNote = 'Written when someone likes or comments on my post, follows me, or (when I follow them) posts. Never for my own actions; hidden when either of us has blocked the other or the post was deleted.';

route('get', N, {
  tag: 'Notifications',
  summary: 'My notifications, newest first, with the unread count',
  description: notificationNote,
  query: cursorQuery(50, 30),
  data: obj({ notifications: arrayOf(ref('AppNotification')), unreadCount: int, nextCursor: nullable(uuid) }),
  errors: { 400: ['VALIDATION_ERROR'] },
});
route('get', `${N}/unread`, { tag: 'Notifications', summary: 'Unread count (the badge on the bell)', data: obj({ count: int }) });
route('post', `${N}/read`, { tag: 'Notifications', summary: 'Mark all as read', data: obj({ read: { const: true } }) });
route('post', `${N}/:id/read`, { tag: 'Notifications', summary: 'Mark one as read', data: obj({ read: { const: true } }), errors: { 404: ['NOTIFICATION_NOT_FOUND'] } });

// ------------------------------------------------------------------------------------------
// Users and media
// ------------------------------------------------------------------------------------------

const U = '/api/v1/users';
const userNotFound = { 404: ['USER_NOT_FOUND'] };
const followState = obj({ isFollowing: bool, followers: int });
route('get', `${U}/search`, {
  tag: 'Users',
  summary: 'Find people by username or name (blocked users excluded)',
  query: [
    { name: 'q', schema: { type: 'string', minLength: 1, maxLength: 50 }, required: true },
    { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 30, default: 15 } },
  ],
  data: obj({ users: arrayOf(anyObject) }),
  errors: { 400: ['VALIDATION_ERROR'] },
});
route('get', `${U}/:id`, { tag: 'Users', summary: "Another player's profile: sports, ratings, follows, head to head, recent matches", data: obj({ user: anyObject }), errors: userNotFound });
route('get', `${U}/:id/matches`, {
  tag: 'Users',
  summary: "Another player's match history",
  query: [{ name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }],
  data: obj({ matches: arrayOf(ref('MatchHistoryItem')) }),
  errors: userNotFound,
});
route('put', `${U}/:id/follow`, { tag: 'Users', summary: 'Follow (idempotent)', data: followState, errors: { ...userNotFound, 400: ['CANNOT_FOLLOW_SELF'] } });
route('delete', `${U}/:id/follow`, { tag: 'Users', summary: 'Unfollow (idempotent)', data: followState });
for (const list of ['followers', 'following'] as const) {
  route('get', `${U}/:id/${list}`, {
    tag: 'Users',
    summary:
      list === 'followers'
        ? 'Who follows this user, newest first (active, unblocked accounts; each row has isFollowing and followsMe)'
        : 'Whom this user follows, newest first (active, unblocked accounts; each row has isFollowing and followsMe)',
    query: [
      { name: 'q', schema: { type: 'string', maxLength: 50 } },
      { name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 50, default: 30 } },
      { name: 'cursor', schema: str },
    ],
    data: obj({ users: arrayOf(anyObject), nextCursor: nullable(str) }),
    errors: { ...userNotFound, 400: ['VALIDATION_ERROR'] },
  });
}
route('delete', `${U}/me/followers/:id`, {
  tag: 'Users',
  summary: 'Remove someone from my followers (idempotent); returns my new counts',
  data: obj({ removed: { const: true }, followers: int, following: int }),
  errors: userNotFound,
});

route('post', '/api/v1/media', {
  tag: 'Media',
  summary: 'Upload a photo (base64 JPEG / PNG / WebP, at most 3 MB); stored in Postgres `media_files`',
  body: uploadMediaSchema,
  status: 201,
  data: obj({ media: obj({ id: uuid, url: str, width: nullable(int), height: nullable(int) }) }),
  errors: { 400: ['MEDIA_TOO_LARGE', 'MEDIA_INVALID'] },
});
route('get', '/media/:id', {
  tag: 'Media',
  summary: 'The photo bytes (public, cached for a year)',
  auth: false,
  raw: {
    200: { description: 'Image', content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': {}, 'image/webp': {} } },
    404: { description: 'MEDIA_NOT_FOUND', content: { 'application/json': { schema: ref('Error') } } },
  },
});

// ------------------------------------------------------------------------------------------
// Public (no login)
// ------------------------------------------------------------------------------------------

route('get', '/api/v1/public/matches/:token', {
  tag: 'Public',
  summary: 'A shared match by its share token (no user ids, no scoring actions)',
  auth: false,
  data: match,
  errors: { 404: ['MATCH_NOT_FOUND'] },
});
route('get', '/api/v1/public/tournaments/:slug', { tag: 'Public', summary: 'A public or unlisted tournament', auth: false, data: tournament, errors: { 404: ['TOURNAMENT_NOT_FOUND'] } });
route('get', '/api/v1/public/tournament-events/:id', { tag: 'Public', summary: 'A category with brackets, fixtures and standings', auth: false, data: event, errors: { 404: ['EVENT_NOT_FOUND'] } });

const html = (description: string) => ({ 200: { description, content: { 'text/html': { schema: str } } }, 404: { description: 'Not found page', content: { 'text/html': { schema: str } } } });
route('get', '/s/:token', { tag: 'Public', summary: 'Share page: live scoreboard (HTML, polls the public JSON)', auth: false, raw: html('Scoreboard page') });
route('get', '/t/:slug', { tag: 'Public', summary: 'Share page: tournament brackets, fixtures and standings (HTML)', auth: false, raw: html('Tournament page') });
route('get', '/public-assets/page.js', {
  tag: 'Public',
  summary: 'Script used by the share pages',
  auth: false,
  raw: { 200: { description: 'JavaScript', content: { 'application/javascript': { schema: str } } } },
});

// ------------------------------------------------------------------------------------------
// Component schemas (response shapes)
// ------------------------------------------------------------------------------------------

const sportRef = obj({ id: str, slug: str, name: str, iconKey: str, accentColor: str });
const playerRef = obj({ playerId: uuid, userId: nullable(uuid), displayName: str, isGuest: bool });
const fixtureMatch = obj({ id: uuid, status: str, headline: str, winnerSideIndex: nullable(int), callout: nullable(str) });

const schemas: Record<string, Schema> = {
  Error: obj({
    success: { const: false },
    error: obj(
      {
        code: { type: 'string', examples: ['VALIDATION_ERROR'] },
        message: str,
        details: { type: 'object', description: 'Field name → messages (validation errors)', additionalProperties: arrayOf(str) },
      },
      ['code', 'message'],
    ),
  }),

  PublicUser: obj({
    id: uuid,
    username: str,
    fullName: str,
    email: nullable(str),
    phone: { type: 'string', description: 'E.164', examples: ['+919876543210'] },
    emailVerified: bool,
    phoneVerified: bool,
    createdAt: dateTime,
  }),
  AuthTokens: obj({
    accessToken: { type: 'string', description: 'JWT, 15 minutes by default' },
    accessTokenExpiresAt: dateTime,
    refreshToken: { type: 'string', description: '`<session id>.<secret>`, rotated on every refresh' },
    refreshTokenExpiresAt: dateTime,
  }),
  AuthResult: obj({ user: ref('PublicUser'), tokens: ref('AuthTokens') }),

  SportSummary: obj({
    id: str,
    slug: str,
    name: str,
    category: str,
    iconKey: str,
    accentColor: str,
    formats: arrayOf(obj({ code: str, name: str, playersPerSide: int, minPerSide: int, maxPerSide: int })),
    rulesets: arrayOf(obj({ id: uuid, slug: str, name: str, scoringModel: enumOf('rally', 'side_out', 'tennis'), isDefault: bool, config: anyObject })),
  }),

  Profile: obj({
    user: ref('PublicUser'),
    bio: nullable(str),
    sports: arrayOf(ref('PlayerSport')),
    record: obj({ played: int, won: int, lost: int }),
    followers: int,
    following: int,
  }),
  PlayerSport: obj({
    id: str,
    slug: str,
    name: str,
    iconKey: str,
    accentColor: str,
    isPrimary: bool,
    rating: num,
    ratedMatches: int,
    matchesPlayed: int,
    matchesWon: int,
    matchesLost: int,
    majorWon: int,
    majorLost: int,
    minorWon: int,
    minorLost: int,
  }),
  MatchHistoryItem: obj({
    matchId: uuid,
    context: enumOf('friendly', 'tournament'),
    sport: sportRef,
    playedAt: dateTime,
    outcome: enumOf('won', 'lost', 'draw', 'in_progress', 'disputed'),
    resultType: nullable(str),
    otherPlayers: arrayOf(str),
    headline: nullable(str),
    ratingChange: nullable(num),
  }),

  PlayerRef: playerRef,
  PlayerOption: obj({ playerId: nullable(uuid), userId: nullable(uuid), username: nullable(str), displayName: str, isGuest: bool }),

  ScoringAction: obj({
    id: str,
    label: str,
    sideIndex: nullable(int),
    event: { type: 'object', properties: { type: str }, required: ['type'], additionalProperties: true, description: 'Send this as `event` to POST /matches/{id}/events' },
  }),
  SideSummary: obj({
    index: int,
    primary: { type: 'string', description: 'Games or sets won' },
    current: { ...nullable(str), description: 'Score in the current game ("17", "40", "AD")' },
    serving: bool,
    serverNumber: { anyOf: [{ type: 'integer', enum: [1, 2] }, { type: 'null' }], description: 'Pickleball doubles' },
    serverPlayerIndex: nullable(int),
    serveNote: nullable(str),
  }),
  SegmentSummary: obj({
    type: { type: 'string', examples: ['game', 'set', 'tiebreak', 'match_tiebreak'] },
    sequence: int,
    label: str,
    scores: arrayOf(int),
    display: arrayOf(str),
    winnerSideIndex: nullable(int),
    complete: bool,
    children: arrayOf(ref('SegmentSummary')),
  }),
  ScoreSummary: obj({
    scoringModel: str,
    complete: bool,
    winnerSideIndex: nullable(int),
    sides: arrayOf(ref('SideSummary')),
    segments: arrayOf(ref('SegmentSummary')),
    headline: { type: 'string', examples: ['21-17, 18-21, 21-19'] },
    callout: { ...nullable(str), examples: ['Deuce', 'Golden point', '4-7-2', 'Match point'] },
    totals: obj({ major: arrayOf(int), minor: arrayOf(int), majorLabel: str, minorLabel: str }),
    actions: arrayOf(ref('ScoringAction')),
  }),

  MatchView: obj({
    id: uuid,
    context: enumOf('friendly', 'tournament'),
    sport: sportRef,
    format: obj({ code: str, name: str, playersPerSide: int }),
    ruleset: obj({ id: nullable(uuid), name: nullable(str), scoringModel: str }),
    scoringMode: enumOf('live', 'manual'),
    shareToken: str,
    createdByUserId: uuid,
    venue: nullable(obj(named)),
    court: nullable(obj(named)),
    tournament: nullable(obj({ tournamentId: uuid, slug: str, name: str, eventId: uuid, eventName: str, fixtureId: uuid, roundName: nullable(str) })),
    sides: arrayOf(
      obj({ index: int, name: str, teamId: nullable(uuid), entryId: nullable(uuid), players: arrayOf(playerRef), outcome: nullable(enumOf('won', 'lost', 'drawn')) }),
    ),
    status: enumOf('scheduled', 'live', 'completed', 'abandoned', 'disputed', 'walkover', 'retired'),
    resultType: nullable(enumOf('played', 'walkover', 'no_show', 'retired', 'double_walkover')),
    score: ref('ScoreSummary'),
    version: { type: 'integer', description: 'Send back with every scoring request' },
    canScore: bool,
    startedAt: nullable(dateTime),
    completedAt: nullable(dateTime),
    ratingChanges: arrayOf(obj({ playerId: uuid, before: num, after: num })),
    confirmation: obj({
      status: enumOf('not_required', 'pending', 'confirmed', 'disputed'),
      canConfirm: bool,
      decisions: arrayOf(obj({ sideIndex: int, displayName: str, decision: enumOf('confirmed', 'disputed'), comment: nullable(str), decidedAt: dateTime })),
    }),
  }),
  MatchCard: obj({
    id: uuid,
    context: enumOf('friendly', 'tournament'),
    status: str,
    sport: sportRef,
    sides: arrayOf(obj({ index: int, name: str, outcome: nullable(enumOf('won', 'lost', 'drawn')) })),
    score: obj({
      headline: str,
      complete: bool,
      winnerSideIndex: nullable(int),
      callout: nullable(str),
      sides: arrayOf(obj({ index: int, primary: str, current: nullable(str), serving: bool })),
    }),
    mine: bool,
    startedAt: nullable(dateTime),
    updatedAt: dateTime,
  }),

  TournamentListItem: obj({
    id: uuid,
    slug: str,
    name: str,
    status: ref('TournamentStatus'),
    visibility: enumOf('public', 'unlisted', 'private'),
    startsOn: nullable({ type: 'string', format: 'date' }),
    endsOn: nullable({ type: 'string', format: 'date' }),
    venue: nullable(obj(named)),
    sports: arrayOf(obj({ slug: str, name: str, iconKey: str })),
    isOrganizer: bool,
  }),
  TournamentStatus: enumOf('draft', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled'),
  Tournament: obj({
    id: uuid,
    slug: str,
    name: str,
    description: nullable(str),
    status: ref('TournamentStatus'),
    visibility: enumOf('public', 'unlisted', 'private'),
    startsOn: nullable({ type: 'string', format: 'date' }),
    endsOn: nullable({ type: 'string', format: 'date' }),
    venue: nullable(obj(named)),
    isOrganizer: bool,
    staff: arrayOf(obj({ userId: uuid, role: enumOf('organizer', 'co_organizer', 'scorer', 'referee'), name: nullable(str) })),
    courts: arrayOf(obj({ id: uuid, name: str, scorerUserIds: arrayOf(uuid) })),
    events: arrayOf(ref('EventSummary')),
  }),
  EventSummary: obj({
    id: uuid,
    name: str,
    status: str,
    sport: sportRef,
    format: obj({ code: str, name: str, playersPerSide: int }),
    ruleset: obj(named),
    drawFormat: enumOf('knockout', 'round_robin', 'groups_knockout'),
    drawConfig: anyObject,
    tiebreakers: arrayOf(fromZod(tiebreakerSchema)),
    maxEntries: nullable(int),
    approvedEntries: int,
  }),
  EntryView: obj({
    id: uuid,
    name: str,
    seed: nullable(int),
    status: enumOf('pending', 'approved', 'withdrawn', 'disqualified'),
    players: arrayOf(obj({ playerId: uuid, displayName: str, isGuest: bool })),
  }),
  StandingRow: obj({ entryId: uuid, name: str, rank: int, played: int, won: int, lost: int, majorWon: int, majorLost: int, minorWon: int, minorLost: int }),
  FixtureView: obj({
    id: uuid,
    eventId: uuid,
    stageId: uuid,
    groupId: nullable(uuid),
    round: int,
    position: int,
    roundName: nullable(str),
    status: enumOf('pending', 'ready', 'live', 'completed', 'bye', 'cancelled'),
    entries: arrayOf(nullable(obj(named))),
    placeholders: { ...arrayOf(nullable(str)), description: 'What fills an empty slot: "Winner of Semi-final 1", "1st Group A", "Bye"' },
    winnerEntryId: nullable(uuid),
    court: nullable(obj(named)),
    scheduledAt: nullable(dateTime),
    match: nullable(fixtureMatch),
    nextFixtureId: nullable(uuid),
  }),
  EventDetail: obj({
    id: uuid,
    tournament: obj({ id: uuid, slug: str, name: str }),
    name: str,
    status: str,
    sport: sportRef,
    format: obj({ code: str, name: str, playersPerSide: int }),
    ruleset: obj(named),
    drawFormat: enumOf('knockout', 'round_robin', 'groups_knockout'),
    drawConfig: anyObject,
    tiebreakers: arrayOf(fromZod(tiebreakerSchema)),
    entries: arrayOf(ref('EntryView')),
    stages: arrayOf(
      obj({
        id: uuid,
        sequence: int,
        type: str,
        name: str,
        status: str,
        groups: arrayOf(obj({ id: uuid, type: str, name: str, standings: nullable(arrayOf(ref('StandingRow'))) })),
      }),
    ),
    fixtures: arrayOf(ref('FixtureView')),
  }),

  FeedPost: obj({
    id: uuid,
    content: nullable(str),
    createdAt: dateTime,
    author: obj({ id: uuid, username: str, fullName: str }),
    match: nullable(
      obj({
        id: uuid,
        context: enumOf('friendly', 'tournament'),
        sport: sportRef,
        format: nullable(str),
        durationSeconds: nullable(int),
        result: nullable(
          obj({
            headline: str,
            winnerSideIndex: nullable(int),
            resultType: nullable(str),
            sides: arrayOf(obj({ index: int, name: str, primary: str })),
            segmentCount: int,
          }),
        ),
      }),
    ),
    visibility: enumOf('public', 'followers'),
    likeCount: int,
    commentCount: int,
    likedByMe: bool,
  }),
  LikeState: obj({ likeCount: int, likedByMe: bool }),
  PostComment: obj({ id: uuid, content: str, createdAt: dateTime, author: obj({ id: uuid, username: str, fullName: str }) }),
  AppNotification: obj({
    id: uuid,
    type: enumOf('like', 'comment', 'post', 'follow'),
    title: str,
    message: { ...nullable(str), description: 'The comment, or the start of the new post' },
    isRead: bool,
    createdAt: dateTime,
    actor: obj({ id: uuid, username: str, fullName: str, photoUrl: nullable(str) }),
    postId: { ...nullable(uuid), description: 'Null for follows' },
  }),

  ChatUser: obj({ id: uuid, username: str, fullName: str }),
  ChatMessage: obj({ id: uuid, conversationId: uuid, sender: ref('ChatUser'), content: nullable(str), createdAt: dateTime, deleted: bool }),
  Conversation: obj({
    id: uuid,
    type: enumOf('direct', 'group'),
    title: nullable(str),
    members: arrayOf(ref('ChatUser')),
    isAdmin: bool,
    lastMessage: nullable(ref('ChatMessage')),
    unreadCount: int,
    updatedAt: dateTime,
  }),
};

// ------------------------------------------------------------------------------------------

function buildPaths(): Schema {
  const paths: Record<string, Schema> = {};
  for (const [method, expressPath, op] of routes) {
    const { path, params } = toOpenApiPath(expressPath);
    paths[path] = { ...paths[path], [method]: operation(op, method, expressPath, params) };
  }
  return paths;
}

const TAGS: Record<string, string> = {
  Health: 'Liveness',
  Auth: 'Sign-up, password / phone-code / Google / Apple sign-in, tokens, password reset',
  Sports: 'Active sports with formats (singles, doubles) and scoring rulesets',
  Profile: "The signed-in user's profile, sports, record and match history",
  Players: 'Finding people to play with, guest players, claiming guest history',
  Matches: 'Friendly matches and live scoring (tournament matches are scored here too)',
  Tournaments: 'Tournaments, staff and courts',
  'Tournament categories': 'Categories (events): entries, seeding and the draw',
  Fixtures: 'Scheduling, starting and deciding tournament fixtures',
  'Feed & posts': 'Feed, posts, likes and comments',
  Chat: 'Direct and group messages',
  Notifications: 'The bell on Home: likes, comments, new posts and follows',
  Users: 'Finding, viewing and following people',
  Media: 'Photo upload and download',
  Public: 'No-login share JSON and pages',
};

export function buildOpenApiSpec(serverUrl?: string): Schema {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ProjectX API',
      version: '0.1.0',
      description: [
        'Racket-sports friendly matches, tournaments, profiles, feed and chat.',
        '',
        'Every JSON response is an envelope: `{"success": true, "data": …}` or `{"success": false, "error": {"code", "message", "details?"}}`.',
        '',
        '**To try authenticated routes:** call `POST /api/v1/auth/phone/start` then `POST /api/v1/auth/phone/verify` (dev SMS mode accepts `DEV_OTP_CODE`), or `POST /api/v1/auth/login`; copy `data.tokens.accessToken` into **Authorize**.',
      ].join('\n'),
    },
    // Relative: "Try it out" calls whichever host served the page (localhost, LAN IP, deploy).
    servers: [{ url: serverUrl ?? '/' }],
    security: [{ bearerAuth: [] }],
    tags: Object.entries(TAGS).map(([name, description]) => ({ name, description })),
    paths: buildPaths(),
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
  };
}
