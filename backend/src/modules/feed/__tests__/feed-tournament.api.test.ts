/*
 * Result posts in the feed say which tournament a match was played in, and show the scorer as a
 * scorer (not a player) when they weren't on either side.
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
  const phone = `+9197${suffix}`;
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone, username: `f${suffix}` }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone, code: TEST_OTP }).expect(200);
  const res = await request(ctx.app)
    .post('/api/v1/auth/register/complete')
    .send({ username: `f${suffix}`, fullName: name, email: `f${suffix}@example.com`, password: 'Sprint2026', registrationToken: verify.body.data.registrationToken })
    .expect(201);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

interface FeedPostBody {
  match: { id: string; authorSideIndex: number | null; tournament: { id: string; name: string; eventName: string; roundName: string | null; groupName: string | null } | null } | null;
}

const feedPost = async (who: Account, matchId: string): Promise<FeedPostBody | undefined> =>
  ((await request(ctx.app).get('/api/v1/feed').set(as(who)).expect(200)).body.data.posts as FeedPostBody[]).find((p) => p.match?.id === matchId);

let organizer: Account;
let player: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  organizer = await register('Olive Organiser');
  player = await register('Pia Player');
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

describe('tournament matches in the feed', () => {
  it(
    'tags a knockout result with its tournament, event and round; the scorer is not on a side',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(organizer)).send({ name: 'Monsoon Open' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app)
          .post(`/api/v1/tournaments/${t.id}/events`)
          .set(as(organizer))
          .send({ name: 'Open Singles', sport: 'pickleball', format: 'singles', drawFormat: 'knockout' })
          .expect(201)
      ).body.data.event;
      for (const name of ['Kiran', 'Lata']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(organizer)).send({ players: [{ guest: { displayName: name } }] }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(organizer)).send({ randomSeed: 1 }).expect(200)).body.data.event;
      const fixture = drawn.fixtures[0] as { id: string; roundName: string | null };
      const match = (await request(ctx.app).post(`/api/v1/fixtures/${fixture.id}/result`).set(as(organizer)).send({ scores: [[11, 6]] }).expect(200)).body.data.match;

      const post = await feedPost(organizer, match.id);
      expect(post?.match).toMatchObject({
        authorSideIndex: null,
        tournament: { id: t.id, name: 'Monsoon Open', eventName: 'Open Singles', roundName: fixture.roundName, groupName: null },
      });
    },
    SLOW,
  );

  it(
    'names the group for a round-robin fixture',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(organizer)).send({ name: 'Tuesday League' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app)
          .post(`/api/v1/tournaments/${t.id}/events`)
          .set(as(organizer))
          .send({ name: 'Ladder', sport: 'pickleball', format: 'singles', drawFormat: 'round_robin' })
          .expect(201)
      ).body.data.event;
      for (const name of ['Mira', 'Nita', 'Omar']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(organizer)).send({ players: [{ guest: { displayName: name } }] }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(organizer)).send({ randomSeed: 1 }).expect(200)).body.data.event;
      const groups = (drawn.stages as Array<{ groups: Array<{ id: string; name: string }> }>).flatMap((s) => s.groups);
      const fixture = drawn.fixtures[0] as { id: string; groupId: string | null };
      const match = (await request(ctx.app).post(`/api/v1/fixtures/${fixture.id}/result`).set(as(organizer)).send({ scores: [[11, 9]] }).expect(200)).body.data.match;

      const post = await feedPost(organizer, match.id);
      expect(post?.match?.tournament).toMatchObject({ name: 'Tuesday League', eventName: 'Ladder' });
      const expectedGroup = groups.find((g) => g.id === fixture.groupId)?.name ?? null;
      expect(post?.match?.tournament?.groupName).toBe(expectedGroup);
    },
    SLOW,
  );

  it(
    'has no tournament on a friendly, and keeps the author’s side when they played',
    async () => {
      const match = (
        await request(ctx.app)
          .post('/api/v1/matches')
          .set(as(player))
          .send({ sport: 'pickleball', format: 'singles', manualScores: [[11, 3]], sides: [{ players: [{ userId: player.userId }] }, { players: [{ guest: { displayName: 'Quinn' } }] }] })
          .expect(201)
      ).body.data.match;
      const post = await feedPost(player, match.id);
      expect(post?.match).toMatchObject({ authorSideIndex: 0, tournament: null });
    },
    SLOW,
  );
});
