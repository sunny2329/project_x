/*
 * Profile v2 over HTTP: the 1500 start rating, per-sport insights (placement, tier, record,
 * splits, partner and rival), the hero tiles (streak, titles) and handedness.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, TEST_OTP, type TestContext } from '../../../test/harness.js';

let ctx: TestContext;
let seq = 0;
const SLOW = 240_000;

interface Account {
  userId: string;
  token: string;
}

async function register(name: string): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const phone = `+9196${suffix}`;
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone, username: `i${suffix}` }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone, code: TEST_OTP }).expect(200);
  const res = await request(ctx.app)
    .post('/api/v1/auth/register/complete')
    .send({ username: `i${suffix}`, fullName: name, email: `i${suffix}@example.com`, password: 'Sprint2026', registrationToken: verify.body.data.registrationToken })
    .expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
/** One game to 3: three points finish a match. */
const QUICK = { bestOf: 1, pointsToWin: 3, cap: null };

/** Plays a quick badminton match that side `winner` wins 3-0 and returns the completed match. */
async function play(scorer: Account, sides: Account[][], winner: 0 | 1) {
  const format = sides[0]!.length > 1 ? 'doubles' : 'singles';
  const created = await request(ctx.app)
    .post('/api/v1/matches')
    .set(as(scorer))
    .send({ sport: 'badminton', format, rulesOverride: QUICK, sides: sides.map((players) => ({ players: players.map((p) => ({ userId: p.userId })) })) })
    .expect(201);
  let match = created.body.data.match;
  for (let i = 0; i < 3; i += 1) {
    match = (await request(ctx.app).post(`/api/v1/matches/${match.id}/events`).set(as(scorer)).send({ event: { type: 'rally_won', sideIndex: winner }, version: match.version }).expect(200)).body
      .data.match;
  }
  return (await request(ctx.app).post(`/api/v1/matches/${match.id}/complete`).set(as(scorer)).send({ version: match.version }).expect(200)).body.data.match;
}

let alice: Account;
let bob: Account;
let carol: Account;
let dan: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  [alice, bob, carol, dan] = [await register('Alice Kumar'), await register('Bob Singh'), await register('Carol Das'), await register('Dan Roy')];
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

describe('profile insights', () => {
  it(
    'needs a session and a real, active sport and user',
    async () => {
      await request(ctx.app).get('/api/v1/profile/me/sports/badminton/insights').expect(401);
      await request(ctx.app).get(`/api/v1/users/${bob.userId}/sports/badminton/insights`).expect(401);
      await request(ctx.app).get('/api/v1/profile/me/sports/curling/insights').set(as(alice)).expect(404);
      // Volleyball exists but is inactive.
      const inactive = await request(ctx.app).get('/api/v1/profile/me/sports/volleyball/insights').set(as(alice)).expect(404);
      expect(inactive.body.error.code).toBe('SPORT_NOT_FOUND');
      await request(ctx.app).get('/api/v1/users/not-a-uuid/sports/badminton/insights').set(as(alice)).expect(404);
      await request(ctx.app).get('/api/v1/users/00000000-0000-4000-8000-000000000000/sports/badminton/insights').set(as(alice)).expect(404);
    },
    SLOW,
  );

  it(
    'starts a new player at 1500 in placement with nothing to show',
    async () => {
      const res = await request(ctx.app).get('/api/v1/profile/me/sports/badminton/insights').set(as(dan)).expect(200);
      const insights = res.body.data.insights;
      // A brand-new account may not have a player row yet; either way it is unplayed.
      if (insights) {
        expect(insights).toMatchObject({ rating: 1500, ratedMatches: 0, provisional: true, placementsLeft: 3, confidence: 'placement', tier: null, percentile: null });
        expect(insights.record).toEqual({ played: 0, won: 0, lost: 0, drawn: 0, winRate: null });
        expect(insights.form).toEqual([]);
      }
      const me = (await request(ctx.app).get('/api/v1/profile/me').set(as(dan)).expect(200)).body.data.profile;
      expect(me).toMatchObject({ handedness: null, streak: null, titles: 0 });
    },
    SLOW,
  );

  it(
    'rates from 1500 and builds the full picture after a few matches',
    async () => {
      const first = await play(alice, [[alice], [bob]], 0);
      expect(first.ratingChanges.map((r: { before: number }) => r.before)).toEqual([1500, 1500]);
      await play(alice, [[alice], [bob]], 0);
      // Placement: two rated matches, still provisional.
      let insights = (await request(ctx.app).get('/api/v1/profile/me/sports/badminton/insights').set(as(alice)).expect(200)).body.data.insights;
      expect(insights).toMatchObject({ ratedMatches: 2, provisional: true, placementsLeft: 1, tier: null, percentile: null });

      await play(bob, [[alice], [bob]], 1);
      await play(alice, [[alice, carol], [bob, dan]], 0);

      insights = (await request(ctx.app).get('/api/v1/profile/me/sports/badminton/insights').set(as(alice)).expect(200)).body.data.insights;
      expect(insights).toMatchObject({ ratedMatches: 4, provisional: false, placementsLeft: 0, confidence: 'low' });
      expect(insights.rating).toBeGreaterThan(1500);
      expect(insights.tier.key).toBe('silver');
      expect(insights.peak).toBeGreaterThanOrEqual(insights.rating);
      expect(insights.delta30).toBe(insights.rating - 1500);
      expect(insights.trend['1M'][0]).toBe(1500);
      expect(insights.trend['1M']).toHaveLength(5);
      expect(insights.record).toEqual({ played: 4, won: 3, lost: 1, drawn: 0, winRate: 75 });
      expect(insights.form).toEqual(['W', 'W', 'L', 'W']);
      expect(insights.split).toEqual({ singles: { won: 2, lost: 1 }, doubles: { won: 1, lost: 0 } });
      expect(insights.stats).toMatchObject({ minorWonPct: 75, avgMinorMargin: 1.5, bestStreak: 2, comebacks: 0, deciding: { won: 0, lost: 0 } });
      expect(insights.activity).toHaveLength(4);
      // Opponent strength at match time: every result lands in a band.
      const banded = insights.vsStrength.reduce((n: number, b: { won: number; lost: number }) => n + b.won + b.lost, 0);
      expect(banded).toBe(4);
      expect(insights.partner).toMatchObject({ userId: carol.userId, name: 'Carol Das', matches: 1, won: 1, lost: 0 });
      expect(insights.rival).toMatchObject({ userId: bob.userId, name: 'Bob Singh', matches: 4, won: 3, lost: 1 });
      expect(insights.rival.rating).toBeLessThan(1500);
      // Only two players are out of placement: too few for a percentile.
      expect(insights.percentile).toBeNull();
    },
    SLOW,
  );

  it(
    'shows the same insights to another player, never mixing sports',
    async () => {
      const mine = (await request(ctx.app).get('/api/v1/profile/me/sports/badminton/insights').set(as(alice)).expect(200)).body.data.insights;
      const seen = (await request(ctx.app).get(`/api/v1/users/${alice.userId}/sports/badminton/insights`).set(as(bob)).expect(200)).body.data.insights;
      expect(seen).toEqual(mine);
      const tennis = (await request(ctx.app).get(`/api/v1/users/${alice.userId}/sports/tennis/insights`).set(as(bob)).expect(200)).body.data.insights;
      expect(tennis).toMatchObject({ rating: 1500, ratedMatches: 0, provisional: true });
      expect(tennis.record.played).toBe(0);
    },
    SLOW,
  );

  it(
    'puts the streak, titles and 30-day change on the profile',
    async () => {
      const me = (await request(ctx.app).get('/api/v1/profile/me').set(as(alice)).expect(200)).body.data.profile;
      expect(me.streak).toEqual({ kind: 'W', count: 1 });
      expect(me.titles).toBe(0);
      const other = (await request(ctx.app).get(`/api/v1/users/${bob.userId}`).set(as(alice)).expect(200)).body.data.user;
      expect(other.streak).toEqual({ kind: 'L', count: 1 });
      const badminton = other.sports.find((s: { slug: string }) => s.slug === 'badminton');
      if (badminton) expect(badminton.delta30).toBe(Math.round(badminton.rating - 1500));
    },
    SLOW,
  );

  it(
    'saves, validates and clears handedness',
    async () => {
      const set = await request(ctx.app).patch('/api/v1/profile/me').set(as(alice)).send({ handedness: 'left' }).expect(200);
      expect(set.body.data.profile.handedness).toBe('left');
      const bad = await request(ctx.app).patch('/api/v1/profile/me').set(as(alice)).send({ handedness: 'both' }).expect(400);
      expect(bad.body.error.details.handedness).toBeTruthy();
      expect((await request(ctx.app).get(`/api/v1/users/${alice.userId}`).set(as(bob)).expect(200)).body.data.user.handedness).toBe('left');
      // Other edits leave it alone; null clears it.
      expect((await request(ctx.app).patch('/api/v1/profile/me').set(as(alice)).send({ city: 'Jaipur' }).expect(200)).body.data.profile.handedness).toBe('left');
      expect((await request(ctx.app).patch('/api/v1/profile/me').set(as(alice)).send({ handedness: null }).expect(200)).body.data.profile.handedness).toBeNull();
    },
    SLOW,
  );
});
