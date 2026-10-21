/*
 * End-to-end flows over HTTP against a throwaway schema built from the real migrations:
 * friendly matches (live, undo, public link, manual result + confirmation, guests and claiming)
 * and tournaments (knockout with a bye and a walkover, round robin standings).
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
  phone: string;
  username: string;
}

/** Sign-up in three steps: phone + username -> code -> details. */
async function signUp(account: { username: string; fullName: string; email: string; phone: string; password: string }) {
  await request(ctx.app).post('/api/v1/auth/register/start').send({ phone: account.phone, username: account.username }).expect(200);
  const verify = await request(ctx.app).post('/api/v1/auth/register/verify').send({ phone: account.phone, code: TEST_OTP }).expect(200);
  const { phone: _phone, ...rest } = account;
  return request(ctx.app).post('/api/v1/auth/register/complete').send({ ...rest, registrationToken: verify.body.data.registrationToken }).expect(201);
}

async function register(name = 'Test Player'): Promise<Account> {
  seq += 1;
  const suffix = String(Date.now() % 1_000_000).padStart(6, '0') + String(seq).padStart(2, '0');
  const account = { username: `p${suffix}`, fullName: name, email: `p${suffix}@example.com`, phone: `+9197${suffix}`, password: 'Sprint2026' };
  const res = await signUp(account);
  return { userId: res.body.data.user.id, token: res.body.data.tokens.accessToken, phone: account.phone, username: account.username };
}

const as = (a: Account) => ({ Authorization: `Bearer ${a.token}` });
const point = (sideIndex: number) => ({ type: 'rally_won', sideIndex });
/** Quick badminton rules so tests need few requests: one game to 3, no cap. */
const QUICK = { bestOf: 1, pointsToWin: 3, cap: null };

async function score(a: Account, matchId: string, sides: number[]) {
  let match = (await request(ctx.app).get(`/api/v1/matches/${matchId}`).set(as(a)).expect(200)).body.data.match;
  for (const s of sides) {
    match = (await request(ctx.app).post(`/api/v1/matches/${matchId}/events`).set(as(a)).send({ event: point(s), version: match.version }).expect(200)).body.data.match;
  }
  return match;
}

let alice: Account;
let bob: Account;

beforeAll(async () => {
  ctx = await createTestContext();
  alice = await register('Alice Kumar');
  bob = await register('Bob Singh');
}, SLOW);

afterAll(async () => {
  await ctx?.cleanup();
});

describe('sports catalogue', () => {
  it('lists only the 5 active racket sports, with formats and rulesets', async () => {
    const res = await request(ctx.app).get('/api/v1/sports').set(as(alice)).expect(200);
    const slugs = res.body.data.sports.map((s: { slug: string }) => s.slug);
    expect(slugs).toEqual(['badminton', 'table-tennis', 'pickleball', 'padel', 'tennis']);
    const padel = res.body.data.sports.find((s: { slug: string }) => s.slug === 'padel');
    expect(padel.formats.map((f: { code: string }) => f.code)).toEqual(['doubles']);
    await request(ctx.app).get('/api/v1/sports/volleyball').set(as(alice)).expect(404);
  });
});

describe('friendly match', () => {
  it(
    'is scored live, undone, finished, and updates stats, ratings, the feed and history',
    async () => {
      const created = await request(ctx.app)
        .post('/api/v1/matches')
        .set(as(alice))
        .send({ sport: 'badminton', format: 'singles', rulesOverride: QUICK, sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] })
        .expect(201);
      const m = created.body.data.match;
      expect(m).toMatchObject({ status: 'live', canScore: true, version: 0, sides: [{ name: 'Alice' }, { name: 'Bob' }] });
      expect(m.score.actions.map((a: { label: string }) => a.label)).toEqual(['Point', 'Point']);

      // Bob may watch but not score.
      const bobView = await request(ctx.app).get(`/api/v1/matches/${m.id}`).set(as(bob)).expect(200);
      expect(bobView.body.data.match.canScore).toBe(false);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(bob)).send({ event: point(1), version: 0 }).expect(403);

      let live = await score(alice, m.id, [0, 1]);
      expect(live.score.sides.map((s: { current: string }) => s.current)).toEqual(['1', '1']);
      // A stale version is refused; the same clientEventId never counts twice.
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: point(0), version: 0 }).expect(409);
      const clientEventId = '3f1f0b4e-2a8e-4c1e-9a55-0d6b0b1c9a01';
      live = (await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: point(0), version: live.version, clientEventId }).expect(200)).body.data.match;
      const again = (await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: point(0), version: live.version - 1, clientEventId }).expect(200)).body.data.match;
      expect(again.version).toBe(live.version);
      // An invalid event for this plugin is rejected.
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: { type: 'goal', sideIndex: 0 }, version: live.version }).expect(400);

      live = (await request(ctx.app).post(`/api/v1/matches/${m.id}/undo`).set(as(alice)).send({ version: live.version }).expect(200)).body.data.match;
      expect(live.score.sides.map((s: { current: string }) => s.current)).toEqual(['1', '1']);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: live.version }).expect(409);

      live = await score(alice, m.id, [0, 0]);
      expect(live.score).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '3-1' });
      const done = (await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: live.version }).expect(200)).body.data.match;
      expect(done).toMatchObject({ status: 'completed', resultType: 'played', canScore: false });
      expect(done.sides.map((s: { outcome: string }) => s.outcome)).toEqual(['won', 'lost']);
      expect(done.ratingChanges).toHaveLength(2);
      expect(done.ratingChanges.find((r: { before: number; after: number }) => r.after > r.before)).toBeTruthy();

      // Segments projection mirrors the replay.
      const segments = await ctx.db.matchSegment.findMany({ where: { matchId: m.id }, include: { scores: true } });
      expect(segments).toHaveLength(1);
      expect(segments[0]!.scores.map((s) => s.score).sort()).toEqual([1, 3]);

      const history = await request(ctx.app).get('/api/v1/profile/me/matches').set(as(bob)).expect(200);
      expect(history.body.data.matches[0]).toMatchObject({ matchId: m.id, outcome: 'lost', headline: '1-3', otherPlayers: ['Alice Kumar'] });
      const feed = await request(ctx.app).get('/api/v1/feed').set(as(alice)).expect(200);
      const post = feed.body.data.posts.find((p: { match: { id: string } | null }) => p.match?.id === m.id);
      expect(post.content).toBe('Alice beat Bob 3-1 · Badminton');
      expect(post.match.result).toMatchObject({ headline: '3-1', winnerSideIndex: 0 });

      // Public share link: JSON without user ids, and the HTML page.
      const pub = await request(ctx.app).get(`/api/v1/public/matches/${m.shareToken}`).expect(200);
      expect(pub.body.data.match.sides[0].players[0].userId).toBeNull();
      expect(pub.body.data.match).not.toHaveProperty('createdByUserId');
      const page = await request(ctx.app).get(`/s/${m.shareToken}`).expect(200);
      expect(page.text).toContain('/public-assets/page.js');
      await request(ctx.app).get('/public-assets/page.js').expect(200).expect('content-type', /javascript/);
    },
    SLOW,
  );

  it(
    'needs opponent confirmation before a manually entered result counts toward ratings',
    async () => {
      const res = await request(ctx.app)
        .post('/api/v1/matches')
        .set(as(alice))
        .send({ sport: 'table-tennis', format: 'singles', rulesetId: undefined, manualScores: [[11, 7], [9, 11], [11, 5]], rulesOverride: { bestOf: 3 }, sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] })
        .expect(201);
      const m = res.body.data.match;
      expect(m).toMatchObject({ status: 'completed', scoringMode: 'manual', ratingChanges: [], confirmation: { status: 'pending', canConfirm: false } });
      expect(m.score.headline).toBe('11-7, 9-11, 11-5');

      const pending = await request(ctx.app).get('/api/v1/matches/pending-confirmations').set(as(bob)).expect(200);
      expect(pending.body.data.matches.map((x: { id: string }) => x.id)).toContain(m.id);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/confirm`).set(as(alice)).send({ decision: 'confirmed' }).expect(403);
      const confirmed = (await request(ctx.app).post(`/api/v1/matches/${m.id}/confirm`).set(as(bob)).send({ decision: 'confirmed' }).expect(200)).body.data.match;
      expect(confirmed.confirmation.status).toBe('confirmed');
      expect(confirmed.ratingChanges).toHaveLength(2);

      // An impossible score is refused.
      await request(ctx.app)
        .post('/api/v1/matches')
        .set(as(alice))
        .send({ sport: 'table-tennis', format: 'singles', manualScores: [[11, 10]], sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] })
        .expect(400);
    },
    SLOW,
  );

  it(
    'records a disputed manual result and takes it out of the records',
    async () => {
      const m = (
        await request(ctx.app)
          .post('/api/v1/matches')
          .set(as(alice))
          .send({ sport: 'pickleball', format: 'singles', manualScores: [[11, 2]], sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] })
          .expect(201)
      ).body.data.match;
      const disputed = (await request(ctx.app).post(`/api/v1/matches/${m.id}/confirm`).set(as(bob)).send({ decision: 'disputed', comment: 'It was 11-9' }).expect(200)).body.data.match;
      expect(disputed).toMatchObject({ status: 'disputed', confirmation: { status: 'disputed' }, ratingChanges: [] });
      const stats = await ctx.db.playerSportStats.findMany({ where: { sportId: 1, player: { userId: bob.userId } } });
      expect(stats).toEqual([]);
    },
    SLOW,
  );

  it(
    'lets guests play without an account, and attaches their history when they sign up',
    async () => {
      seq += 1;
      const guestPhone = `+9196${String(Date.now() % 1_000_000).padStart(6, '0')}${String(seq).padStart(2, '0')}`;
      const m = (
        await request(ctx.app)
          .post('/api/v1/matches')
          .set(as(alice))
          .send({ sport: 'badminton', format: 'doubles', rulesOverride: QUICK, sides: [{ players: [{ userId: alice.userId }, { guest: { displayName: 'Chitra Rao', phone: guestPhone } }] }, { players: [{ userId: bob.userId }, { guest: { displayName: 'Dev' } }] }] })
          .expect(201)
      ).body.data.match;
      expect(m.sides[0].players[1]).toMatchObject({ displayName: 'Chitra Rao', isGuest: true });
      const live = await score(alice, m.id, [0, 0, 0]);
      const done = (await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: live.version }).expect(200)).body.data.match;
      expect(done.ratingChanges).toEqual([]); // guests involved: unrated

      // Chitra signs up with the guest's phone, is offered the match, and claims it.
      seq += 1;
      const account = { username: `chitra${seq}${Date.now() % 10000}`, fullName: 'Chitra Rao', email: `c${seq}${Date.now()}@example.com`, phone: guestPhone, password: 'Sprint2026' };
      const reg = await signUp(account);
      const chitra = { Authorization: `Bearer ${reg.body.data.tokens.accessToken}` };
      const guestId = m.sides[0].players[1].playerId;
      const offered = await request(ctx.app).get('/api/v1/players/claimable').set(chitra).expect(200);
      expect(offered.body.data.matches).toEqual([expect.objectContaining({ matchId: m.id, guestPlayerId: guestId })]);
      await request(ctx.app).post('/api/v1/players/claim').set(chitra).send({ playerIds: [guestId] }).expect(200);
      const me = (await request(ctx.app).get('/api/v1/players/me').set(chitra).expect(200)).body.data.player;
      expect(me).toMatchObject({ isGuest: false });
      const history = await request(ctx.app).get('/api/v1/profile/me/matches').set(chitra).expect(200);
      expect(history.body.data.matches[0]).toMatchObject({ matchId: m.id, outcome: 'won' });
    },
    SLOW,
  );
});

describe('tournaments', () => {
  it(
    'runs a knockout with a bye, a walkover and a live final, and shows it publicly',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Office Smash Cup', venueName: 'Koramangala Club' }).expect(201)).body.data.tournament;
      expect(t).toMatchObject({ isOrganizer: true, status: 'draft' });
      await request(ctx.app).post(`/api/v1/tournaments/${t.id}/courts`).set(as(alice)).send({ name: 'Court 1' }).expect(201);
      const event = (
        await request(ctx.app)
          .post(`/api/v1/tournaments/${t.id}/events`)
          .set(as(alice))
          .send({ name: "Men's Singles", sport: 'badminton', format: 'singles', drawFormat: 'knockout', rulesOverride: QUICK })
          .expect(201)
      ).body.data.event;
      // Bob is seed 1 (gets the bye); two guests play the other semi-final.
      await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ userId: bob.userId }], seed: 1 }).expect(201);
      await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: 'Eshan' } }] }).expect(201);
      const withEntries = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: 'Farid' } }] }).expect(201)).body.data.event;
      expect(withEntries.entries).toHaveLength(3);
      // Bob can't organize.
      await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(bob)).send({}).expect(403);

      const preview = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ preview: true, randomSeed: 7 }).expect(200)).body.data;
      expect(preview.preview[0].fixtures).toHaveLength(3);
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ randomSeed: 7 }).expect(200)).body.data.event;
      const [semi1, semi2, final] = drawn.fixtures as Array<{ id: string; status: string; entries: Array<{ name: string } | null>; placeholders: Array<string | null> }>;
      expect(semi1!.status).toBe('bye');
      expect(semi2!.status).toBe('ready');
      expect(final!.entries[0]!.name).toBe('Bob Singh');
      expect(final!.placeholders[1]).toBe('Winner of Semi-final 2');

      // Eshan doesn't turn up: Farid advances by walkover (no rating change, no match points played).
      const farid = drawn.entries.find((e: { name: string }) => e.name === 'Farid');
      const wo = (await request(ctx.app).post(`/api/v1/fixtures/${semi2!.id}/walkover`).set(as(alice)).send({ winnerEntryId: farid.id, reason: 'no_show' }).expect(200)).body.data.match;
      expect(wo).toMatchObject({ status: 'walkover', resultType: 'no_show', context: 'tournament' });

      const finalMatch = (await request(ctx.app).post(`/api/v1/fixtures/${final!.id}/start`).set(as(alice)).send({}).expect(200)).body.data.match;
      expect(finalMatch.tournament).toMatchObject({ name: 'Office Smash Cup', roundName: 'Final' });
      const live = await score(alice, finalMatch.id, [1, 0, 0, 0]);
      await request(ctx.app).post(`/api/v1/matches/${finalMatch.id}/complete`).set(as(alice)).send({ version: live.version }).expect(200);

      const after = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      expect(after.status).toBe('completed');
      expect(after.fixtures[2]).toMatchObject({ status: 'completed', match: { headline: '3-1' } });
      expect(after.fixtures[2].winnerEntryId).toBe(after.entries.find((e: { name: string }) => e.name === 'Bob Singh').id);

      const pub = await request(ctx.app).get(`/api/v1/public/tournaments/${t.slug}`).expect(200);
      expect(pub.body.data.tournament).toMatchObject({ name: 'Office Smash Cup', status: 'completed', isOrganizer: false, staff: [] });
      await request(ctx.app).get(`/t/${t.slug}`).expect(200);
    },
    SLOW,
  );

  it(
    'ranks a round robin from manual results entered by staff',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Tuesday League' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app)
          .post(`/api/v1/tournaments/${t.id}/events`)
          .set(as(alice))
          .send({ name: 'Open', sport: 'pickleball', format: 'singles', drawFormat: 'round_robin' })
          .expect(201)
      ).body.data.event;
      for (const name of ['Gita', 'Hari', 'Isha']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: name } }] }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ randomSeed: 1 }).expect(200)).body.data.event;
      expect(drawn.fixtures).toHaveLength(3);
      const name = (id: string) => drawn.entries.find((e: { id: string }) => e.id === id).name;
      // Gita wins both her matches; Hari beats Isha.
      for (const f of drawn.fixtures as Array<{ id: string; entries: Array<{ id: string }> }>) {
        const [a, b] = f.entries.map((e) => name(e.id));
        const aWins = a === 'Gita' || (a === 'Hari' && b === 'Isha');
        await request(ctx.app).post(`/api/v1/fixtures/${f.id}/result`).set(as(alice)).send({ scores: [aWins ? [11, 4] : [4, 11]] }).expect(200);
      }
      const after = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      const table = after.stages[0].groups[0].standings;
      expect(table.map((r: { name: string }) => r.name)).toEqual(['Gita', 'Hari', 'Isha']);
      expect(table[0]).toMatchObject({ played: 2, won: 2, majorWon: 2, minorWon: 22, minorLost: 8 });
      expect(after.status).toBe('completed');
    },
    SLOW,
  );
});
