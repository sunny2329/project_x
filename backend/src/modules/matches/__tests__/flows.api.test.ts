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
  it('lists only the active sports, with formats and rulesets', async () => {
    const res = await request(ctx.app).get('/api/v1/sports').set(as(alice)).expect(200);
    const slugs = res.body.data.sports.map((s: { slug: string }) => s.slug);
    expect(slugs).toEqual(['badminton', 'table-tennis', 'pickleball', 'padel', 'tennis', 'box-cricket', 'basketball']);
    const hoops = res.body.data.sports.find((s: { slug: string }) => s.slug === 'basketball');
    expect(hoops.formats.map((f: { code: string; maxPerSide: number }) => [f.code, f.maxPerSide])).toEqual([['3v3', 12], ['4v4', 12], ['5v5', 12]]);
    expect(hoops.rulesets.map((r: { slug: string; scoringModel: string }) => [r.slug, r.scoringModel])).toEqual([['3v3-21', 'baskets'], ['4v4-halves', 'baskets'], ['5v5-quarters', 'baskets']]);
    const cricket = res.body.data.sports.find((s: { slug: string }) => s.slug === 'box-cricket');
    expect(cricket.formats).toEqual([expect.objectContaining({ code: 'team', minPerSide: 1, maxPerSide: 11 })]);
    expect(cricket.rulesets.filter((r: { isDefault: boolean }) => r.isDefault)).toEqual([expect.objectContaining({ slug: 'overs-6', scoringModel: 'overs' })]);
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

describe('box cricket', () => {
  const ball = (runs: number, extra = 'none', wicket = false) => ({ type: 'ball', runs, extra, wicket });
  const END = { type: 'innings_end' };
  const QUICK_OVERS = { overs: 1, wickets: 2 };

  async function send(a: Account, matchId: string, events: object[]) {
    let match = (await request(ctx.app).get(`/api/v1/matches/${matchId}`).set(as(a)).expect(200)).body.data.match;
    for (const event of events) {
      match = (await request(ctx.app).post(`/api/v1/matches/${matchId}/events`).set(as(a)).send({ event, version: match.version }).expect(200)).body.data.match;
    }
    return match;
  }

  const teams = () => [{ players: [{ userId: alice.userId }, { guest: { displayName: 'Gita' } }, { guest: { displayName: 'Hari' } }] }, { players: [{ userId: bob.userId }] }];

  it(
    'plays a friendly ball by ball with uneven teams: toss, undo, bad balls, chase, stats and feed',
    async () => {
      const create = (body: object) => request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ sport: 'box-cricket', format: 'team', sides: teams(), ...body });
      await create({ rulesOverride: { overs: 0 } }).expect(400);
      await create({ format: 'singles' }).expect(400);

      const m = (await create({ rulesOverride: { ...QUICK_OVERS, battingFirstSideIndex: 1 } }).expect(201)).body.data.match;
      expect(m).toMatchObject({ status: 'live', score: { scoringModel: 'overs', headline: '- v 0/0' }, ruleset: { name: '1 over · 2 wickets' } });
      expect(m.score.sides[1].serving).toBe(true);

      // Not the scorer; an impossible ball; unknown event: all refused, nothing counted.
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(bob)).send({ event: ball(1), version: 0 }).expect(403);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: ball(7), version: 0 }).expect(400);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: { type: 'rally_won', sideIndex: 0 }, version: 0 }).expect(400);

      // The toss went the other way, so side 0 bats first after all.
      const swapped = await send(alice, m.id, [{ type: 'swap_batting' }, ball(4), ball(0, 'wide'), ball(2, 'none', true)]);
      expect(swapped.score.sides[0]).toMatchObject({ primary: '7/1', serving: true });
      expect(swapped.score.ticker).toEqual(['4', 'Wd', '2 W']);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: { type: 'swap_batting' }, version: swapped.version }).expect(400);

      const undone = (await request(ctx.app).post(`/api/v1/matches/${m.id}/undo`).set(as(alice)).send({ version: swapped.version }).expect(200)).body.data.match;
      expect(undone.score.sides[0].primary).toBe('5/0');

      await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: undone.version }).expect(409);

      const chased = await send(alice, m.id, [END, ball(4), ball(2)]);
      expect(chased.score).toMatchObject({ complete: true, winnerSideIndex: 1, callout: 'Won by 2 wickets', headline: '5/0 v 6/0' });
      const done = (await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: chased.version }).expect(200)).body.data.match;
      expect(done).toMatchObject({ status: 'completed', resultType: 'played' });
      expect(done.sides.map((s: { outcome: string }) => s.outcome)).toEqual(['lost', 'won']);
      expect(done.ratingChanges).toEqual([]); // guests involved: unrated

      const segments = await ctx.db.matchSegment.findMany({ where: { matchId: m.id }, include: { scores: true } });
      expect(segments.map((s) => s.type).sort()).toEqual(['innings', 'innings', 'regulation']);
      const stats = await ctx.db.playerSportStats.findFirst({ where: { sportId: 6, player: { userId: bob.userId } } });
      expect(stats).toMatchObject({ matchesPlayed: 1, won: 1, majorWon: 1, minorWon: 6, minorLost: 5 });
      const pub = await request(ctx.app).get(`/api/v1/public/matches/${done.shareToken}`).expect(200);
      expect(pub.body.data.match.score).toMatchObject({ scoringModel: 'overs', headline: '5/0 v 6/0' });
      await request(ctx.app).get(`/s/${done.shareToken}`).expect(200);
      const script = await request(ctx.app).get('/public-assets/page.js').expect(200);
      expect(() => new Function(script.text)).not.toThrow(); // The cricket columns live in this browser script.
    },
    SLOW,
  );

  it(
    'plays the rules a friendly changed: players a side, balls an over, extras, and a typed-in result',
    async () => {
      const create = (body: object) => request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ sport: 'box-cricket', format: 'team', sides: teams(), ...body });
      // Side A lists three players: too many for 2 a side; wickets may not outnumber players.
      await create({ rulesOverride: { overs: 2, wickets: 2, playersPerSide: 2 } }).expect(400);
      await create({ rulesOverride: { overs: 2, wickets: 4, playersPerSide: 3 } }).expect(400);
      await create({ rulesOverride: { overs: 2, wickets: 2, ballsPerOver: 11 } }).expect(400);

      const rules = { overs: 1, wickets: 3, playersPerSide: 3, ballsPerOver: 4, wideRuns: 2 };
      const m = (await create({ rulesOverride: rules }).expect(201)).body.data.match;
      expect(m.ruleset.name).toBe('1 over · 3 wickets · 3 a side · 4-ball overs');
      expect(m.rulesetConfig).toMatchObject(rules);
      const first = await send(alice, m.id, [ball(0, 'wide'), ball(1), ball(1), ball(1), ball(1)]);
      expect(first.score.sides).toMatchObject([{ primary: '6/0', serving: false }, { primary: '0/0', serving: true }]);

      const typed = (await create({ rulesOverride: rules, manualScores: [[30, 20]] }).expect(201)).body.data.match;
      expect(typed).toMatchObject({ status: 'completed', ruleset: { name: '1 over · 3 wickets · 3 a side · 4-ball overs' } });
    },
    SLOW,
  );

  it(
    'takes a tied match through a super over to a winner, and rates registered players',
    async () => {
      const m = (
        await request(ctx.app)
          .post('/api/v1/matches')
          .set(as(alice))
          .send({ sport: 'box-cricket', format: 'team', rulesOverride: QUICK_OVERS, sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] })
          .expect(201)
      ).body.data.match;
      const tied = await send(alice, m.id, [ball(3), END, ball(3), END]);
      expect(tied.score).toMatchObject({ complete: false, callout: 'Super over' });
      await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: tied.version }).expect(409);
      const after = await send(alice, m.id, [ball(1), END, ball(2)]);
      expect(after.score).toMatchObject({ complete: true, winnerSideIndex: 0, callout: 'Won the super over' });
      const done = (await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: after.version }).expect(200)).body.data.match;
      expect(done.ratingChanges).toHaveLength(2);
      const segments = await ctx.db.matchSegment.findMany({ where: { matchId: m.id, parentId: null } });
      expect(segments.map((s) => s.type).sort()).toEqual(['regulation', 'super_over']);
    },
    SLOW,
  );

  it(
    'records a typed-in result for the opponent to confirm, and refuses a level one',
    async () => {
      const body = { sport: 'box-cricket', format: 'team', sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] };
      await request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ ...body, manualScores: [[48, 48]] }).expect(400);
      await request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ ...body, manualScores: [[48, 45], [1, 0]] }).expect(400);
      const m = (await request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ ...body, manualScores: [[48, 48], [12, 8]] }).expect(201)).body.data.match;
      expect(m).toMatchObject({ status: 'completed', score: { winnerSideIndex: 0, headline: '48 v 48, SO 12 v 8' }, confirmation: { status: 'pending' } });
      await request(ctx.app).post(`/api/v1/matches/${m.id}/confirm`).set(as(bob)).send({ decision: 'confirmed' }).expect(200);
    },
    SLOW,
  );

  it(
    'runs a knockout tournament event: a tied final still produces a champion, and a walkover counts',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Box Bash' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app).post(`/api/v1/tournaments/${t.id}/events`).set(as(alice)).send({ name: 'Open', sport: 'box-cricket', format: 'team', drawFormat: 'knockout', rulesOverride: QUICK_OVERS }).expect(201)
      ).body.data.event;
      for (const name of ['Kings', 'Lions', 'Mavs']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: `${name} A` } }, { guest: { displayName: `${name} B` } }] }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ randomSeed: 3 }).expect(200)).body.data.event;
      const semi = drawn.fixtures.find((f: { status: string }) => f.status === 'ready');
      await request(ctx.app).post(`/api/v1/fixtures/${semi.id}/walkover`).set(as(alice)).send({ winnerEntryId: semi.entries[0].id, reason: 'walkover' }).expect(200);

      const before = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      const final = before.fixtures.at(-1);
      const match = (await request(ctx.app).post(`/api/v1/fixtures/${final.id}/start`).set(as(alice)).send({}).expect(200)).body.data.match;
      const played = await send(alice, match.id, [ball(2), END, ball(2), END, ball(0), END, ball(1)]);
      expect(played.score.complete).toBe(true);
      await request(ctx.app).post(`/api/v1/matches/${match.id}/complete`).set(as(alice)).send({ version: played.version }).expect(200);

      const after = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      expect(after.status).toBe('completed');
      expect(after.fixtures.at(-1).winnerEntryId).toBeTruthy();
      expect(after.fixtures.at(-1).match.segments).toEqual([[2, 2], [1, 0]]);
    },
    SLOW,
  );

  it(
    'holds tournament entries to the event’s players a side',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Box Sixes' }).expect(201)).body.data.tournament;
      const add = (rulesOverride: object, name = 'Sixes') => request(ctx.app).post(`/api/v1/tournaments/${t.id}/events`).set(as(alice)).send({ name, sport: 'box-cricket', format: 'team', drawFormat: 'knockout', rulesOverride });
      await add({ playersPerSide: 2, wickets: 3 }).expect(400);
      await add({ playersPerSide: 12 }).expect(400);
      const event = (await add({ ...QUICK_OVERS, playersPerSide: 2 }).expect(201)).body.data.event;
      expect(event).toMatchObject({ format: { playersPerSide: 2 }, ruleset: { name: '1 over · 2 wickets · 2 a side' } });
      const entry = (players: string[]) => request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: players.map((displayName) => ({ guest: { displayName } })) });
      await entry(['Ann', 'Bea', 'Cal']).expect(400);
      await entry(['Ann', 'Bea']).expect(201);
      await entry(['Dev']).expect(201);
      const page = (await request(ctx.app).get(`/api/v1/tournaments/${t.id}`).set(as(alice)).expect(200)).body.data.tournament;
      expect(page.events[0]).toMatchObject({ format: { playersPerSide: 2 }, ruleset: { name: '1 over · 2 wickets · 2 a side' } });
    },
    SLOW,
  );

  it(
    'ranks a round robin on wins, then run difference',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Box League' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app).post(`/api/v1/tournaments/${t.id}/events`).set(as(alice)).send({ name: 'League', sport: 'box-cricket', format: 'team', drawFormat: 'round_robin', drawConfig: { legs: 1 }, rulesOverride: QUICK_OVERS }).expect(201)
      ).body.data.event;
      for (const name of ['Kings', 'Lions', 'Mavs']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: [{ guest: { displayName: name } }] }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ randomSeed: 3 }).expect(200)).body.data.event;
      for (const f of drawn.fixtures) {
        const match = (await request(ctx.app).post(`/api/v1/fixtures/${f.id}/start`).set(as(alice)).send({}).expect(200)).body.data.match;
        const played = await send(alice, match.id, [ball(4), END, ball(1), END]);
        await request(ctx.app).post(`/api/v1/matches/${match.id}/complete`).set(as(alice)).send({ version: played.version }).expect(200);
      }
      const after = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      const rows = after.stages[0].groups[0].standings;
      expect(rows).toHaveLength(3);
      expect(rows.reduce((sum: number, r: { won: number }) => sum + r.won, 0)).toBe(3);
      expect(rows.reduce((sum: number, r: { played: number }) => sum + r.played, 0)).toBe(6);
      expect(rows.reduce((sum: number, r: { minorWon: number }) => sum + r.minorWon, 0)).toBe(15);
    },
    SLOW,
  );
});

describe('basketball', () => {
  async function send(a: Account, matchId: string, events: object[]) {
    let match = (await request(ctx.app).get(`/api/v1/matches/${matchId}`).set(as(a)).expect(200)).body.data.match;
    for (const event of events) {
      match = (await request(ctx.app).post(`/api/v1/matches/${matchId}/events`).set(as(a)).send({ event, version: match.version }).expect(200)).body.data.match;
    }
    return match;
  }
  const hoop = (sideIndex: number, points: number, extra: object = {}) => ({ type: 'score', sideIndex, points, ...extra });
  const teams = () => [
    {
      name: 'Pink City Ballers',
      color: '#3B82F6',
      players: [
        { userId: alice.userId, jerseyNumber: 7 },
        { guest: { displayName: 'Kabir Mehta' }, jerseyNumber: 11 },
        { guest: { displayName: 'Rohan Das' }, jerseyNumber: 23 },
        { guest: { displayName: 'Neel Gupta' } },
      ],
    },
    {
      name: 'Hawa Mahal Hoopers',
      color: '#F2EDE7',
      players: [
        { userId: bob.userId, jerseyNumber: 4 },
        { guest: { displayName: 'Ishaan Rathore' }, jerseyNumber: 9 },
        { guest: { displayName: 'Yash Bhatia' }, jerseyNumber: 30 },
      ],
    },
  ];
  const create = (body: object) => request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ sport: 'basketball', format: '3v3', sides: teams(), ...body });

  it(
    'creates a 3v3 game with team names, colours and shirt numbers, and refuses bad ones',
    async () => {
      const bad = (mutate: (t: ReturnType<typeof teams>) => void) => {
        const sides = teams();
        mutate(sides);
        return create({ sides }).expect(400);
      };
      await bad((t) => (t[0]!.players[1]!.jerseyNumber = 7)); // same number twice on a team
      await bad((t) => (t[0]!.players[1]!.jerseyNumber = 100));
      await bad((t) => (t[0]!.players[1]!.jerseyNumber = -1));
      await bad((t) => (t[0]!.color = 'blue'));
      await bad((t) => (t[0]!.players = Array.from({ length: 13 }, (_, i) => ({ guest: { displayName: `P${i}` }, jerseyNumber: i }))));
      await create({ rulesOverride: { mode: 'target', target: 4 } }).expect(400); // below the minimum target
      await create({ rulesOverride: { threePointers: 'yes' } }).expect(400);

      // Same number on different teams is fine.
      const sides = teams();
      sides[1]!.players[1]!.jerseyNumber = 7;
      const m = (await create({ sides }).expect(201)).body.data.match;
      expect(m).toMatchObject({ status: 'live', ruleset: { name: 'First to 21 · 10 min limit', scoringModel: 'baskets' }, format: { code: '3v3' } });
      expect(m.sides.map((s: { name: string; color: string }) => [s.name, s.color])).toEqual([
        ['Pink City Ballers', '#3B82F6'],
        ['Hawa Mahal Hoopers', '#F2EDE7'],
      ]);
      expect(m.sides[0].players.map((p: { jerseyNumber: number | null }) => p.jerseyNumber)).toEqual([7, 11, 23, null]);
      expect(m.sides[1].players.map((p: { jerseyNumber: number | null }) => p.jerseyNumber)).toEqual([4, 7, 30]);
      expect(m.score.game).toMatchObject({ periodLabel: 'Game', possessionSideIndex: 0 });
      expect(m.score.game.players[0].map((p: { onCourt: boolean }) => p.onCourt)).toEqual([true, true, true, false]);

      // Other sports still take players without numbers, and never show any.
      const racket = (await request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ sport: 'badminton', format: 'singles', sides: [{ players: [{ userId: alice.userId }] }, { players: [{ userId: bob.userId }] }] }).expect(201)).body.data.match;
      expect(racket.sides[0]).toMatchObject({ color: null, players: [{ jerseyNumber: null }] });
    },
    SLOW,
  );

  it(
    'scores first to 21 with who-scored tags, fouls and a sub, then finishes with stats and the public page',
    async () => {
      const m = (await create({ rulesOverride: { target: 11 } }).expect(201)).body.data.match;
      expect(m.ruleset.name).toBe('First to 11 · 10 min limit');
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: hoop(0, 3), version: 0 }).expect(400); // no 3s in these rules
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: { type: 'tag', playerIndex: 0 }, version: 0 }).expect(400); // nothing to tag
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(bob)).send({ event: hoop(1, 2), version: 0 }).expect(403);

      const live = await send(alice, m.id, [
        hoop(0, 2, { clock: 580 }),
        { type: 'tag', playerIndex: 1, assistIndex: 0 },
        { type: 'foul', sideIndex: 1, playerIndex: 2, clock: 560 },
        { type: 'sub', sideIndex: 0, outIndex: 2, inIndex: 3 },
        hoop(1, 1, { playerIndex: 0 }),
      ]);
      expect(live.score).toMatchObject({ headline: '2-1', complete: false });
      expect(live.score.game.players[0][1]).toMatchObject({ points: 2, twos: 1 });
      expect(live.score.game.players[0][0]).toMatchObject({ assists: 1 });
      expect(live.score.game.players[0].map((p: { onCourt: boolean }) => p.onCourt)).toEqual([true, true, false, true]);
      expect(live.score.game.teams[1]).toMatchObject({ fouls: 1 });

      const undone = (await request(ctx.app).post(`/api/v1/matches/${m.id}/undo`).set(as(alice)).send({ version: live.version }).expect(200)).body.data.match;
      expect(undone.score.headline).toBe('2-0');

      const won = await send(alice, m.id, Array.from({ length: 5 }, () => hoop(0, 2)));
      expect(won.score).toMatchObject({ complete: true, winnerSideIndex: 0, headline: '12-0', callout: 'Won by 12' });
      const done = (await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: won.version }).expect(200)).body.data.match;
      expect(done.sides.map((s: { outcome: string }) => s.outcome)).toEqual(['won', 'lost']);
      const stats = await ctx.db.playerSportStats.findFirst({ where: { sportId: 9, player: { userId: alice.userId } } });
      expect(stats).toMatchObject({ matchesPlayed: 1, won: 1, minorWon: 12, minorLost: 0 });
      const segments = await ctx.db.matchSegment.findMany({ where: { matchId: m.id } });
      expect(segments.map((s) => s.type)).toEqual(['game']);
      const pub = await request(ctx.app).get(`/api/v1/public/matches/${done.shareToken}`).expect(200);
      expect(pub.body.data.match.score).toMatchObject({ scoringModel: 'baskets', headline: '12-0' });
      expect(pub.body.data.match.sides[0]).toMatchObject({ name: 'Pink City Ballers', color: '#3B82F6' });
      const script = await request(ctx.app).get('/public-assets/page.js').expect(200);
      expect(() => new Function(script.text)).not.toThrow(); // The quarter columns live in this browser script.
    },
    SLOW,
  );

  it(
    'plays 5v5 quarters into overtime, mirrors each period, and fouls a player out',
    async () => {
      const five = (prefix: string) => Array.from({ length: 6 }, (_, i) => ({ guest: { displayName: `${prefix}${i}` }, jerseyNumber: i + 1 }));
      const m = (
        await request(ctx.app)
          .post('/api/v1/matches')
          .set(as(alice))
          .send({ sport: 'basketball', format: '5v5', sides: [{ name: 'Mavericks', players: five('M') }, { name: 'Warriors', players: five('W') }], rulesOverride: { mode: 'timed', periods: 4, threePointers: true, playersOnCourt: 5, foulOutAt: 5 } })
          .expect(201)
      ).body.data.match;
      expect(m.ruleset.name).toBe('4 × 10 min · running clock');
      const fouls = Array.from({ length: 5 }, () => ({ type: 'foul', sideIndex: 1, playerIndex: 0 }));
      const end = { type: 'period_end', clock: 0 };
      const tied = await send(alice, m.id, [hoop(0, 3), ...fouls, hoop(1, 3), end, end, end, end]);
      expect(tied.score.game).toMatchObject({ periodLabel: 'OT', overtime: true });
      expect(tied.score.game.players[1][0]).toMatchObject({ fouls: 5, fouledOut: true });
      await request(ctx.app).post(`/api/v1/matches/${m.id}/events`).set(as(alice)).send({ event: { type: 'foul', sideIndex: 1, playerIndex: 0 }, version: tied.version }).expect(400);
      await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: tied.version }).expect(409);

      const won = await send(alice, m.id, [hoop(1, 2), end]);
      expect(won.score).toMatchObject({ complete: true, winnerSideIndex: 1, callout: 'Won by 2 in overtime' });
      await request(ctx.app).post(`/api/v1/matches/${m.id}/complete`).set(as(alice)).send({ version: won.version }).expect(200);
      const segments = await ctx.db.matchSegment.findMany({ where: { matchId: m.id }, orderBy: { sequence: 'asc' }, include: { scores: true } });
      expect(segments.map((s) => s.type)).toEqual(['period', 'period', 'period', 'period', 'overtime']);
    },
    SLOW,
  );

  it(
    'records a typed-in result and refuses one the rules could not produce',
    async () => {
      const body = { sport: 'basketball', format: '3v3', sides: [{ name: 'Ballers', players: [{ userId: alice.userId }] }, { name: 'Hoopers', players: [{ userId: bob.userId }] }] };
      const post = (extra: object) => request(ctx.app).post('/api/v1/matches').set(as(alice)).send({ ...body, ...extra });
      await post({ manualScores: [[21, 21]] }).expect(400);
      await post({ manualScores: [[22, 21]] }).expect(400);
      await post({ manualScores: [[25, 10]] }).expect(400);
      await post({ manualScores: [[21, 22]] }).expect(400); // both reached 21
      const ok = (await post({ manualScores: [[18, 12]], playedOn: '2026-11-02' }).expect(201)).body.data.match;
      expect(ok).toMatchObject({ status: 'completed', score: { winnerSideIndex: 0, headline: '18-12' }, confirmation: { status: 'pending' } });
      const timed = (await post({ format: '5v5', rulesOverride: { mode: 'timed' }, manualScores: [[81, 78]] }).expect(201)).body.data.match;
      expect(timed.score).toMatchObject({ headline: '81-78', winnerSideIndex: 0 });
      await request(ctx.app).post(`/api/v1/matches/${ok.id}/confirm`).set(as(bob)).send({ decision: 'confirmed' }).expect(200);
    },
    SLOW,
  );

  it(
    'runs a knockout tournament event with basketball rules',
    async () => {
      const t = (await request(ctx.app).post('/api/v1/tournaments').set(as(alice)).send({ name: 'Hoops Cup' }).expect(201)).body.data.tournament;
      const event = (
        await request(ctx.app).post(`/api/v1/tournaments/${t.id}/events`).set(as(alice)).send({ name: '3v3 Open', sport: 'basketball', format: '3v3', drawFormat: 'knockout', rulesOverride: { target: 11 } }).expect(201)
      ).body.data.event;
      expect(event.ruleset.name).toBe('First to 11 · 10 min limit');
      for (const name of ['Kings', 'Lions']) {
        await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/entries`).set(as(alice)).send({ players: ['A', 'B', 'C'].map((x) => ({ guest: { displayName: `${name} ${x}` } })) }).expect(201);
      }
      const drawn = (await request(ctx.app).post(`/api/v1/tournament-events/${event.id}/draw`).set(as(alice)).send({ randomSeed: 1 }).expect(200)).body.data.event;
      const final = drawn.fixtures.find((f: { status: string }) => f.status === 'ready');
      const match = (await request(ctx.app).post(`/api/v1/fixtures/${final.id}/start`).set(as(alice)).send({}).expect(200)).body.data.match;
      const played = await send(alice, match.id, [...Array.from({ length: 5 }, () => hoop(1, 2)), { type: 'period_end' }]);
      expect(played.score).toMatchObject({ complete: true, winnerSideIndex: 1 });
      await request(ctx.app).post(`/api/v1/matches/${match.id}/complete`).set(as(alice)).send({ version: played.version }).expect(200);
      const after = (await request(ctx.app).get(`/api/v1/tournament-events/${event.id}`).set(as(alice)).expect(200)).body.data.event;
      expect(after.status).toBe('completed');
      expect(after.fixtures.at(-1).match.segments).toEqual([[0, 10]]);
    },
    SLOW,
  );
});
