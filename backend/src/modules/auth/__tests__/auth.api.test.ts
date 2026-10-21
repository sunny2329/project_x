import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, TEST_OTP } from '../../../test/harness.js';

type Ctx = Awaited<ReturnType<typeof createTestContext>>;
let ctx: Ctx;

const API = '/api/v1/auth';
const PASSWORD = 'Sprint2026';
let seq = 0;

function newAccount() {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  return { username: `athlete${suffix}`, fullName: 'Test Athlete', email: `athlete${suffix}@example.com`, phone: `+9198${suffix}`, password: PASSWORD };
}

/** Sign-up in three steps: phone + username -> code -> details. */
async function startAndVerify(account: { phone: string; username: string }) {
  await request(ctx.app).post(`${API}/register/start`).send({ phone: account.phone, username: account.username }).expect(200);
  const res = await request(ctx.app).post(`${API}/register/verify`).send({ phone: account.phone, code: TEST_OTP }).expect(200);
  return res.body.data.registrationToken as string;
}

function details(account: ReturnType<typeof newAccount>, registrationToken: string) {
  return { registrationToken, username: account.username, fullName: account.fullName, email: account.email, password: account.password };
}

async function register(account = newAccount()) {
  const registrationToken = await startAndVerify(account);
  const res = await request(ctx.app).post(`${API}/register/complete`).send(details(account, registrationToken)).expect(201);
  return { account, ...(res.body.data as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } }) };
}

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx?.cleanup();
});

describe('registration', () => {
  it('sends a code, then creates the account with a verified phone and returns tokens', async () => {
    const account = newAccount();
    const start = await request(ctx.app).post(`${API}/register/start`).send({ phone: account.phone, username: account.username }).expect(200);
    expect(start.body).toEqual({ success: true, data: { message: 'Verification code sent.' } });
    expect(ctx.sms.sentTo).toContain(account.phone);

    const verify = await request(ctx.app).post(`${API}/register/verify`).send({ phone: account.phone, code: TEST_OTP }).expect(200);
    const res = await request(ctx.app).post(`${API}/register/complete`).send(details(account, verify.body.data.registrationToken)).expect(201);
    expect(res.body.data.user).toMatchObject({
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      phoneVerified: true,
      emailVerified: false,
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.data.tokens.refreshToken).toMatch(/^[0-9a-f-]{36}\.[\w-]+$/);

    const { rows } = await ctx.pool.query('SELECT password_hash FROM usr_user WHERE email = $1', [account.email]);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  it('normalizes email case and phone formatting', async () => {
    const account = newAccount();
    const spacedPhone = `${account.phone.slice(0, 3)} ${account.phone.slice(3, 8)}-${account.phone.slice(8)}`;
    const token = await startAndVerify({ phone: spacedPhone, username: account.username });
    const res = await request(ctx.app)
      .post(`${API}/register/complete`)
      .send({ ...details(account, token), email: account.email.toUpperCase() })
      .expect(201);
    expect(res.body.data.user.email).toBe(account.email);
    expect(res.body.data.user.phone).toBe(account.phone);
  });

  it('rejects a wrong code', async () => {
    const account = newAccount();
    await request(ctx.app).post(`${API}/register/start`).send({ phone: account.phone, username: account.username }).expect(200);
    const res = await request(ctx.app).post(`${API}/register/verify`).send({ phone: account.phone, code: '000000' }).expect(400);
    expect(res.body.error.code).toBe('INVALID_CODE');
  });

  it('rejects a forged registration token', async () => {
    const res = await request(ctx.app)
      .post(`${API}/register/complete`)
      .send(details(newAccount(), 'not-a-real-registration-token'))
      .expect((r) => expect([400, 401]).toContain(r.status));
    expect(res.body.success).toBe(false);
  });

  it('rejects duplicate username, phone and email', async () => {
    const { account } = await register();
    const dupPhone = await request(ctx.app)
      .post(`${API}/register/start`)
      .send({ phone: account.phone, username: newAccount().username })
      .expect(409);
    expect(dupPhone.body.error.code).toBe('PHONE_TAKEN');
    const dupUsername = await request(ctx.app)
      .post(`${API}/register/start`)
      .send({ phone: newAccount().phone, username: account.username })
      .expect(409);
    expect(dupUsername.body.error.code).toBe('USERNAME_TAKEN');
    const other = newAccount();
    const token = await startAndVerify(other);
    const dupEmail = await request(ctx.app)
      .post(`${API}/register/complete`)
      .send({ ...details(other, token), email: account.email })
      .expect(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('returns field-level validation errors', async () => {
    const start = await request(ctx.app).post(`${API}/register/start`).send({ username: '1', phone: '12345' }).expect(400);
    expect(start.body.success).toBe(false);
    expect(start.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(start.body.error.details).sort()).toEqual(['phone', 'username']);
    const complete = await request(ctx.app)
      .post(`${API}/register/complete`)
      .send({ registrationToken: 'x'.repeat(20), username: 'valid_name', fullName: 'A', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(Object.keys(complete.body.error.details).sort()).toEqual(['email', 'fullName', 'password']);
  });

  it('rejects malformed JSON with a clean error', async () => {
    const res = await request(ctx.app)
      .post(`${API}/login`)
      .set('content-type', 'application/json')
      .send('{"identifier":')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('password login', () => {
  it('signs in with email or phone', async () => {
    const { account } = await register();
    for (const identifier of [account.email, account.phone]) {
      const res = await request(ctx.app).post(`${API}/login`).send({ identifier, password: PASSWORD }).expect(200);
      expect(res.body.data.user.email).toBe(account.email);
    }
  });

  it('gives the same error for a wrong password and an unknown account', async () => {
    const { account } = await register();
    const wrongPassword = await request(ctx.app)
      .post(`${API}/login`)
      .send({ identifier: account.email, password: 'Wrong12345' })
      .expect(401);
    const unknown = await request(ctx.app)
      .post(`${API}/login`)
      .send({ identifier: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    expect(wrongPassword.body.error).toEqual(unknown.body.error);
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('blocks suspended accounts', async () => {
    const { account, user } = await register();
    await ctx.pool.query('UPDATE usr_user SET status = 2 WHERE id = $1', [user.id]);
    const res = await request(ctx.app).post(`${API}/login`).send({ identifier: account.email, password: PASSWORD }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('phone (OTP) login', () => {
  beforeEach(() => {
    ctx.sms.sentTo.length = 0;
  });

  it('sends a code only to registered numbers, with an identical response either way', async () => {
    const { account } = await register();
    ctx.sms.sentTo.length = 0;
    const known = await request(ctx.app).post(`${API}/phone/start`).send({ phone: account.phone }).expect(200);
    const unknown = await request(ctx.app).post(`${API}/phone/start`).send({ phone: '+919999999999' }).expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(ctx.sms.sentTo).toEqual([account.phone]);
  });

  it('signs in with a valid code and rejects an invalid one', async () => {
    const { account } = await register();
    await request(ctx.app).post(`${API}/phone/start`).send({ phone: account.phone }).expect(200);
    await request(ctx.app).post(`${API}/phone/verify`).send({ phone: account.phone, code: '111111' }).expect(400);
    const res = await request(ctx.app).post(`${API}/phone/verify`).send({ phone: account.phone, code: TEST_OTP }).expect(200);
    expect(res.body.data.user.phone).toBe(account.phone);
  });
});

describe('password reset', () => {
  it('resets via SMS code, revokes all sessions, and only the new password works', async () => {
    const { account, tokens } = await register();
    ctx.sms.sentTo.length = 0;

    await request(ctx.app).post(`${API}/password/forgot`).send({ identifier: account.email }).expect(200);
    expect(ctx.sms.sentTo).toEqual([account.phone]);

    await request(ctx.app)
      .post(`${API}/password/reset`)
      .send({ identifier: account.email, code: TEST_OTP, newPassword: 'NewPass2026' })
      .expect(200);

    await request(ctx.app).get(`${API}/me`).set('authorization', `Bearer ${tokens.accessToken}`).expect(401);
    await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: tokens.refreshToken }).expect(401);
    await request(ctx.app).post(`${API}/login`).send({ identifier: account.email, password: PASSWORD }).expect(401);
    await request(ctx.app).post(`${API}/login`).send({ identifier: account.email, password: 'NewPass2026' }).expect(200);
  });

  it('does not reveal whether the account exists', async () => {
    const res = await request(ctx.app).post(`${API}/password/forgot`).send({ identifier: 'ghost@example.com' }).expect(200);
    expect(res.body.data.message).toMatch(/If an account exists/);
  });

  it('enforces the password policy', async () => {
    const res = await request(ctx.app)
      .post(`${API}/password/reset`)
      .send({ identifier: 'ghost@example.com', code: TEST_OTP, newPassword: 'onlyletters' })
      .expect(400);
    expect(res.body.error.details.newPassword).toContain('Password must contain a number');
  });
});

describe('sessions and tokens', () => {
  it('GET /me requires a bearer token', async () => {
    const res = await request(ctx.app).get(`${API}/me`).expect(401);
    expect(res.body.error.code).toBe('AUTH_REQUIRED');
    const bad = await request(ctx.app).get(`${API}/me`).set('authorization', 'Bearer not-a-jwt').expect(401);
    expect(bad.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('GET /me returns the current user', async () => {
    const { account, tokens } = await register();
    const res = await request(ctx.app).get(`${API}/me`).set('authorization', `Bearer ${tokens.accessToken}`).expect(200);
    expect(res.body.data.user.email).toBe(account.email);
  });

  it('reports expired access tokens distinctly so the app knows to refresh', async () => {
    const { user } = await register();
    const expired = await new SignJWT({ sid: '00000000-0000-7000-8000-000000000000' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('project-x-api')
      .setAudience('project-x-app')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(ctx.env.JWT_ACCESS_SECRET));
    const res = await request(ctx.app).get(`${API}/me`).set('authorization', `Bearer ${expired}`).expect(401);
    expect(res.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
  });

  it('rotates refresh tokens and revokes the session when an old one is replayed', async () => {
    const { tokens } = await register();
    const first = await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: tokens.refreshToken }).expect(200);
    const rotated = first.body.data.tokens.refreshToken as string;
    expect(rotated).not.toBe(tokens.refreshToken);

    const replay = await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    // The replay killed the session, so the legitimately rotated token is dead too.
    await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: rotated }).expect(401);
    await request(ctx.app)
      .get(`${API}/me`)
      .set('authorization', `Bearer ${first.body.data.tokens.accessToken}`)
      .expect(401);
  });

  it('logout revokes the session immediately and is idempotent', async () => {
    const { tokens } = await register();
    await request(ctx.app).post(`${API}/logout`).send({ refreshToken: tokens.refreshToken }).expect(204);
    await request(ctx.app).post(`${API}/logout`).send({ refreshToken: tokens.refreshToken }).expect(204);

    const me = await request(ctx.app).get(`${API}/me`).set('authorization', `Bearer ${tokens.accessToken}`).expect(401);
    expect(me.body.error.code).toBe('SESSION_REVOKED');
    await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: tokens.refreshToken }).expect(401);
  });

  it('rejects garbage refresh tokens', async () => {
    await request(ctx.app).post(`${API}/refresh`).send({ refreshToken: 'garbage' }).expect(401);
    await request(ctx.app)
      .post(`${API}/refresh`)
      .send({ refreshToken: '00000000-0000-7000-8000-000000000000.abc' })
      .expect(401);
  });
});

describe('social sign-in', () => {
  it('does not create accounts from Google sign-in (existing accounts only)', async () => {
    ctx.google.profile = { subject: `g-${Date.now()}`, email: `google${Date.now()}@example.com`, emailVerified: true, fullName: 'Google Athlete' };
    const res = await request(ctx.app).post(`${API}/google`).send({ idToken: 'stub' }).expect(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('signs in to an existing account with the same verified email', async () => {
    const { account, user } = await register();
    ctx.google.profile = { subject: `g-link-${Date.now()}`, email: account.email, emailVerified: true, fullName: null };
    const res = await request(ctx.app).post(`${API}/google`).send({ idToken: 'stub' }).expect(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('refuses unknown Apple identities, even without an email', async () => {
    ctx.apple.profile = { subject: `a-${Date.now()}`, email: null, emailVerified: false, fullName: null };
    const res = await request(ctx.app).post(`${API}/apple`).send({ identityToken: 'stub' }).expect(404);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });
});

describe('routing', () => {
  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(ctx.app).get('/api/v1/nope').expect(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Resource not found.' } });
  });
});
